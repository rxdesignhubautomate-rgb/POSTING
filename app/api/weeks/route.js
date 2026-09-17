import { authorize,errorResponse } from '../../../lib/auth';
import { getSetting,listJobs,listWeeks,listWeekJobs } from '../../../lib/db';
import { defaultChannels,normalizeChannels } from '../../../lib/channels';
import { parseTopics } from '../../../lib/planner';
import { createWeeklyPlan } from '../../../lib/weekEngine';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(req){try{
  authorize(req);
  const weeks=await Promise.all((await listWeeks()).map(async w=>({...w,jobs:await listWeekJobs(w.id)})));
  const known=new Set(weeks.map(w=>w.id)),imported=new Map();
  for(const job of (await listJobs(5000)).filter(j=>j.source==='calendar_import'&&j.week_id&&!known.has(j.week_id))){
    const week=imported.get(job.week_id)??{id:job.week_id,week_start:job.week_id,topics:[],status:'queued',stats:{slots:0,shortfalls:0},plan:{shortfalls:[]},media:[],jobs:[],source:'calendar_import'};
    week.jobs.push(job);week.stats.slots=week.jobs.length;imported.set(job.week_id,week);
  }
  return Response.json([...weeks,...imported.values()].sort((a,b)=>String(b.week_start).localeCompare(String(a.week_start))));
}catch(e){return errorResponse(e);}}
export async function POST(req){try{
  authorize(req,{write:true});const body=await req.json();
  const topics=Array.isArray(body.topics)?body.topics:parseTopics(body.topics_text);
  if(topics.length<3||topics.length>15)throw new Error('Add 3-15 weekly topics.');
  const settings=normalizeChannels(await getSetting('channels',defaultChannels()));
  const week=await createWeeklyPlan({week_start:body.week_start??new Date().toISOString().slice(0,10),topics,media:body.media??[],settings,seed:body.seed??'rx-live'});
  return Response.json({...week,jobs:await listWeekJobs(week.id)});
}catch(e){return errorResponse(e);}}
