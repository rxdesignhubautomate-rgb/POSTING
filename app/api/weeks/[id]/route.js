import { authorize,errorResponse } from '../../../../lib/auth';
import { getWeek,listWeekJobs } from '../../../../lib/db';
import { approveWeekJobs } from '../../../../lib/weekEngine';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(req,{params}){try{authorize(req);const {id}=await params;return Response.json({...await getWeek(id),jobs:await listWeekJobs(id)});}catch(e){return errorResponse(e);}}
export async function POST(req,{params}){try{
  authorize(req,{write:true});const {id}=await params;const body=await req.json();
  if(body.action==='approve')await approveWeekJobs(id,body.ids??[]);
  else throw new Error('Unknown week action.');
  return Response.json({...await getWeek(id),jobs:await listWeekJobs(id)});
}catch(e){return errorResponse(e);}}
