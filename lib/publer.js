import { rateLimit } from './db';
import { redact } from './auth';
export const unwrap=v=>v?.data??v;
export const jobResult=v=>{const d=unwrap(v);return d.result?{...d,...d.result}:d;};
export function collectFailures(v,path=''){
  if(v==null)return [];
  if(typeof v!=='object')return v?[{path,message:String(v)}]:[];
  if(Array.isArray(v))return v.flatMap((item,i)=>collectFailures(item,`${path}[${i}]`));
  const entries=Object.entries(v);
  const ownMessage=typeof v.message==='string'||typeof v.error==='string';
  if(ownMessage)return [{path,account_id:v.account_id,account_name:v.account_name,provider:v.provider,message:v.message??v.error}];
  return entries.flatMap(([key,value])=>collectFailures(value,path?`${path}.${key}`:key));
}
export function failures(v){return collectFailures(v).length>0;}
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
