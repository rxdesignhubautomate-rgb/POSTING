import { z } from 'zod';
import defaults from '../config/channels.json';

export const personaKeys=Object.keys(defaults.personas);
export const brandKeys=Object.keys(defaults.brands);
export const brandPlatforms={
  rx_global:['facebook','instagram','youtube','twitter'],
  shubham:['facebook','instagram','youtube'],
  visualaid_lucknow:['facebook','instagram','google']
};
export const brandSchema=z.enum(brandKeys);
export const brandConfigSchema=z.object({label:z.string().min(2),short:z.string().min(1).max(4),tagline:z.string().min(3),cta_url:z.string().url(),default_persona:z.enum(personaKeys),color:z.string(),color_dark:z.string(),tint:z.string()});
export const personaSchema=z.object({
  label:z.string().min(2),
  audience:z.string().min(5),
  voice:z.string().min(10),
  cta_url:z.string().url().refine(v=>v.startsWith('https://')),
  language:z.enum(['hinglish','english','hindi']),
  blend_ratio:z.number().min(0).max(1).optional(),
  hashtag_seeds:z.array(z.string()).default([]),
  local_keywords:z.array(z.string()).default([])
});
export const channelSchema=z.object({
  id:z.string().min(2),
  brand:brandSchema,
  platform:z.enum(['instagram','facebook','linkedin','youtube','google','pinterest','twitter','threads','tiktok']),
  label:z.string().min(2),
  persona:z.enum(personaKeys),
  enabled:z.boolean().default(true),
  account_id:z.string().optional().default(''),
  mapping_source:z.enum(['auto','manual']).optional(),
  posts_per_week:z.number().int().min(1).max(10).default(8),
  time_slots:z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).default(['10:00']),
  language:z.enum(['hinglish','english','hindi']).optional(),
  cta_url:z.string().url().optional().or(z.literal('')),
  default_board:z.string().optional().default(''),
  blend_ratio:z.number().min(0).max(1).optional(),
  angle_mix:z.record(z.number().min(0).max(1)).optional()
});
export const channelsSettingsSchema=z.object({
  company_facts:z.object({
    name:z.string(),
    established:z.string(),
    location:z.string(),
    reach:z.string(),
    services:z.array(z.string())
  }),
  brands:z.record(brandConfigSchema),
  personas:z.record(personaSchema),
  channels:z.array(channelSchema)
});
export function defaultChannels(){return structuredClone(defaults);}
const personaBrands={rx_national:'rx_global',lucknow_local:'visualaid_lucknow',personal:'shubham',blend_personal_visualaid:'shubham'};
export function isBrand(value){return brandKeys.includes(value);}
export function defaultBrandFor(channel){
  const shipped=defaults.channels.find(c=>c.id===channel?.id)?.brand;
  return shipped??personaBrands[channel?.persona]??'rx_global';
}
export function normalizeChannels(value){
  const merged={...defaultChannels(),...(value??{})};
  merged.brands={...defaults.brands,...(value?.brands??{})};
  merged.personas={...defaults.personas,...(value?.personas??{})};
  merged.company_facts={...defaults.company_facts,...(value?.company_facts??{})};
  merged.channels=(value?.channels?.length?value.channels:defaults.channels).map(c=>channelSchema.parse({...c,brand:isBrand(c.brand)?c.brand:defaultBrandFor(c)}));
  return channelsSettingsSchema.parse(merged);
}
export function enabledChannels(settings){
  return normalizeChannels(settings).channels.filter(c=>c.enabled);
}
export function personaFor(settings,key){
  return normalizeChannels(settings).personas[key]??defaults.personas.rx_national;
}
export function channelsForBrand(settings,brand){
  const channels=normalizeChannels(settings).channels;
  if(brand==='all'||!brand)return channels;
  const allowed=new Set(brandPlatforms[brand]??[]);
  return channels.filter(c=>c.brand===brand&&allowed.has(c.platform));
}
export function scopeBriefToBrand(brief,brand,settings){
  const channels=channelsForBrand(settings,brand),available=new Set(channels.map(c=>c.platform));
  const platforms=(brandPlatforms[brand]??[]).filter(p=>available.has(p));
  const targets={};
  for(const platform of platforms){
    const mapped=[...new Set(channels.filter(c=>c.platform===platform&&c.account_id).map(c=>c.account_id))];
    const selected=(brief?.targets?.[platform]??[]).filter(id=>mapped.includes(id));
    if(selected.length)targets[platform]=selected;
    else if(mapped.length)targets[platform]=mapped;
  }
  const selectedIds=new Set(Object.values(targets).flat()),boards={};
  for(const [id,board] of Object.entries(brief?.boards??{}))if(selectedIds.has(id))boards[id]=board;
  return {...brief,platforms,targets,boards};
}
export function brandsOfJob(job,settings){
  const cfg=normalizeChannels(settings),found=new Set();
  if(isBrand(job?.brand))found.add(job.brand);
  const ids=[...(job?.channel_ids??[]),job?.channel_id,...(job?.destinations??[]).map(d=>d.channel_id)].filter(Boolean);
  for(const id of ids){const channel=cfg.channels.find(c=>c.id===id);if(channel)found.add(channel.brand);}
  const accountIds=new Set(Object.values(job?.brief?.targets??{}).flat());
  for(const channel of cfg.channels)if(channel.account_id&&accountIds.has(channel.account_id))found.add(channel.brand);
  if(!found.size){const persona=job?.persona??job?.brief?.persona_key??job?.brief?.persona;if(personaBrands[persona])found.add(personaBrands[persona]);}
  if(!found.size)found.add('rx_global');
  return [...found];
}
export function jobInBrand(job,brand,settings){return brand==='all'||!brand||brandsOfJob(job,settings).includes(brand);}
export function validateChannelMappings(settings,{requireAccount=false}={}){
  const cfg=normalizeChannels(settings),errors=[];
  for(const c of cfg.channels.filter(x=>x.enabled)){
    if(!cfg.personas[c.persona])errors.push(`${c.label}: missing persona`);
    if(requireAccount&&!c.account_id)errors.push(`${c.label}: map a Publer account`);
    if(c.platform==='pinterest'&&!c.default_board)errors.push(`${c.label}: choose a default Pinterest board`);
  }
  return errors;
}
