import { describe,it,expect } from 'vitest';
import { combineValidImports,parseCsv,validateImportRows,autoMatchMedia,autoMatchMediaByDate,exportImportRows,toCsv,IMPORT_HEADERS } from '../lib/calendarImport';
import { defaultChannels } from '../lib/channels';

const header=IMPORT_HEADERS.join(',');
const base='rx-1,2026-10-05T09:30:00+05:30,li_shubham,blend_visualaid,Text post,Printed inputs still matter,pharma field marketing India,"what is visual aid in pharma, pharma detailing aid",Informational,"Digital detailing is growing, and print still earns desk time.","1 image, 3 short paragraphs",https://rxdesignhub.com,#PharmaMarketing,English,Answer the query in the first line,No prices,image,no';

describe('calendar import parsing and validation',()=>{
  it('parses quoted commas without splitting authored fields',()=>{
    const rows=parseCsv(`${header}\n${base}`);
    expect(rows[0].secondary_keywords).toContain('pharma detailing aid');
    expect(rows[0].hook).toContain('Digital detailing is growing, and print');
  });

  it('accepts import slug aliases and builds an idempotent queued job',()=>{
    const report=validateImportRows(parseCsv(`${header}\n${base}`),{settings:defaultChannels(),existingJobs:[],now:new Date('2026-09-18T00:00:00+05:30')});
    expect(report.errors).toEqual([]);
    expect(report.would_create).toBe(1);
    expect(report.valid[0].job).toMatchObject({external_id:'rx-1',channel_id:'linkedin_shubham',persona:'blend_personal_visualaid',status:'queued',source:'calendar_import',week_id:'2026-10-05'});
    expect(report.valid[0].job.brief.notes).toContain('Guardrails: No prices');
  });

  it('detects duplicate external ids, unknown channels, and past dates before writes',()=>{
    const csv=`${header}\n${base}\n${base.replace('li_shubham','missing_channel')}`;
    const report=validateImportRows(parseCsv(csv),{settings:defaultChannels(),existingJobs:[],now:new Date('2026-10-06T00:00:00+05:30')});
    expect(report.errors.map(e=>e.field)).toEqual(expect.arrayContaining(['external_id','channel_id','slot_at']));
    expect(report.rows_valid).toBe(0);
  });

  it('rejects video formats on Google Business',()=>{
    const row=base.replace('li_shubham','gbp_rx').replace('Text post','Reel').replace(',image,no',',video,no');
    const report=validateImportRows(parseCsv(`${header}\n${row}`),{settings:defaultChannels(),existingJobs:[],now:new Date('2026-09-18T00:00:00+05:30')});
    expect(report.errors.some(e=>e.message.includes('Google Business cannot use video'))).toBe(true);
  });

  it('treats existing external ids as updates and delivered jobs as skips',()=>{
    const existing={id:'calendar-rx-1',external_id:'rx-1',delivery:{job_id:'publer'},brief:{platforms:['linkedin']}};
    const report=validateImportRows(parseCsv(`${header}\n${base}`),{settings:defaultChannels(),existingJobs:[existing],now:new Date('2026-09-18T00:00:00+05:30')});
    expect(report.would_update).toBe(0);
    expect(report.would_skip).toBe(1);
  });

  it('combines all rows on one date into one editable multi-platform job',()=>{
    const second=base.replace('rx-1','rx-2').replace('li_shubham','ig_rx').replace('Text post','Static').replace('2026-10-05T09:30:00+05:30','2026-10-05T12:00:00+05:30');
    const report=validateImportRows(parseCsv(`${header}\n${base}\n${second}`),{settings:defaultChannels(),existingJobs:[],now:new Date('2026-09-18T00:00:00+05:30')});
    const combined=combineValidImports(report.valid);
    expect(combined).toHaveLength(1);
    expect(combined[0]).toMatchObject({external_id:'rx-daily-2026-10-05',import_mode:'daily_combined'});
    expect(combined[0].brief.platforms.sort()).toEqual(['instagram','linkedin']);
    expect(combined[0].imported_external_ids.sort()).toEqual(['rx-1','rx-2']);
    expect(combined[0].media_idea.summary).toContain('Product photo');
    expect(combined[0].media_idea.shots.length).toBeGreaterThan(2);
  });
});

