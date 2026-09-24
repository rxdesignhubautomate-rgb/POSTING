import { z } from 'zod';
import defaults from '../config/platforms.json';
export const providers=Object.keys(defaults);
export const briefSchema=z.object({topic:z.string().min(5).max(300),primary_keyword:z.string().min(3).max(80),language:z.enum(['hinglish','english','hindi']),platforms:z.array(z.enum(providers)).min(1).max(9),notes:z.string().max(12000).default(''),cta_url:z.string().url().refine(v=>v.startsWith('https://')),targets:z.record(z.array(z.string())).default({}),boards:z.record(z.string()).default({})});
export const mediaSchema=z.object({url:z.string().url(),pathname:z.string(),name:z.string().max(180),type:z.enum(['image','video']),width:z.number().int().positive().max(20000),height:z.number().int().positive().max(20000),duration:z.number().min(0).max(43200),size:z.number().positive().max(200*1024*1024)});
export function config(job){return {platforms:{...defaults,pinterest:{...defaults.pinterest,boards:job.brief.boards}},env:{IG_HASHTAGS_IN_COMMENT:true,YOUTUBE_PRIVACY:'public',YOUTUBE_CATEGORY:'22',THREADS_SCHEDULE_FALLBACK:'skip'}};}
export function orientation(m){return Math.abs(m.width/m.height-9/16)<.04?'vertical':m.width===m.height?'square':m.width>m.height?'horizontal':'portrait';}
export function mediaForPlatform(p,media){
  const images=media.filter(m=>m.type==='image'),video=media.find(m=>m.type==='video');
  if(['google','pinterest'].includes(p))return images;
  return video?[video]:images;
}
export function selectType(p,media){
  media=mediaForPlatform(p,media);
  const m=media[0];if(!m)return null;
  if(m.type==='image'){if(p==='youtube')return null;const count=Math.min(media.length,{linkedin:9,twitter:4,pinterest:5,google:1}[p]??10);return {type:count>1&&['instagram','facebook','tiktok'].includes(p)?'carousel':'photo',count};}
  const d=m.duration,v=orientation(m)==='vertical';if(p==='google')return null;
  if(p==='instagram')return v&&d>=3&&d<=900?{type:'video',format:'reel',count:1}:null;
  if(p==='youtube')return {type:'video',...(v&&d<=180?{format:'short'}:{}),count:1};
  if(p==='twitter'&&d>140||p==='linkedin'&&(d<3||d>900)||p==='threads'&&(d<3||d>300)||p==='pinterest'&&(d<30||d>900)||p==='tiktok'&&(!v||d<3||d>600)||p==='facebook'&&d>14400)return null;
  return {type:'video',count:1};
}
export function validFor(m,p,type){const v=m.validity?.[p];if(typeof v==='boolean')return v;if(typeof v?.[type]==='boolean')return v[type];return type==='carousel'&&v?.photo===true;}
export function validityReason(m,p,type){
  const v=m.publer?.validity?.[p]??m.validity?.[p];
  if(v===undefined)return `${p} media validity is missing from Publer. Re-import media or reconnect/sync the account.`;
  if(v===false)return `Publer marked this media invalid for ${p}. Re-upload a platform-compatible file.`;
  if(typeof v==='object'&&v[type]===false)return `Publer marked this media invalid for ${p} ${type}. Re-upload a compatible file.`;
  return `Publer validity false or unknown for ${p}.`;
}
export function eligible(job){return job.brief.platforms.filter(p=>selectType(p,job.media));}
export function assertEditable(job){if(job.delivery)throw new Error('This job has a delivery in progress or submitted. Duplicate it to create a new post.');}
export function validateMediaSet(media){const videos=media.filter(m=>m.type==='video'),images=media.filter(m=>m.type==='image');if(!media.length)throw new Error('Add media first.');if(videos.length>1)throw new Error('Use only one video per daily post.');if(images.length>10)throw new Error('Use up to ten images per daily post.');if(!images.length&&videos.length&&!media.some(m=>m.type==='video'))throw new Error('Add a video or images.');}
export function buildYouTubeSnippet(content,brief={}){
  const categoryId=/education/i.test(content.category??'')?'27':'22',hinglish=['hinglish','hindi'].includes(brief.language);
  return {title:content.title,description:content.description,tags:content.tags??[],categoryId,defaultLanguage:hinglish?'hi':'en',defaultAudioLanguage:hinglish?'hi':'en'};
}
export function buildPayload(job,mode,scheduled_at,liveAccounts){
  const makeNetwork=(p,type,media,c)=>{
    const n={type:type.type,text:c.caption??c.text??c.description,media:media.map((m,i)=>({id:m.publer.id,type:m.type==='image'?'image':'video',...(m.publer.path?{path:m.publer.path}:{}),...(m.type==='image'?{alt_text:c.alt_texts?.[i]??c.alt_text}: {})}))};
    if(type.format)n.details={type:type.format};
    if(p==='youtube'){const snippet=buildYouTubeSnippet(c,job.brief);Object.assign(n,{title:snippet.title,tags:snippet.tags,category:snippet.categoryId,language:snippet.defaultLanguage,privacy:'public',...(type.format?{details:{type:'short',privacy:'public'}}:{})});}
    if(p==='google')Object.assign(n,{title:'LEARN_MORE',url:job.brief.cta_url});
    if(p==='pinterest')Object.assign(n,{title:c.title,url:job.brief.cta_url});
    if(p==='tiktok')n.details={privacy:'PUBLIC_TO_EVERYONE',promotional:true,paid:false,comment:true,duet:false,stitch:false};
    return n;
  };
  const accountPayload=(p,id,c)=>{
    if(!liveAccounts.some(a=>a.id===id&&a.provider===p&&(!a.status||a.status==='active')))throw new Error(`Invalid/inactive ${p} account.`);
    const a={id,...(mode==='schedule'?{scheduled_at}:{})};
    if(p==='instagram'&&c.first_comment_hashtags)a.comments=[{text:c.first_comment_hashtags}];
    if(p==='pinterest'){a.album_id=job.brief.boards[id];if(!a.album_id)throw new Error('Select the Pinterest board.');}
    return a;
  };
  const posts=[],skipped=[];
  for(const p of job.brief.platforms){
    const type=selectType(p,job.media);
    if(!type||p==='threads'&&mode==='schedule'){skipped.push({platform:p,reason:!type?'Unsupported media':'Threads scheduling unsupported'});continue;}
    const media=mediaForPlatform(p,job.media).slice(0,type.count);
    const invalid=media.find(m=>!validFor(m.publer,p,type.format??type.type));
    if(invalid){skipped.push({platform:p,reason:validityReason(invalid,p,type.format??type.type)});continue;}
    const ids=job.brief.targets[p];if(!ids?.length)throw new Error(`Select an account for ${p}.`);
    for(const id of ids){
      const c=job.content[`${p}:${id}`]??job.content[(job.destinations??[]).find(d=>d.platform===p&&(d.account_ids??[]).includes(id))?.key]??job.content[p];if(!c)throw new Error(`Missing ${p} content.`);
      const networks={[p]:makeNetwork(p,type,media,c)};
      posts.push({networks,accounts:[accountPayload(p,id,c)]});
    }
  }
  if(!posts.length)throw new Error(`No eligible accounts: ${skipped.map(s=>s.reason).join('; ')}`);
  return {endpoint:mode==='now'?'/posts/schedule/publish':'/posts/schedule',payload:{bulk:{state:mode==='draft'?'draft':'scheduled',posts}},skipped};
}
export function buildSinglePayload(job,mode='schedule',scheduled_at=job.slot_at){
  const p=job.brief.platforms[0],type=job.format?{type:job.format==='photo'?'photo':job.format==='text'?'status':'video',format:['reel','short'].includes(job.format)?job.format:null,count:job.media.length||0}:selectType(p,job.media);
  if(!type)throw new Error(`Unsupported weekly format for ${p}.`);
  const c=job.content[p];if(!c)throw new Error(`Missing ${p} content.`);
  const id=job.brief.targets[p]?.[0];if(!id)throw new Error(`Map a Publer account for ${job.channel_id}.`);
  const text=c.caption??c.text??c.description;
  const media=job.media.filter(m=>m.publer?.id).map((m,i)=>({id:m.publer.id,type:m.type==='image'?'image':'video',...(m.type==='image'?{alt_text:c.alt_texts?.[i]??c.alt_text}: {})}));
  const networks={};
  const n={type:type.type,text,...(media.length?{media}:{})};
  if(type.format)n.details={type:type.format};
  if(p==='youtube'){const snippet=buildYouTubeSnippet(c,job.brief);Object.assign(n,{title:snippet.title,tags:snippet.tags,category:snippet.categoryId,language:snippet.defaultLanguage,privacy:'public',...(type.format==='short'?{details:{type:'short',privacy:'public'}}:{})});}
  if(p==='google')Object.assign(n,{title:'LEARN_MORE',url:job.brief.cta_url});
  if(p==='pinterest')Object.assign(n,{title:c.title,url:job.brief.cta_url});
  networks[p]=n;
  const account={id,...(mode==='schedule'?{scheduled_at}:{})};
  if(p==='instagram'&&c.first_comment_hashtags)account.comments=[{text:c.first_comment_hashtags}];
  if(p==='pinterest'){account.album_id=job.brief.boards[id];if(!account.album_id)throw new Error('Set the Pinterest default board for this channel.');}
  return {endpoint:mode==='now'?'/posts/schedule/publish':'/posts/schedule',payload:{bulk:{state:mode==='draft'?'draft':'scheduled',posts:[{networks,accounts:[account]}]}}};
}
