import { z } from 'zod';
import defaults from '../config/platforms.json';
export const providers=Object.keys(defaults);
export const briefSchema=z.object({topic:z.string().min(5).max(300),primary_keyword:z.string().min(3).max(80),language:z.enum(['hinglish','english','hindi']),platforms:z.array(z.enum(providers)).min(1).max(9),notes:z.string().max(3000).default(''),cta_url:z.string().url().refine(v=>v.startsWith('https://')),targets:z.record(z.array(z.string())).default({}),boards:z.record(z.string()).default({})});
export const mediaSchema=z.object({url:z.string().url(),pathname:z.string(),name:z.string().max(180),type:z.enum(['image','video']),width:z.number().int().positive().max(20000),height:z.number().int().positive().max(20000),duration:z.number().min(0).max(43200),size:z.number().positive().max(200*1024*1024)});
export function config(job){return {platforms:{...defaults,pinterest:{...defaults.pinterest,boards:job.brief.boards}},env:{IG_HASHTAGS_IN_COMMENT:true,YOUTUBE_PRIVACY:'public',YOUTUBE_CATEGORY:'22',THREADS_SCHEDULE_FALLBACK:'skip'}};}
export function orientation(m){return Math.abs(m.width/m.height-9/16)<.04?'vertical':m.width===m.height?'square':m.width>m.height?'horizontal':'portrait';}
export function selectType(p,media){
  const m=media[0];if(!m)return null;
  if(m.type==='image'){if(p==='youtube')return null;const count=Math.min(media.length,{linkedin:9,twitter:4,pinterest:5,google:1}[p]??10);return {type:count>1&&['instagram','facebook','tiktok'].includes(p)?'carousel':'photo',count};}
  const d=m.duration,v=orientation(m)==='vertical';if(p==='google')return null;
  if(p==='instagram')return v&&d>=3&&d<=90?{type:'video',format:'reel',count:1}:null;
  if(p==='youtube')return {type:'video',...(v&&d<=60?{format:'short'}:{}),count:1};
  if(p==='twitter'&&d>140||p==='linkedin'&&(d<3||d>900)||p==='threads'&&(d<3||d>300)||p==='pinterest'&&(d<30||d>900)||p==='tiktok'&&(!v||d<3||d>600)||p==='facebook'&&d>14400)return null;
  return {type:'video',count:1};
}
export function validFor(m,p,type){const v=m.validity?.[p];if(typeof v==='boolean')return v;if(typeof v?.[type]==='boolean')return v[type];return type==='carousel'&&v?.photo===true;}
export function eligible(job){return job.brief.platforms.filter(p=>selectType(p,job.media));}
export function assertEditable(job){if(job.delivery)throw new Error('This job has a delivery in progress or submitted. Duplicate it to create a new post.');}
export function validateMediaSet(media){if(!media.length||media.length>10)throw new Error('Add 1–10 images or one video.');if(media.some(m=>m.type==='video')&&media.length!==1)throw new Error('Use one video or a set of images, not both.');}
export function buildPayload(job,mode,scheduled_at,liveAccounts){
  const networks={},accounts=[],skipped=[];
  for(const p of job.brief.platforms){
    const type=selectType(p,job.media);
    if(!type||p==='threads'&&mode==='schedule'){skipped.push({platform:p,reason:!type?'Unsupported media':'Threads scheduling unsupported'});continue;}
    const media=job.media.slice(0,type.count);
    if(media.some(m=>!validFor(m.publer,p,type.format??type.type))){skipped.push({platform:p,reason:'Publer validity false or unknown'});continue;}
    const c=job.content[p];if(!c)throw new Error(`Missing ${p} content.`);
    const ids=job.brief.targets[p];if(!ids?.length)throw new Error(`Select an account for ${p}.`);
    const n={type:type.type,text:c.caption??c.text??c.description,media:media.map((m,i)=>({id:m.publer.id,type:m.type==='image'?'image':'video',...(m.publer.path?{path:m.publer.path}:{}),...(m.type==='image'?{alt_text:c.alt_texts?.[i]??c.alt_text}: {})}))};
    if(type.format)n.details={type:type.format};
    if(p==='youtube')Object.assign(n,{title:c.title,tags:c.tags,category:'22',privacy:'public',...(type.format?{details:{type:'short',privacy:'public'}}:{})});
    if(p==='google')Object.assign(n,{title:'LEARN_MORE',url:job.brief.cta_url});
    if(p==='pinterest')Object.assign(n,{title:c.title,url:job.brief.cta_url});
    if(p==='tiktok')n.details={privacy:'PUBLIC_TO_EVERYONE',promotional:true,paid:false,comment:true,duet:false,stitch:false};
    networks[p]=n;
    for(const id of ids){if(!liveAccounts.some(a=>a.id===id&&a.provider===p&&(!a.status||a.status==='active')))throw new Error(`Invalid/inactive ${p} account.`);
      const a={id,...(mode==='schedule'?{scheduled_at}:{})};
      if(p==='instagram'&&c.first_comment_hashtags)a.comments=[{text:c.first_comment_hashtags}];
      if(p==='pinterest'){a.album_id=job.brief.boards[id];if(!a.album_id)throw new Error('Select the Pinterest board.');}
      accounts.push(a);
    }
  }
  if(!accounts.length)throw new Error(`No eligible accounts: ${skipped.map(s=>s.reason).join('; ')}`);
  networks.default=structuredClone(Object.values(networks)[0]);
  return {endpoint:mode==='now'?'/posts/schedule/publish':'/posts/schedule',payload:{bulk:{state:mode==='draft'?'draft':'scheduled',posts:[{networks,accounts}]}},skipped};
}
