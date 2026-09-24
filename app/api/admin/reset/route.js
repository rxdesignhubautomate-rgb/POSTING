import { neon } from '@neondatabase/serverless';
import { list,del } from '@vercel/blob';
import { authorize,errorResponse } from '../../../../lib/auth';
import { databaseUrl,init,rateLimit } from '../../../../lib/db';
import { inspectReset,performReset } from '../../../../lib/reset';
export const runtime='nodejs';export const maxDuration=300;
function client(){const url=databaseUrl();if(!url)throw new Error('Database is not configured.');return neon(url);}
export async function GET(req){try{authorize(req);await rateLimit('admin-reset-preview',10,60);await init();return Response.json(await inspectReset({sql:client()}));}catch(e){return errorResponse(e);}}
export async function POST(req){try{authorize(req,{write:true});await rateLimit('admin-reset-confirm',3,600);const body=await req.json();await init();const result=await performReset({sql:client(),confirm:body.confirm,all:body.all===true,includePubler:body.include_publer===true,includeBlob:body.include_blob===true,blobList:list,blobDelete:del});return Response.json(result);}catch(e){return errorResponse(e);}}
