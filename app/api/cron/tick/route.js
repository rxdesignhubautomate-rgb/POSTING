import { errorResponse,redact } from '../../../../lib/auth';
import { listRunnableJobs,rateLimit } from '../../../../lib/db';
import { assertCronSecret,tickOne } from '../../../../lib/weekEngine';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(req){return POST(req);}
export async function POST(req){const started=Date.now(),processed=[],errors=[];try{
  assertCronSecret(req);await rateLimit('cron-tick',90,600);
  const url=new URL(req.url),limit=Math.min(10,Math.max(1,Number(url.searchParams.get('limit')??6)));
  for(const job of await listRunnableJobs(limit)){
    if(Date.now()-started>240000)break;
    try{const next=await tickOne(job.id);processed.push({id:next.id,status:next.status});}
    catch(e){errors.push({id:job.id,error:redact(e.message)});}
  }
  return Response.json({processed,errors,duration_ms:Date.now()-started});
}catch(e){return errorResponse(e);}}
