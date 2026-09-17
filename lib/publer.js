import { rateLimit } from './db';
import { redact } from './auth';
export const unwrap=v=>v?.data??v;
export const jobResult=v=>{const d=unwrap(v);return d.result?{...d,...d.result}:d;};
export function failures(v){return v!=null&&(typeof v==='object'?Object.keys(v).length>0:Boolean(v));}
export async function publer(method,path,data){
  if(!process.env.PUBLER_API_KEY)throw new Error('Add PUBLER_API_KEY in Vercel environment variables.');
  await rateLimit('publer:'+process.env.PUBLER_API_KEY,90,120);
  let response;
  try{response=await fetch(`https://app.publer.com/api/v1${path}`,{method,headers:{Authorization:`Bearer-API ${process.env.PUBLER_API_KEY}`,'Publer-Workspace-Id':process.env.PUBLER_WORKSPACE_ID??'','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(45000),redirect:'error',cache:'no-store'});}
  catch(e){throw Object.assign(new Error(`${method} ${path}: network response unknown. ${redact(e.message)}`),{ambiguous:method!=='GET'});}
  const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{body={message:raw.slice(0,2000)};}
  if(!response.ok)throw Object.assign(new Error(redact(`${method} ${path} (${response.status}): ${JSON.stringify(body)}`)),{ambiguous:method!=='GET'&&response.status>=500,status:response.status===429?429:400});
  return unwrap(body);
}
