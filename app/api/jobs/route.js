import { randomUUID } from 'node:crypto';
import { authorize,errorResponse } from '../../../lib/auth';
import { listJobs,createJob } from '../../../lib/db';
import { briefSchema } from '../../../lib/model';
export const runtime='nodejs';
export async function GET(req){try{authorize(req);const jobs=await listJobs();return Response.json(jobs.map(({research_evidence,research_history,research,content,plan,...job})=>({...job,has_content:Boolean(Object.keys(content??{}).length)})));}catch(e){return errorResponse(e);}}
export async function POST(req){try{authorize(req,{write:true});const brief=briefSchema.parse(await req.json());const now=new Date().toISOString();return Response.json(await createJob({id:randomUUID(),brief,media:[],content:{},status:'draft',created_at:now,updated_at:now,workspace_id:process.env.PUBLER_WORKSPACE_ID??null}));}catch(e){return errorResponse(e);}}
