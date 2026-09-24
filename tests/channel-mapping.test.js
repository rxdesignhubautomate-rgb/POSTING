import { describe,it,expect } from 'vitest';
import defaults from '../config/channels.json';
import { autoMapChannels } from '../lib/channelMapping';

const accounts=[
  {id:'fb-rx',provider:'facebook',name:'RX Design Hub'},
  {id:'fb-sk',provider:'facebook',name:'Shubham Kumar'},
  {id:'fb-va',provider:'facebook',name:'Visual Aid Pharma Lucknow'},
  {id:'ig-rx',provider:'instagram',name:'Rx Design Hub | Pharma Visual Aid'},
  {id:'ig-sk',provider:'instagram',name:'Shubham Kumar'},
  {id:'ig-va',provider:'instagram',name:'Pharma Visual Aid in Lucknow'},
  {id:'yt-rx',provider:'youtube',name:'RX DESIGN HUB'},
  {id:'yt-sk',provider:'youtube',name:'Shubham Kumar'},
  {id:'google-va',provider:'google',name:'Rx Design Hub - Vikas Nagar, Lucknow, Uttar Pradesh, IN'},
  {id:'x-rx',provider:'twitter',name:'RX Design Hub'}
];

describe('automatic brand account mapping',()=>{
  it('maps every requested channel to the correct profile',()=>{
    const result=autoMapChannels(structuredClone(defaults),accounts),byId=Object.fromEntries(result.channels.map(channel=>[channel.id,channel.account_id]));
    expect(byId).toMatchObject({facebook_rx:'fb-rx',instagram_rx:'ig-rx',youtube_rx:'yt-rx',twitter_future:'x-rx',facebook_shubham:'fb-sk',instagram_personal:'ig-sk',youtube_shubham:'yt-sk',facebook_lucknow:'fb-va',instagram_lucknow:'ig-va',google_visualaid:'google-va'});
  });
  it('preserves an explicit manual mapping',()=>{
    const settings=structuredClone(defaults),channel=settings.channels.find(item=>item.id==='facebook_rx');channel.account_id='fb-sk';channel.mapping_source='manual';
    expect(autoMapChannels(settings,accounts).channels.find(item=>item.id==='facebook_rx').account_id).toBe('fb-sk');
  });
  it('repairs an earlier automatic mapping after accounts change',()=>{
    const settings=structuredClone(defaults),channel=settings.channels.find(item=>item.id==='facebook_rx');channel.account_id='missing';channel.mapping_source='auto';
    expect(autoMapChannels(settings,accounts).channels.find(item=>item.id==='facebook_rx').account_id).toBe('fb-rx');
  });
});
