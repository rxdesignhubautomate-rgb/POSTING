import { authorize,errorResponse } from '../../../lib/auth';
import { getSetting,listWeeks,listWeekJobs } from '../../../lib/db';
import { defaultChannels,normalizeChannels } from '../../../lib/channels';
import { parseTopics } from '../../../lib/planner';
import { createWeeklyPlan } from '../../../lib/weekEngine';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(req){try{authorize(req);const weeks=await listWeeks();return Response.json(await Promise.all(weeks.map(async w=>({...w,jobs:await listWeekJobs(w.id)}))));}catch(e){return errorResponse(e);}}
export async function POST(req){try{
  authorize(req,{write:true});const body=await req.json();
  const topics=Array.isArray(body.topics)?body.topics:parseTopics(body.topics_text);
  if(topics.length<3||topics.length>15)throw new Error('Add 3-15 weekly topics.');
  const settings=normalizeChannels(await getSetting('channels',defaultChannels()));
  const week=await createWeeklyPlan({week_start:body.week_start??new Date().toISOString().slice(0,10),topics,media:body.media??[],settings,seed:body.seed??'rx-live'});
  return Response.json({...week,jobs:await listWeekJobs(week.id)});
}catch(e){return errorResponse(e);}}
