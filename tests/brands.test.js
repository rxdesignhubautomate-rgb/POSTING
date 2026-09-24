import { it,expect } from 'vitest';
import defaults from '../config/channels.json';
import { brandKeys,brandPlatforms,normalizeChannels,channelsForBrand,scopeBriefToBrand,brandsOfJob,jobInBrand } from '../lib/channels';

it('ships three brands and assigns every channel',()=>{expect(brandKeys).toEqual(['rx_global','visualaid_lucknow','shubham']);expect(defaults.channels.every(c=>brandKeys.includes(c.brand))).toBe(true);});
it('fills missing and invalid saved channel brands',()=>{const value=structuredClone(defaults);delete value.channels[0].brand;value.channels[1].brand='old';const normalized=normalizeChannels(value);expect(normalized.channels[0].brand).toBe('rx_global');expect(normalized.channels[1].brand).toBe('shubham');});
it('filters channels by brand',()=>{expect(channelsForBrand(defaults,'visualaid_lucknow').every(c=>c.brand==='visualaid_lucknow')).toBe(true);expect(channelsForBrand(defaults,'all')).toHaveLength(defaults.channels.length);});
it('keeps each dashboard limited to its owned platforms',()=>{
  for(const [brand,platforms] of Object.entries(brandPlatforms))expect([...new Set(channelsForBrand(defaults,brand).map(c=>c.platform))]).toEqual(platforms);
});
it('repairs a stale brief using only mapped accounts from its brand',()=>{
  const settings=structuredClone(defaults);
  settings.channels.find(c=>c.id==='facebook_rx').account_id='rx-fb';
  settings.channels.find(c=>c.id==='facebook_shubham').account_id='sk-fb';
  settings.channels.find(c=>c.id==='instagram_rx').account_id='rx-ig';
  const brief={platforms:['facebook','linkedin','google'],targets:{facebook:['rx-fb','sk-fb'],linkedin:['sk-li'],google:['va-google']},boards:{'old-pin':'board'}};
  expect(scopeBriefToBrand(brief,'rx_global',settings)).toMatchObject({platforms:['facebook','instagram','youtube','twitter'],targets:{facebook:['rx-fb'],instagram:['rx-ig']},boards:{}});
});
it('resolves brands from direct brand, channel and multiple channel ids',()=>{expect(brandsOfJob({brand:'shubham'},defaults)).toEqual(['shubham']);expect(brandsOfJob({channel_id:'facebook_lucknow'},defaults)).toEqual(['visualaid_lucknow']);expect(new Set(brandsOfJob({channel_ids:['facebook_rx','linkedin_shubham']},defaults))).toEqual(new Set(['rx_global','shubham']));});
it('resolves target accounts and persona fallback',()=>{const settings=structuredClone(defaults);settings.channels.find(c=>c.id==='facebook_lucknow').account_id='acct-va';expect(brandsOfJob({brief:{targets:{facebook:['acct-va']}}},settings)).toEqual(['visualaid_lucknow']);expect(brandsOfJob({brief:{persona_key:'personal'}},settings)).toEqual(['shubham']);});
it('all dashboard includes every job',()=>{expect(jobInBrand({},'all',defaults)).toBe(true);expect(jobInBrand({brand:'shubham'},'rx_global',defaults)).toBe(false);});