describe('bulk media assignment and export',()=>{
  it('does not reuse a video across YouTube jobs and does not reuse a file twice on one channel week',()=>{
    const jobs=[
      {id:'a',channel_id:'youtube_rx',persona:'rx_national',format:'short',media_hint:'video',slot_at:'2026-10-05T13:00:00+05:30',brief:{platforms:['youtube'],persona_key:'rx_national'}},
      {id:'b',channel_id:'youtube_shubham',persona:'personal',format:'short',media_hint:'video',slot_at:'2026-10-05T14:00:00+05:30',brief:{platforms:['youtube'],persona_key:'personal'}},
      {id:'c',channel_id:'facebook_rx',persona:'rx_national',format:'photo',media_hint:'image',slot_at:'2026-10-05T15:00:00+05:30',brief:{platforms:['facebook'],persona_key:'rx_national'}},
      {id:'d',channel_id:'facebook_rx',persona:'rx_national',format:'photo',media_hint:'image',slot_at:'2026-10-05T16:00:00+05:30',brief:{platforms:['facebook'],persona_key:'rx_national'}}
    ];
    const pool=[{id:'v1',type:'video',personas:['rx_national']},{id:'v2',type:'video',personas:['personal']},{id:'i1',type:'image',personas:['rx_national']},{id:'i2',type:'image',personas:['rx_national']}];
    const matched=autoMatchMedia(jobs,pool);
    expect(matched.jobs.find(j=>j.id==='a').media_ids).toEqual(['v1']);
    expect(matched.jobs.find(j=>j.id==='b').media_ids).toEqual(['v2']);
    expect(new Set(['c','d'].map(id=>matched.jobs.find(j=>j.id===id).media_ids[0])).size).toBe(2);
  });

  it('assigns one date media across all compatible handles on that date',()=>{
    const jobs=[
      {id:'fb',channel_id:'facebook_rx',format:'photo',media_hint:'image',slot_at:'2026-10-05T10:00:00+05:30',brief:{platforms:['facebook']}},
      {id:'ig',channel_id:'instagram_rx',format:'photo',media_hint:'image',slot_at:'2026-10-05T12:00:00+05:30',brief:{platforms:['instagram']}},
      {id:'li',channel_id:'linkedin_shubham',format:'text',media_hint:'image',slot_at:'2026-10-06T09:00:00+05:30',brief:{platforms:['linkedin']}}
    ];
    const matched=autoMatchMediaByDate(jobs,[{id:'day1',type:'image'},{id:'day2',type:'image'}]);
    expect(matched.jobs.find(j=>j.id==='fb').media_ids).toEqual(['day1']);
    expect(matched.jobs.find(j=>j.id==='ig').media_ids).toEqual(['day1']);
    expect(matched.jobs.find(j=>j.id==='li').media_ids).toEqual(['day2']);
  });

  it('exports the same calendar schema with current status',()=>{
    const rows=exportImportRows([{id:'j1',external_id:'rx-1',slot_at:'2026-10-05T09:30:00+05:30',import_channel_id:'li_shubham',persona:'blend_personal_visualaid',format_original:'Text post',media_hint:'image',date_locked:false,status:'queued',brief:{topic:'Topic',primary_keyword:'keyword',cta_url:'https://rxdesignhub.com',language:'english'}}]);
    const csv=toCsv(rows);
    expect(csv.split(/\r?\n/)[0]).toContain('external_id');
    expect(rows[0]).toMatchObject({external_id:'rx-1',channel_id:'li_shubham',status:'queued'});
  });
});
