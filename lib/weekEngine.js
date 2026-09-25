import { randomUUID,timingSafeEqual } from 'node:crypto';
import { planWeek } from './planner';
import { normalizeChannels,personaFor,channelsForBrand,isBrand } from './channels';
import { buildSinglePayload,mediaForPlatform } from './model';
import { validate } from './validate';
import { researchStep,generatePlatform,audit } from './ai';
import { publer } from './publer';
import { createJobs,createWeek,getResearchCached,saveResearchCached,saveWeek,listWeekJobs,withJob } from './db';
import platformDefaults from '../config/platforms.json';

export function assertCronSecret(req){
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32)throw Object.assign(new Error('CRON_SECRET must be at least 32 characters.'),{status:500});
  const got=(req.headers.get('authorization')??'').replace(/^Bearer\s+/i,'');
  const a=Buffer.from(got),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(new Error('Unauthorized cron tick.'),{status:401});
}
export function weeklyBrief(slot,channel,settings,brand=channel.brand){
  const persona=personaFor(settings,slot.persona);
  const brandLabel=normalizeChannels(settings).brands[brand]?.label??'All brands';
  return {
    topic:slot.topic.topic,
    primary_keyword:slot.topic.primary_keyword,
    language:channel.language??persona.language,
    persona_key:slot.persona,
    platforms:[slot.platform],
    notes:[slot.topic.notes,slot.geo?`Required local geo for this post: ${slot.geo}. Put it in the first line/title.`:'',`Persona: ${persona.label}. ${persona.voice}`,`Brand dashboard: ${brandLabel}`].filter(Boolean).join('\n'),
    cta_url:channel.cta_url||persona.cta_url,
    targets:channel.account_id?{[slot.platform]:[channel.account_id]}:{},
    boards:channel.default_board&&channel.account_id?{[channel.account_id]:channel.default_board}:{}
  };
}
export async function createWeeklyPlan({week_start,topics,media,settings,seed='rx-week',brand=null}){
  const channels=normalizeChannels(settings);
  const scoped=isBrand(brand)?channelsForBrand(channels,brand).filter(c=>c.enabled):channels.channels.filter(c=>c.enabled);
  if(isBrand(brand)&&!scoped.length)throw new Error(`No enabled channels are configured for ${channels.brands[brand].label}.`);
  const plan=planWeek({week_start,topics,media,channels:scoped,seed:isBrand(brand)?`${seed}:${brand}`:seed});
  const now=new Date().toISOString(),week={id:randomUUID(),brand:isBrand(brand)?brand:'all',week_start:plan.week_start,topics,status:'queued',stats:{slots:plan.slots.length,shortfalls:plan.shortfalls.length},plan,media,created_at:now,updated_at:now};
  await createWeek(week);
  const jobs=plan.slots.map(slot=>{
    const channel=channels.channels.find(c=>c.id===slot.channel_id);
    const selectedMedia=media.filter(m=>slot.media_ids.includes(m.id||m.url||m.name));
    return {id:randomUUID(),week_id:week.id,brand:channel.brand,channel_id:slot.channel_id,persona:slot.persona,slot_at:slot.slot_at,format:slot.format,media_ids:slot.media_ids,...(slot.geo?{seo_geo:slot.geo}:{}),brief:weeklyBrief(slot,channel,channels,channel.brand),media:selectedMedia,content:{},status:'queued',created_at:now,updated_at:now,workspace_id:process.env.PUBLER_WORKSPACE_ID??null};
  });
  await createJobs(jobs);
  week.jobs=jobs.map(({research_evidence,research_history,content,...j})=>({...j,has_content:false}));
  return week;
}
export async function approveWeekJobs(weekId,ids){
  const jobs=await listWeekJobs(weekId),wanted=new Set(ids?.length?ids:jobs.filter(j=>j.status==='awaiting_approval').map(j=>j.id)),out=[];
  for(const j of jobs.filter(j=>wanted.has(j.id)))out.push(await withJob(j.id,async(job)=>{const platform=job.brief?.platforms?.[0],needsMedia=['instagram','youtube','google','pinterest','tiktok'].includes(platform);if(needsMedia&&!job.media?.length)throw new Error(`Add media to ${job.channel_id} before approval. The week can be built without it.`);if(job.status==='awaiting_approval'||job.status==='ready')job.status='approved';else if(job.status==='needs_fix')throw new Error(`${job.channel_id} needs fixing before approval.`);}));
  return out;
}
async function generateWeekly(job,save){
  const cached=await getResearchCached(job.brief);
  if(cached&&!job.research){job.research=cached;job.status='writing';await save();}
  if(!job.research){job.status='researching';await save();await researchStep(job);if(job.research)await saveResearchCached(job.brief,job.research);}
  const p=job.brief.platforms[0];
  if(!job.content[p]){job.status='writing';await save();let last;for(let i=0;i<3;i++){try{await generatePlatform(job,p);break;}catch(e){last=e;job.repair_attempts=(job.repair_attempts??0)+1;}}if(!job.content[p]&&last)throw last;}
  const errors=validate(p,job.content[p],job.brief,{platforms:platformDefaults,env:{IG_HASHTAGS_IN_COMMENT:true}},{imageCount:mediaForPlatform(p,job.media).filter(m=>m.type==='image').length,research:job.research});
  if(errors.length){job.status='needs_fix';job.error=errors.join('; ');return;}
  job.status='reviewing';await save();await audit(job);job.status='awaiting_approval';
}
async function scheduleApproved(job,save){
  if(job.delivery?.job_id)return;
  if(job.media.some(m=>m.type!=='text'&&!m.publer?.id)){job.status='needs_attention';job.error='Import media in Publer before auto-scheduling, or use the manual editor to continue imports.';return;}
  const plan=buildSinglePayload(job,'schedule',job.slot_at);
  job.plan=plan;job.delivery={mode:'schedule',scheduled_at:job.slot_at,status:'submitting',started_at:new Date().toISOString()};job.status='scheduling';await save();
  const r=await publer('POST',plan.endpoint,plan.payload);
  if(!r.job_id)throw Object.assign(new Error('Publer response has no job ID. Check dashboard before retrying.'),{ambiguous:true});
  job.delivery.job_id=r.job_id;job.delivery.status='working';job.status='processing';
}
export async function tickOne(id){
  return withJob(id,async(job,save)=>{
    try{
      if(['queued','researching','writing','reviewing'].includes(job.status))await generateWeekly(job,save);
      else if(job.status==='approved')await scheduleApproved(job,save);
    }catch(e){job.status=e.ambiguous?'needs_attention':'needs_fix';job.error=e.message;await save();throw e;}
  });
}
