import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { defaultChannels,normalizeChannels,personaFor } from './channels';

export const IMPORT_HEADERS=['external_id','slot_at','channel_id','persona','format','topic','primary_keyword','secondary_keywords','search_intent','hook','creative_notes','cta_url','hashtags','language','geo_angle','guardrails','media_hint','date_locked'];
export const CHANNEL_ALIASES={fb_rx:'facebook_rx',fb_personal:'facebook_shubham',fb_lucknow:'facebook_lucknow',ig_rx:'instagram_rx',ig_lucknow:'instagram_lucknow',yt_rx:'youtube_rx',yt_personal:'youtube_shubham',li_shubham:'linkedin_shubham',pin_rx:'pinterest_visualaid',gbp_rx:'google_visualaid'};
export const PERSONA_ALIASES={blend_visualaid:'blend_personal_visualaid',blend_personal:'blend_personal_visualaid',rx_national_lucknow:'lucknow_local'};
const FORMAT_MAP=[
  [/reel/i,'reel'],[/short/i,'short'],[/long video|video/i,'video'],[/carousel/i,'carousel'],[/static|photo|image/i,'photo'],[/pin|infographic/i,'photo'],[/gbp|update|offer/i,'photo'],[/poll|text/i,'text']
];
const VIDEO_FORMATS=new Set(['reel','short','video']);
const IMAGE_FORMATS=new Set(['carousel','photo']);

export function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<String(text).length;i++){
    const c=text[i],n=text[i+1];
    if(quoted&&c==='"'&&n==='"'){field+='"';i++;continue;}
    if(c==='"'){quoted=!quoted;continue;}
    if(!quoted&&c===','){row.push(field);field='';continue;}
    if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';continue;}
    field+=c;
  }
  row.push(field);if(row.some(v=>v!==''))rows.push(row);
  const headers=rows.shift()?.map(h=>h.trim())??[];
  return rows.map((values,index)=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))).map((r,index)=>({...r,__row:index+2}));
}

export async function parseImportFile({text,buffer,filename='calendar.csv'}){
  if(filename.toLowerCase().endsWith('.xlsx')){
    const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
    const sheet=book.getWorksheet('Calendar')??book.worksheets[0];
    const headers=sheet.getRow(1).values.slice(1).map(v=>String(v??'').trim());
    const rows=[];sheet.eachRow((row,n)=>{if(n===1)return;const obj={__row:n};headers.forEach((h,i)=>obj[h]=String(row.getCell(i+1).value?.text??row.getCell(i+1).value??''));if(Object.values(obj).some(v=>String(v).trim()))rows.push(obj);});
    return rows;
  }
  return parseCsv(text);
}

export function importWeekId(slot_at){
  const d=new Date(slot_at),day=d.getUTCDay()||7;
  d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-day+1);
  return d.toISOString().slice(0,10);
}

export function normalizeFormat(value){
  const hit=FORMAT_MAP.find(([rx])=>rx.test(value||''));return hit?.[1]??'';
}

