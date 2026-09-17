import { createHmac,timingSafeEqual,scryptSync,randomBytes } from 'node:crypto';
export const cookieName='rx_studio_session';
export const isDemo=()=>process.env.DEMO_MODE==='true'||!process.env.ADMIN_PASSWORD;
export function signSession(now=Date.now()){
  const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new Error('SESSION_SECRET must have at least 32 characters.');
  const payload=Buffer.from(JSON.stringify({exp:now+12*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function validSession(token,now=Date.now()){
  try{if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return false;const [p,s,...extra]=String(token??'').split('.');if(extra.length||!p||!s)return false;
    const expected=createHmac('sha256',process.env.SESSION_SECRET).update(p).digest();const got=Buffer.from(s,'base64url');
    return got.length===expected.length&&timingSafeEqual(got,expected)&&JSON.parse(Buffer.from(p,'base64url').toString()).exp>now;
  }catch{return false;}
}
export function checkPassword(input){
  if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16)throw new Error('ADMIN_PASSWORD must have at least 16 characters.');
  if(typeof input!=='string'||input.length>1024)return false;
  return timingSafeEqual(scryptSync(input,'rx-studio-admin',32),scryptSync(process.env.ADMIN_PASSWORD,'rx-studio-admin',32));
}
export function sameOrigin(req){if(req.headers.get('origin')!==new URL(req.url).origin)throw Object.assign(new Error('Request origin rejected.'),{status:403});}
export function authorize(req,{write=false}={}){
  if(isDemo())throw Object.assign(new Error('Demo mode cannot access live data or publish.'),{status:403});
  if(!validSession(req.cookies.get(cookieName)?.value))throw Object.assign(new Error('Please sign in.'),{status:401});
  if(write)sameOrigin(req);
}
export function redact(message){let s=String(message);for(const name of ['ADMIN_PASSWORD','SESSION_SECRET','DATABASE_URL','POSTGRES_URL','BLOB_READ_WRITE_TOKEN','PUBLER_API_KEY','ANTHROPIC_API_KEY'])if(process.env[name])s=s.split(process.env[name]).join('[REDACTED]');return s.replace(/sk-ant-[\w-]+/g,'[REDACTED]');}
export function errorResponse(e){return Response.json({error:redact(e.message??'Request failed')},{status:e.status??400});}
