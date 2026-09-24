import { createHash } from 'node:crypto';

const DAY=24*60*60*1000;
function hash(seed){return createHash('sha256').update(seed).digest();}
function jitter(seed,index){return hash(`${seed}:${index}`)[0]%21;}
function monday(date){
  const d=new Date(date);d.setUTCHours(0,0,0,0);
  const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-day+1);return d;
}
function istSlot(weekStart,day,time,seed,index){
  const [h,m]=time.split(':').map(Number);
  const utc=new Date(monday(weekStart).getTime()+day*DAY);
  utc.setUTCHours(h-5,m-30+jitter(seed,index),0,0);
  return utc.toISOString();
}
function isVertical(m){return m.width&&m.height&&m.height>=m.width*1.2;}
function formatFor(channel,media){
  const video=media.find(m=>m.type==='video'),image=media.find(m=>m.type==='image'||m.cover_for);
  if(channel.platform==='youtube')return video?{format:isVertical(video)&&video.duration<=180?'short':'video',media:[video]}:null;
  if(channel.platform==='google')return image?{format:'photo',media:[image]}:null;
  if(['instagram','facebook','tiktok'].includes(channel.platform)&&video)return {format:isVertical(video)?'reel':'video',media:[video]};
  if(channel.platform==='pinterest'&&image)return {format:'photo',media:[image]};
  if(image)return {format:'photo',media:[image]};
  if(['facebook','linkedin','twitter','threads'].includes(channel.platform))return {format:'text',media:[]};
  return null;
}
export function parseTopics(text){
  return String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).slice(0,15).map((line,i)=>{
    const [topic,keyword,notes]=line.split('|').map(s=>s?.trim()??'');
    return {id:`topic-${i+1}`,topic,primary_keyword:keyword||topic.slice(0,80),notes:notes||''};
  }).filter(t=>t.topic.length>=3);
}
export function planWeek({week_start,topics,media=[],channels=[],seed='rx'}){
  if(!topics?.length)throw new Error('Add at least one topic.');
  const slots=[],shortfalls=[],youtubeVideoUse=new Map();
  for(const channel of channels.filter(c=>c.enabled!==false)){
    let made=0,lastTopic=null;
    const max=Math.min(10,Math.max(1,channel.posts_per_week??8));
    for(let i=0;i<max;i++){
      let topic=topics[(i+(hash(`${seed}:${channel.id}`)[1]%topics.length))%topics.length];
      if(topic.id===lastTopic&&topics.length>1)topic=topics[(topics.indexOf(topic)+1)%topics.length];
      const available=media.filter(m=>{
        if(channel.platform!=='youtube'||m.type!=='video')return true;
        const key=m.id||m.url||m.name;
        return !youtubeVideoUse.has(key)&&!slots.some(s=>s.channel_id===channel.id&&s.media_ids.includes(key));
      });
      const picked=formatFor(channel,available);
      if(!picked){shortfalls.push({channel_id:channel.id,label:channel.label,needed:max-i,filled:made,reason:'need more compatible media'});break;}
      const ids=picked.media.map(m=>m.id||m.url||m.name);
      if(channel.platform==='youtube')for(const id of ids)youtubeVideoUse.set(id,channel.id);
      const time=channel.time_slots?.[i%(channel.time_slots.length||1)]??'10:00';
      slots.push({id:`${channel.id}-${i+1}`,channel_id:channel.id,platform:channel.platform,label:channel.label,persona:channel.persona,slot_at:istSlot(week_start,i%7,time,seed,slots.length),topic,format:picked.format,media_ids:ids,status:'queued'});
      made++;lastTopic=topic.id;
    }
    if(made<max&&!shortfalls.some(s=>s.channel_id===channel.id))shortfalls.push({channel_id:channel.id,label:channel.label,needed:max-made,filled:made,reason:'not enough slots'});
  }
  return {week_start:monday(week_start).toISOString().slice(0,10),slots:slots.sort((a,b)=>a.slot_at.localeCompare(b.slot_at)),shortfalls,seed};
}
