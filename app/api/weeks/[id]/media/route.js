import { authorize,errorResponse } from '../../../../../lib/auth';
import { getMediaPool,listWeekJobs,saveMediaPool,withJob } from '../../../../../lib/db';
import { autoMatchMedia,autoMatchMediaByDate } from '../../../../../lib/calendarImport';
import { selectType } from '../../../../../lib/model';

export const runtime='nodejs';
export const maxDuration=300;

export async function GET(req,{params}){try{
  authorize(req);const {id}=await params;
  const jobs=await listWeekJobs(id),pool=await getMediaPool(id);
  return Response.json({week_id:id,pool,jobs,needs_media:jobs.filter(j=>!j.media?.length).length});
}catch(e){return errorResponse(e);}}

export async function POST(req,{params}){try{
  authorize(req,{write:true});const {id}=await params,body=await req.json();
  if(body.action==='save_pool'){
    const pool=await saveMediaPool(id,Array.isArray(body.media)?body.media:[]);
    return Response.json({week_id:id,pool});
  }
  if(body.action==='fill_gaps'){
    const allJobs=await listWeekJobs(id),scope=new Set(body.job_ids??[]),jobs=scope.size?allJobs.filter(j=>scope.has(j.id)):allJobs,pool=Array.isArray(body.media)?body.media:await getMediaPool(id),matched=body.mode==='date'?autoMatchMediaByDate(jobs,pool):autoMatchMedia(jobs,pool),changed=[];
    for(const next of matched.jobs.filter(j=>j.media?.length&&jobs.find(old=>old.id===j.id&&!old.media?.length))){
      changed.push(await withJob(next.id,async(job)=>{if(job.delivery)return;job.media=next.media;job.media_ids=next.media_ids;const selected=selectType(job.brief.platforms[0],next.media);if(selected)job.format=selected.format??selected.type;job.updated_at=new Date().toISOString();}));
    }
    return Response.json({week_id:id,assigned:changed.length,remaining:matched.remaining,shortfalls:matched.shortfalls,jobs:await listWeekJobs(id)});
  }
  if(body.action==='assign'){
    const ids=new Set(body.job_ids??[]),media=body.media??[];
    const changed=[];for(const job of (await listWeekJobs(id)).filter(j=>ids.has(j.id)))changed.push(await withJob(job.id,async(j)=>{if(j.delivery)return;j.media=media;j.media_ids=media.map(m=>m.id||m.url||m.name);const selected=selectType(j.brief.platforms[0],media);if(selected)j.format=selected.format??selected.type;}));
    return Response.json({week_id:id,assigned:changed.length,jobs:await listWeekJobs(id)});
  }
  throw new Error('Unknown media action.');
}catch(e){return errorResponse(e);}}
