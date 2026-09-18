import { z } from 'zod';
import { head } from '@vercel/blob';
import { authorize,errorResponse,redact } from '../../../../lib/auth';
import { getJob,withJob,settings } from '../../../../lib/db';
import { briefSchema,mediaSchema,assertEditable } from '../../../../lib/model';
import { contentSchema } from '../../../../lib/validate';
import { step,importStep,deliver,checkDelivery } from '../../../../lib/engine';
import { publer } from '../../../../lib/publer';
export const runtime='nodejs';export const maxDuration=300;
export async function GET(req,{params}){try{authorize(req);const {id}=await params;const {research_history,research_evidence,...job}=await getJob(id);return Response.json(job);}catch(e){return errorResponse(e);}}
export async function POST(req,{params}){try{
  authorize(req,{write:true});const {id}=await params;const body=await req.json();
  const job=await withJob(id,async(job,save)=>{
    const {action}=body;
    if(['import','deliver','check'].includes(action)&&job.workspace_id!==process.env.PUBLER_WORKSPACE_ID)throw new Error('Workspace changed. Create a new job for the current workspace.');
    if(action==='save'){
      assertEditable(job);const next=briefSchema.parse(body.brief);
      const changed=['topic','primary_keyword','language','notes','cta_url'].some(k=>next[k]!==job.brief[k]);
      job.brief=next;job.content=changed?{}:z.record(z.string(),contentSchema).parse(body.content??job.content);
      if(changed){job.research=null;job.research_history=[];job.research_evidence=[];}
      job.audit=null;job.audit_digest=null;job.status=Object.keys(job.content).length?'needs_review':'draft';job.error=null;
    }else if(action==='media'){
      assertEditable(job);const media=mediaSchema.parse(body.media),url=new URL(media.url);
      const origin=process.env.BLOB_PUBLIC_ORIGIN?.replace(/\/$/,'');
      if(!origin||url.origin!==origin||url.username||url.password||!url.pathname.startsWith(`/media/${id}/`))throw new Error('Media URL is not in this job’s configured Blob store.');
      const actual=await head(media.url);if(actual.pathname!==media.pathname||!actual.pathname.startsWith(`media/${id}/`))throw new Error('Blob pathname mismatch.');
      if(!['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'].includes(actual.contentType))throw new Error('Unsupported uploaded content type.');
      if(media.type==='image'&&!actual.contentType.startsWith('image/')||media.type==='video'&&!actual.contentType.startsWith('video/'))throw new Error('Media type mismatch.');
      media.size=actual.size;if(media.size>(media.type==='image'?20:200)*1024*1024)throw new Error('Images max 20 MB; videos max 200 MB.');
      if(job.media.some(m=>m.url===media.url))return;
      if(media.type==='video'&&job.media.some(m=>m.type==='video'))throw new Error('Use only one video per daily post.');
      if(media.type==='image'&&job.media.filter(m=>m.type==='image').length>=10)throw new Error('Use up to ten images per daily post.');
      job.media.push(media);job.content={};job.research=null;job.research_history=[];job.research_evidence=[];job.audit=null;job.audit_digest=null;job.status='draft';
    }else if(action==='remove_media'){
      assertEditable(job);job.media=job.media.filter(m=>m.url!==body.url);job.content={};job.audit=null;job.audit_digest=null;job.status='draft';
    }else if(action==='generate'){
      assertEditable(job);try{await step(job,save);}catch(e){job.error=redact(e.message);await save();throw e;}
    }else if(action==='regenerate'){
      assertEditable(job);job.content={};job.audit=null;job.audit_digest=null;job.error=null;job.status='draft';
      try{await step(job,save);}catch(e){job.error=redact(e.message);await save();throw e;}
    }else if(action==='import')await importStep(job,save);
    else if(action==='deliver'){
      const live=await publer('GET','/accounts');const accounts=Array.isArray(live)?live:live.accounts;if(!Array.isArray(accounts))throw new Error('Unexpected accounts response.');
      await deliver(job,save,body,accounts);
    }else if(action==='check')await checkDelivery(job);
    else if(action==='archive'){assertEditable(job);job.status='archived';}
    else throw new Error('Unknown job action.');
  });const {research_history,research_evidence,...safe}=job;return Response.json(safe);
}catch(e){return errorResponse(e);}}