export function validateImportRows(rows,{settings=defaultChannels(),existingJobs=[],now=new Date()}={}){
  const cfg=normalizeChannels(settings),channels=new Map(cfg.channels.map(c=>[c.id,c])),existingByExternal=new Map(existingJobs.filter(j=>j.external_id).map(j=>[j.external_id,j]));
  const seen=new Set(),valid=[],errors=[];
  if(rows.length>1000)errors.push({row:0,field:'file',message:'Import is capped at 1,000 rows.'});
  for(const raw of rows.slice(0,1000)){
    const row=Object.fromEntries(IMPORT_HEADERS.map(h=>[h,String(raw[h]??'').trim()]));
    const rowErrors=[],channelId=CHANNEL_ALIASES[row.channel_id]??row.channel_id,persona=PERSONA_ALIASES[row.persona]??row.persona,channel=channels.get(channelId),format=normalizeFormat(row.format);
    if(!IMPORT_HEADERS.every(h=>Object.hasOwn(raw,h)))rowErrors.push({field:'headers',message:'Missing one or more required headers.'});
    if(!row.external_id)rowErrors.push({field:'external_id',message:'Missing external_id.'});
    if(seen.has(row.external_id))rowErrors.push({field:'external_id',message:'Duplicate external_id inside this file.'});
    seen.add(row.external_id);
    if(!channel)rowErrors.push({field:'channel_id',message:`Unknown channel ${row.channel_id}.`});
    if(!cfg.personas[persona])rowErrors.push({field:'persona',message:`Unknown persona ${row.persona}.`});
    if(!row.topic||!row.primary_keyword)rowErrors.push({field:'topic',message:'Missing topic or primary_keyword.'});
    if(!row.cta_url.startsWith('https://'))rowErrors.push({field:'cta_url',message:'CTA URL must start with https://.'});
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/.test(row.slot_at)||Number.isNaN(Date.parse(row.slot_at)))rowErrors.push({field:'slot_at',message:'slot_at must be ISO 8601 with +05:30 offset.'});
    else if(new Date(row.slot_at)<now)rowErrors.push({field:'slot_at',message:'slot_at is in the past.'});
    if(!format)rowErrors.push({field:'format',message:`Unmappable format ${row.format}.`});
    if(channel?.platform==='google'&&VIDEO_FORMATS.has(format))rowErrors.push({field:'format',message:'Google Business cannot use video formats.'});
    if(row.media_hint&&!['video','image','carousel-images'].includes(row.media_hint))rowErrors.push({field:'media_hint',message:'media_hint must be video, image or carousel-images.'});
    if(row.media_hint==='video'&&IMAGE_FORMATS.has(format))rowErrors.push({field:'media_hint',message:'Video media hint conflicts with image/text format.'});
    if(rowErrors.length){errors.push(...rowErrors.map(e=>({row:raw.__row,external_id:row.external_id,...e})));continue;}
    const personaInfo=personaFor(cfg,persona),existing=existingByExternal.get(row.external_id),platform=channel.platform;
    valid.push({raw,row:{...row,channel_id:channelId,import_channel_id:row.channel_id,persona,format_internal:format,platform},existing,job:{
      id:existing?.id??`calendar-${row.external_id}`,external_id:row.external_id,week_id:importWeekId(row.slot_at),channel_id:channelId,import_channel_id:row.channel_id,persona,slot_at:row.slot_at,format,format_original:row.format,media_hint:row.media_hint,date_locked:/^yes$/i.test(row.date_locked),source:'calendar_import',media_ids:existing?.media_ids??[],media:existing?.media??[],content:existing?.content??{},status:existing?.status??'queued',
      brief:{topic:row.topic,primary_keyword:row.primary_keyword,language:row.language.toLowerCase()==='hindi'?'hindi':row.language.toLowerCase()==='english'?'english':personaInfo.language,persona_key:persona,platforms:[platform],notes:[row.hook&&`Hook: ${row.hook}`,row.creative_notes&&`Creative notes: ${row.creative_notes}`,row.secondary_keywords&&`Secondary keywords: ${row.secondary_keywords}`,row.search_intent&&`Search intent: ${row.search_intent}`,row.geo_angle&&`Geo angle: ${row.geo_angle}`,row.guardrails&&`Guardrails: ${row.guardrails}`,row.hashtags&&`Hashtags: ${row.hashtags}`].filter(Boolean).join('\n'),cta_url:row.cta_url||personaInfo.cta_url,targets:channel.account_id?{[platform]:[channel.account_id]}:{},boards:channel.default_board&&channel.account_id?{[channel.account_id]:channel.default_board}:{}},
      import_fields:row,created_at:existing?.created_at??new Date().toISOString(),updated_at:new Date().toISOString(),workspace_id:process.env.PUBLER_WORKSPACE_ID??null
    }});
  }
  return {rows_parsed:rows.length,rows_valid:valid.length,would_create:valid.filter(v=>!v.existing).length,would_update:valid.filter(v=>v.existing&&!v.existing.delivery).length,would_skip:valid.filter(v=>v.existing?.delivery).length,errors,valid};
}

