import { createHash } from 'node:crypto';
import { eligible,validateMediaSet,config,buildPayload,mediaForPlatform } from './model';
import { validate } from './validate';
import { researchStep,generatePlatform,audit } from './ai';
import { publer,jobResult,failures,collectFailures } from './publer';
export function validateAll(job){for(const p of eligible(job)){const imageCount=mediaForPlatform(p,job.media).filter(m=>m.type==='image').length;const errors=validate(p,job.content[p],job.brief,config(job),{imageCount,research:job.research});if(errors.length)throw new Error(`${p}: ${errors.join('; ')}`);}}
export function auditDigest(job){return createHash('sha256').update(JSON.stringify({brief:job.brief,content:job.content,media:job.media.map(({url,pathname,name,type,width,height,duration,size})=>({url,pathname,name,type,width,height,duration,size}))})).digest('hex');}
/** Each request performs one bounded, persisted phase. Closing the tab does not lose the job. */
export async function step(job,save){
  validateMediaSet(job.media);if(job.delivery)throw new Error('Delivery already started. Check its status instead.');
  const active=eligible(job);if(!active.length)throw new Error('Selected platforms do not support this media.');
  job.error=null;
  try{
    if(!job.research){job.status='researching';await save();await researchStep(job);}
    else {const missing=active.find(p=>!job.content[p]);if(missing){job.status='writing';job.current_platform=missing;await save();await generatePlatform(job,missing);}
      else if(job.audit_digest!==auditDigest(job)){job.status='reviewing';await save();validateAll(job);await audit(job);job.audit_digest=auditDigest(job);job.status='ready';}
      else job.status='ready';}
  }catch(e){job.status='needs_attention';job.error=e.message;await save();throw e;}
}
export async function importStep(job,save){
  if(!process.env.PUBLER_WORKSPACE_ID)throw new Error('Set PUBLER_WORKSPACE_ID first.');
  if(job.delivery)throw new Error('Delivery has already started.');
  if(job.audit_digest!==auditDigest(job)||!job.audit?.approved)throw new Error('Generate/review content before importing media.');
  const media=job.media.find(m=>!m.publer?.id);if(!media)return;
  if(media.import_state==='ambiguous'||media.import_state==='submitting')throw new Error('Previous media import acceptance is uncertain. Check Publer before retrying.');
  if(!media.import_job_id){
    media.import_state='submitting';await save();
    try{const result=await publer('POST','/media/from-url',{type:'single',media:[{url:media.url,name:media.name}],direct_upload:true,in_library:true});
      if(!result.job_id)throw Object.assign(new Error('Import response has no job_id.'),{ambiguous:true});media.import_job_id=result.job_id;media.import_state='working';await save();
    }catch(e){media.import_state=e.ambiguous?'ambiguous':'failed';job.error=e.message;await save();throw e;}return;
  }
  const result=jobResult(await publer('GET',`/job_status/${encodeURIComponent(media.import_job_id)}`));
  if(result.status==='failed'||failures(result.payload?.failures)){media.import_state='failed';job.error=JSON.stringify(result.payload);await save();throw new Error('Publer media import failed; inspect job details.');}
  if(['complete','completed'].includes(result.status)){
    const data=result.payload?.media??result.payload;const item=Array.isArray(data)?data[0]:data?.id?data:data?.media?.[0];
    if(!item?.id||!item.validity)throw new Error('Unexpected import response; inspect Publer before retrying.');
    media.publer=item;media.import_state='complete';
  }
}
export async function deliver(job,save,{mode,scheduled_at,confirmed},accounts){
  if(job.delivery)throw new Error('A delivery already exists; check status instead of submitting again.');
  if(mode==='now'&&confirmed!==true)throw new Error('Confirm Publish now to continue.');
  if(mode==='schedule'&&(!scheduled_at||!Number.isFinite(Date.parse(scheduled_at))||Date.parse(scheduled_at)<Date.now()+60000))throw new Error('Schedule at least one minute in the future.');
  if(!['draft','schedule','now'].includes(mode))throw new Error('Invalid publishing mode.');
  validateAll(job);if(job.audit_digest!==auditDigest(job)||!job.audit?.approved)throw new Error('Content needs a current compliance review.');
  if(job.media.some(m=>!m.publer?.id))throw new Error('Import all media to Publer first.');
  const plan=buildPayload(job,mode,scheduled_at,accounts);job.plan=plan;
  job.delivery={mode,scheduled_at,status:'submitting',started_at:new Date().toISOString()};job.status='submitting';await save();
  try{
    const posts=plan.payload?.bulk?.posts??[];
    if(posts.length>1){
      job.delivery.jobs=[];
      for(const post of posts){
        const account=post.accounts?.[0]??{};
        const platform=Object.keys(post.networks??{})[0]??account.provider;
        const single={...plan.payload,bulk:{...plan.payload.bulk,posts:[post]}};
        const r=await publer('POST',plan.endpoint,single);
        if(!r.job_id)throw Object.assign(new Error(`Publer response has no job ID for ${platform??'one profile'}. Check dashboard before retrying.`),{ambiguous:true});
        job.delivery.jobs.push({job_id:r.job_id,status:'working',account_id:account.id,platform});
        job.delivery.job_id??=r.job_id;
        await save();
      }
    }else{
      const r=await publer('POST',plan.endpoint,plan.payload);
      if(!r.job_id)throw Object.assign(new Error('Publer response has no job ID. Check dashboard before retrying.'),{ambiguous:true});
      job.delivery.job_id=r.job_id;
    }
    job.delivery.status='working';job.status='processing';
  }catch(e){job.delivery.status=e.ambiguous?'ambiguous':'failed';job.status='needs_attention';job.error=e.message;await save();throw e;}
}
export async function checkDelivery(job){
  if(!job.delivery?.job_id)throw new Error('No known Publer job ID to check.');
  if(job.delivery.status==='complete')return;
  if(Array.isArray(job.delivery.jobs)&&job.delivery.jobs.length){
    const allFailures=[];
    for(const item of job.delivery.jobs){
      if(['complete','failed'].includes(item.status))continue;
      const r=jobResult(await publer('GET',`/job_status/${encodeURIComponent(item.job_id)}`));item.result=r;
      const foundFailures=collectFailures(r.payload?.failures??r.payload?.errors??r.payload);
      if(r.status==='failed'||foundFailures.length){
        item.status='failed';
        allFailures.push(...(foundFailures.length?foundFailures:[r]).map(f=>({...f,account_id:item.account_id,platform:item.platform,job_id:item.job_id})));
      }else if(['complete','completed'].includes(r.status))item.status='complete';
      else item.status='working';
    }
    const failed=job.delivery.jobs.some(j=>j.status==='failed');
    const complete=job.delivery.jobs.every(j=>j.status==='complete');
    if(failed){job.delivery.status='failed';job.status='needs_attention';job.error=JSON.stringify(allFailures);}
    else if(complete){job.delivery.status='complete';job.status=job.delivery.mode==='schedule'?'scheduled':job.delivery.mode==='now'?'submitted':'publer_draft';}
    else {job.delivery.status='working';job.status='processing';}
    return;
  }
  const r=jobResult(await publer('GET',`/job_status/${encodeURIComponent(job.delivery.job_id)}`));job.delivery.result=r;
  const foundFailures=collectFailures(r.payload?.failures??r.payload?.errors??r.payload);
  if(r.status==='failed'||foundFailures.length){job.delivery.status='failed';job.status='needs_attention';job.error=JSON.stringify(foundFailures.length?foundFailures:r);}
  else if(['complete','completed'].includes(r.status)){job.delivery.status='complete';job.status=job.delivery.mode==='schedule'?'scheduled':job.delivery.mode==='now'?'submitted':'publer_draft';}
}
export function reopenFailedDelivery(job){
  if(!job.delivery||!['failed','ambiguous'].includes(job.delivery.status))throw new Error('Only failed Publer deliveries can be reopened for correction.');
  job.delivery_history=[...(job.delivery_history??[]),{...job.delivery,reopened_at:new Date().toISOString(),error:job.error??null}].slice(-5);
  job.delivery=null;job.plan=null;job.status=job.audit_digest===auditDigest(job)&&job.audit?.approved?'ready':'needs_review';job.error=null;
}
