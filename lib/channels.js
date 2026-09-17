import { z } from 'zod';
import defaults from '../config/channels.json';

export const personaKeys=Object.keys(defaults.personas);
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
  platform:z.enum(['instagram','facebook','linkedin','youtube','google','pinterest','twitter','threads','tiktok']),
  label:z.string().min(2),
  persona:z.enum(personaKeys),
  enabled:z.boolean().default(true),
  account_id:z.string().optional().default(''),
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
  personas:z.record(personaSchema),
  channels:z.array(channelSchema)
});
export function defaultChannels(){return structuredClone(defaults);}
export function normalizeChannels(value){
  const merged={...defaultChannels(),...(value??{})};
  merged.personas={...defaults.personas,...(value?.personas??{})};
  merged.company_facts={...defaults.company_facts,...(value?.company_facts??{})};
  merged.channels=(value?.channels?.length?value.channels:defaults.channels).map(c=>channelSchema.parse(c));
  return channelsSettingsSchema.parse(merged);
}
export function enabledChannels(settings){
  return normalizeChannels(settings).channels.filter(c=>c.enabled);
}
export function personaFor(settings,key){
  return normalizeChannels(settings).personas[key]??defaults.personas.rx_national;
}
export function validateChannelMappings(settings,{requireAccount=false}={}){
  const cfg=normalizeChannels(settings),errors=[];
  for(const c of cfg.channels.filter(x=>x.enabled)){
    if(!cfg.personas[c.persona])errors.push(`${c.label}: missing persona`);
    if(requireAccount&&!c.account_id)errors.push(`${c.label}: map a Publer account`);
    if(c.platform==='pinterest'&&!c.default_board)errors.push(`${c.label}: choose a default Pinterest board`);
  }
  return errors;
}
