import { it,expect } from 'vitest';
import { parseTopics,planWeek } from '../lib/planner';

const topics=parseTopics('Visual aid planning | visual aid printing | RX\nFounder branding lessons | pharma branding | Founder\nLucknow visual aid guide | lucknow visual aid | Local');
const video1={id:'v1',type:'video',width:1080,height:1920,duration:120,name:'one.mp4'};
const video2={id:'v2',type:'video',width:1080,height:1920,duration:90,name:'two.mp4'};
const image={id:'i1',type:'image',width:1080,height:1080,duration:0,name:'one.jpg'};

it('parses weekly topic lines with keyword and notes',()=>{
  expect(topics).toHaveLength(3);
  expect(topics[0]).toMatchObject({topic:'Visual aid planning',primary_keyword:'visual aid printing',notes:'RX'});
});

it('creates deterministic slots and spacing-friendly dates',()=>{
  const channels=[{id:'ig',platform:'instagram',label:'IG',persona:'rx_national',enabled:true,posts_per_week:3,time_slots:['10:00','16:00']}];
  const a=planWeek({week_start:'2026-09-21',topics,media:[image],channels,seed:'same'});
  const b=planWeek({week_start:'2026-09-21',topics,media:[image],channels,seed:'same'});
  expect(a.slots).toEqual(b.slots);
  expect(a.slots).toHaveLength(3);
  expect(new Set(a.slots.map(s=>s.topic.id)).size).toBeGreaterThan(1);
});

it('does not reuse the same video across YouTube channels in one week',()=>{
  const channels=[
    {id:'yt1',platform:'youtube',label:'YT 1',persona:'rx_national',enabled:true,posts_per_week:1,time_slots:['10:00']},
    {id:'yt2',platform:'youtube',label:'YT 2',persona:'personal',enabled:true,posts_per_week:1,time_slots:['11:00']}
  ];
  const plan=planWeek({week_start:'2026-09-21',topics,media:[video1,video2],channels,seed:'yt'});
  expect(plan.slots.map(s=>s.media_ids[0]).sort()).toEqual(['v1','v2']);
});

it('builds every YouTube slot and reports media that can be added later',()=>{
  const channels=[{id:'yt',platform:'youtube',label:'YT',persona:'rx_national',enabled:true,posts_per_week:3,time_slots:['10:00']}];
  const plan=planWeek({week_start:'2026-09-21',topics,media:[video1],channels,seed:'short'});
  expect(plan.slots).toHaveLength(3);
  expect(plan.slots.filter(slot=>slot.format==='pending')).toHaveLength(2);
  expect(plan.shortfalls[0]).toMatchObject({channel_id:'yt',filled:1,needed:2,reason:'media can be added later'});
});

it('builds a week with no media and keeps media-required slots pending',()=>{
  const channels=[
    {id:'fb',platform:'facebook',label:'Facebook',persona:'rx_national',enabled:true,posts_per_week:2,time_slots:['10:00']},
    {id:'ig',platform:'instagram',label:'Instagram',persona:'rx_national',enabled:true,posts_per_week:2,time_slots:['11:00']},
    {id:'yt',platform:'youtube',label:'YouTube',persona:'rx_national',enabled:true,posts_per_week:2,time_slots:['12:00']}
  ];
  const plan=planWeek({week_start:'2026-09-21',topics,media:[],channels,seed:'no-media'});
  expect(plan.slots).toHaveLength(6);
  expect(plan.slots.filter(slot=>slot.format==='text')).toHaveLength(2);
  expect(plan.slots.filter(slot=>slot.format==='pending')).toHaveLength(4);
});

it('uses date-tagged media only on its selected posting date',()=>{
  const channels=[{id:'ig',platform:'instagram',label:'Instagram',persona:'rx_national',enabled:true,posts_per_week:2,time_slots:['11:00']}];
  const dated={...image,id:'dated',posting_date:'2026-09-22'};
  const plan=planWeek({week_start:'2026-09-21',topics,media:[dated],channels,seed:'dated-media'});
  expect(plan.slots.find(slot=>slot.slot_at.startsWith('2026-09-21')).format).toBe('pending');
  expect(plan.slots.find(slot=>slot.slot_at.startsWith('2026-09-22')).media_ids).toEqual(['dated']);
});

it('assigns at least four different UP cities to a local weekly channel',()=>{
  const channels=[{id:'local-fb',brand:'visualaid_lucknow',platform:'facebook',label:'VA Lucknow',persona:'lucknow_local',enabled:true,posts_per_week:8,time_slots:['10:00']}];
  const plan=planWeek({week_start:'2026-09-21',topics,media:[image],channels,seed:'local-cities'});
  expect(new Set(plan.slots.map(slot=>slot.geo)).size).toBeGreaterThanOrEqual(4);
  expect(plan.slots.every(slot=>slot.geo)).toBe(true);
});