export function summarizeImport(results){
  const by_week={},by_channel={};
  for(const r of results){const action=r.action;by_week[r.week_id]??={created:0,updated:0,skipped:0,total:0};by_channel[r.channel_id]??={created:0,updated:0,skipped:0,total:0};by_week[r.week_id][action]++;by_week[r.week_id].total++;by_channel[r.channel_id][action]++;by_channel[r.channel_id].total++;}
  return {by_week,by_channel};
}

export function autoMatchMedia(jobs,pool){
  const used=new Set(),youtubeVideos=new Set(),updates=[],shortfalls=[];
  for(const job of jobs.sort((a,b)=>String(a.slot_at).localeCompare(String(b.slot_at)))){
    if(job.media?.length){updates.push(job);continue;}
    const wantsVideo=job.media_hint==='video'||VIDEO_FORMATS.has(job.format),wantsImages=job.media_hint==='carousel-images'?2:1;
    const candidates=pool.filter(m=>{
      const key=m.id||m.url||m.name;if(used.has(`${job.channel_id}:${key}`))return false;
      if(wantsVideo&&m.type!=='video')return false;if(!wantsVideo&&m.type!=='image'&&!m.cover_for)return false;
      if(job.brief.platforms[0]==='youtube'&&m.type==='video'&&youtubeVideos.has(key))return false;
      const personas=m.personas??m.persona_tags??[];return !personas.length||personas.includes(job.persona)||personas.includes(job.brief?.persona_key);
    });
    const media=candidates.slice(0,wantsVideo?1:wantsImages);
    if(!media.length){shortfalls.push({job_id:job.id,channel_id:job.channel_id,reason:'no compatible unused media'});updates.push(job);continue;}
    for(const m of media){const key=m.id||m.url||m.name;used.add(`${job.channel_id}:${key}`);if(job.brief.platforms[0]==='youtube'&&m.type==='video')youtubeVideos.add(key);}
    updates.push({...job,media,media_ids:media.map(m=>m.id||m.url||m.name)});
  }
  return {jobs:updates,shortfalls,remaining:updates.filter(j=>!j.media?.length).length};
}

export function exportImportRows(jobs){
  return jobs.map(j=>({external_id:j.external_id??j.id,slot_at:j.slot_at??j.delivery?.scheduled_at??'',channel_id:j.import_channel_id??Object.entries(CHANNEL_ALIASES).find(([,v])=>v===j.channel_id)?.[0]??j.channel_id??'',persona:Object.entries(PERSONA_ALIASES).find(([,v])=>v===(j.persona??j.brief?.persona_key))?.[0]??j.persona??j.brief?.persona_key??'',format:j.format_original??j.format??'',topic:j.brief?.topic??'',primary_keyword:j.brief?.primary_keyword??'',secondary_keywords:j.import_fields?.secondary_keywords??'',search_intent:j.import_fields?.search_intent??'',hook:j.import_fields?.hook??'',creative_notes:j.import_fields?.creative_notes??j.brief?.notes??'',cta_url:j.brief?.cta_url??'',hashtags:j.import_fields?.hashtags??'',language:j.brief?.language??'',geo_angle:j.import_fields?.geo_angle??'',guardrails:j.import_fields?.guardrails??'',media_hint:j.media_hint??'',date_locked:j.date_locked?'yes':'no',status:j.status??''}));
}

export function toCsv(rows){
  const headers=[...IMPORT_HEADERS,'status'];
  return [headers,...rows.map(r=>headers.map(h=>r[h]??''))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""').replace(/^[=+@-]/,"'$&")}"`).join(',')).join('\r\n');
}

