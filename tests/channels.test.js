import { it,expect } from 'vitest';
import { defaultChannels,normalizeChannels,validateChannelMappings } from '../lib/channels';
import { validate } from '../lib/validate';
import platforms from '../config/platforms.json';

const cfg={platforms,env:{IG_HASHTAGS_IN_COMMENT:true}};
const base={topic:'Visual aid',primary_keyword:'visual aid printing',language:'hinglish',cta_url:'https://rxdesignhub.com',platforms:['facebook'],notes:'',targets:{},boards:{}};

it('loads channel persona defaults',()=>{
  const settings=normalizeChannels(defaultChannels());
  expect(settings.personas.rx_national.cta_url).toContain('rxdesignhub.com');
  expect(settings.channels.some(c=>c.platform==='youtube')).toBe(true);
});

it('requires mapped accounts for enabled channels when requested',()=>{
  const errors=validateChannelMappings(defaultChannels(),{requireAccount:true});
  expect(errors.some(e=>e.includes('map a Publer account'))).toBe(true);
});

it('applies persona validation rules',()=>{
  const personal={...base,persona_key:'personal',cta_url:'https://rxdesignhub.com'};
  expect(validate('facebook',{text:'visual aid printing founder post https://rxdesignhub.com #One #Two'},personal,cfg).join(' ')).toMatch(/personal CTA/i);
  const local={...base,persona_key:'lucknow_local'};
  expect(validate('facebook',{text:'visual aid printing for India brands https://rxdesignhub.com #One #Two'},local,cfg).join(' ')).toMatch(/Lucknow/i);
});
