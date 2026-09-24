import { neon } from '@neondatabase/serverless';
import { randomUUID,createHash } from 'node:crypto';
let initPromise;
export function databaseUrl(){return process.env.DATABASE_URL||process.env.DATABASE_URL_UNPOOLED||process.env.POSTGRES_URL||process.env.DATABSE_DATABASE_URL_UNPOOLED||process.env.DATABSE_POSTGRES_URL||process.env.DATABSE_POSTGRES_PRISMA_URL||process.env.DATABSE_POSTGRES_URL_NO_SSL||process.env.DATABSEE_DATABASE_URL_UNPOOLED||process.env.DATABSEE_POSTGRES_URL||process.env.DATABSEE_POSTGRES_PRISMA_URL||process.env.DATABSEE_POSTGRES_URL_NO_SSL;}
function db(){const url=databaseUrl();if(!url)throw new Error('Connect a Neon Postgres database in Vercel. Set DATABASE_URL or use the connected DATABSE/DATABSEE Neon variables.');return neon(url);}
export async function init(){
  if(!initPromise)initPromise=(async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS rx_jobs (id text PRIMARY KEY, data jsonb NOT NULL, version integer NOT NULL DEFAULT 0, lock_token text, lock_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS rx_weeks (id text PRIMARY KEY, week_start date NOT NULL, topics jsonb NOT NULL, status text NOT NULL, stats jsonb NOT NULL DEFAULT '{}'::jsonb, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS rx_media (id text PRIMARY KEY, week_id text, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS rx_research (id text PRIMARY KEY, data jsonb NOT NULL, expires_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS topic_research (id text PRIMARY KEY, data jsonb NOT NULL, expires_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS ai_usage (id text PRIMARY KEY, job_id text, model text NOT NULL, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0, total_tokens integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS rx_settings (id text PRIMARY KEY, data jsonb NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS rx_limits (id text PRIMARY KEY, count integer NOT NULL DEFAULT 0, reset_at timestamptz NOT NULL)`;
  })().catch(e=>{initPromise=undefined;throw e;});return initPromise;
}
export async function listJobs(limit=2000){await init();const rows=await db()`SELECT data FROM rx_jobs ORDER BY updated_at DESC LIMIT ${limit}`;return rows.map(r=>r.data);}
export async function getJob(id){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE id=${id}`;if(!rows.length)throw Object.assign(new Error('Job not found.'),{status:404});return rows[0].data;}
export async function createJob(data){await init();await db()`INSERT INTO rx_jobs(id,data) VALUES(${data.id},${JSON.stringify(data)}::jsonb)`;return data;}
export async function settings(){await init();const rows=await db()`SELECT data FROM rx_settings WHERE id='connections'`;return rows[0]?.data??{accounts:[],options:[],workspaces:[]};}
export async function saveSettings(value){await init();await db()`INSERT INTO rx_settings(id,data) VALUES('connections',${JSON.stringify(value)}::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`;}
export async function getSetting(id,fallback=null){await init();const rows=await db()`SELECT data FROM rx_settings WHERE id=${id}`;return rows[0]?.data??fallback;}
export async function saveSetting(id,value){await init();await db()`INSERT INTO rx_settings(id,data) VALUES(${id},${JSON.stringify(value)}::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`;}
export async function listWeeks(){await init();const rows=await db()`SELECT id,week_start,topics,status,stats,data,created_at,updated_at FROM rx_weeks ORDER BY week_start DESC LIMIT 30`;return rows.map(r=>({...r.data,id:r.id,week_start:r.week_start,topics:r.topics,status:r.status,stats:r.stats,created_at:r.created_at,updated_at:r.updated_at}));}
export async function getWeek(id){await init();const rows=await db()`SELECT id,week_start,topics,status,stats,data,created_at,updated_at FROM rx_weeks WHERE id=${id}`;if(!rows.length)throw Object.assign(new Error('Week not found.'),{status:404});const r=rows[0];return {...r.data,id:r.id,week_start:r.week_start,topics:r.topics,status:r.status,stats:r.stats,created_at:r.created_at,updated_at:r.updated_at};}
export async function createWeek(data){await init();await db()`INSERT INTO rx_weeks(id,week_start,topics,status,stats,data) VALUES(${data.id},${data.week_start},${JSON.stringify(data.topics)}::jsonb,${data.status},${JSON.stringify(data.stats??{})}::jsonb,${JSON.stringify(data)}::jsonb)`;return data;}
export async function saveWeek(data){await init();await db()`UPDATE rx_weeks SET topics=${JSON.stringify(data.topics)}::jsonb,status=${data.status},stats=${JSON.stringify(data.stats??{})}::jsonb,data=${JSON.stringify(data)}::jsonb,updated_at=now() WHERE id=${data.id}`;return data;}
export async function createJobs(rows){await init();const sql=db();for(const data of rows)await sql`INSERT INTO rx_jobs(id,data) VALUES(${data.id},${JSON.stringify(data)}::jsonb) ON CONFLICT(id) DO NOTHING`;return rows;}
export async function upsertImportedJobs(rows){await init();const sql=db(),out=[];for(const data of rows){const existing=await sql`SELECT id,data FROM rx_jobs WHERE data->>'external_id'=${data.external_id} OR id=${data.id} LIMIT 1`;if(existing[0]?.data?.delivery){out.push({id:existing[0].id,external_id:data.external_id,action:'skipped',reason:'delivery exists'});continue;}if(existing.length){await withJob(existing[0].id,async(job)=>{Object.assign(job,{...data,id:job.id,created_at:job.created_at??data.created_at,updated_at:data.updated_at});});out.push({id:existing[0].id,external_id:data.external_id,action:'updated'});}else{await sql`INSERT INTO rx_jobs(id,data) VALUES(${data.id},${JSON.stringify(data)}::jsonb)`;out.push({id:data.id,external_id:data.external_id,action:'created'});}}return out;}
export async function archiveImportedRows(externalIds){await init();const ids=[...new Set(externalIds)].filter(Boolean);for(const externalId of ids){const rows=await db()`SELECT id,data FROM rx_jobs WHERE data->>'external_id'=${externalId}`;for(const row of rows){if(row.data.delivery||row.data.source!=='calendar_import'||row.data.import_mode==='daily_combined')continue;await withJob(row.id,async(job)=>{job.status='archived';job.archived_by_import_group=true;});}}}
export async function listWeekJobs(weekId){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE data->>'week_id'=${weekId} ORDER BY data->>'slot_at' ASC`;return rows.map(r=>r.data);}
export async function saveMediaPool(weekId,media){await init();await db()`INSERT INTO rx_media(id,week_id,data) VALUES(${`pool-${weekId}`},${weekId},${JSON.stringify(media)}::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`;return media;}
export async function getMediaPool(weekId){await init();const rows=await db()`SELECT data FROM rx_media WHERE id=${`pool-${weekId}`}`;return rows[0]?.data??[];}
export async function listRunnableJobs(limit=6){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE COALESCE(data->>'status','') IN ('queued','researching','writing','reviewing','approved','importing','scheduling','processing') ORDER BY updated_at ASC LIMIT ${limit}`;return rows.map(r=>r.data);}
export async function claimMaintenance(name,seconds=86400){await init();const key=`maintenance:${name}`;const rows=await db()`INSERT INTO rx_limits(id,count,reset_at) VALUES(${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(id) DO UPDATE SET count=rx_limits.count+1,reset_at=now()+${seconds}*interval '1 second' WHERE rx_limits.reset_at<now() RETURNING id`;return rows.length>0;}
export async function listRetentionJobs(days=7,limit=100){await init();const rows=await db()`SELECT id,data FROM rx_jobs WHERE (COALESCE(data->>'status','')='archived' AND updated_at<now()-${days}*interval '1 day') OR (COALESCE(data->>'status','')='submitted' AND COALESCE(NULLIF(data#>>'{delivery,started_at}','')::timestamptz,updated_at)<now()-${days}*interval '1 day') OR (COALESCE(data->>'status','')='scheduled' AND COALESCE(NULLIF(data#>>'{delivery,scheduled_at}','')::timestamptz,updated_at)<now()-${days}*interval '1 day') ORDER BY updated_at ASC LIMIT ${limit}`;return rows.map(r=>({id:r.id,data:r.data}));}
export async function deleteRetentionJob(id){await init();const sql=db();await sql`DELETE FROM ai_usage WHERE job_id=${id}`;const rows=await sql`DELETE FROM rx_jobs WHERE id=${id} RETURNING id`;return rows.length>0;}
export async function listOrphanMediaPools(days=7,limit=50){await init();const rows=await db()`SELECT m.id,m.data FROM rx_media m WHERE m.created_at<now()-${days}*interval '1 day' AND NOT EXISTS (SELECT 1 FROM rx_jobs j WHERE j.data->>'week_id'=m.week_id) ORDER BY m.created_at ASC LIMIT ${limit}`;return rows.map(r=>({id:r.id,data:r.data}));}
export async function deleteMediaPool(id){await init();const rows=await db()`DELETE FROM rx_media WHERE id=${id} RETURNING id`;return rows.length>0;}
export async function cleanupExpiredRows(days=7){await init();const sql=db();const research=await sql`DELETE FROM rx_research WHERE expires_at<now() RETURNING id`,topics=await sql`DELETE FROM topic_research WHERE expires_at<now() RETURNING id`,usage=await sql`DELETE FROM ai_usage WHERE created_at<now()-${days}*interval '1 day' RETURNING id`,weeks=await sql`DELETE FROM rx_weeks w WHERE w.updated_at<now()-${days}*interval '1 day' AND NOT EXISTS (SELECT 1 FROM rx_jobs j WHERE j.data->>'week_id'=w.id) RETURNING id`;return {research:research.length,topics:topics.length,usage:usage.length,weeks:weeks.length};}
export function researchKey({topic,primary_keyword,language}){return createHash('sha256').update(`${topic}|${primary_keyword}|${language}`).digest('hex');}
export async function getResearchCached(input){await init();const key=researchKey(input);const rows=await db()`SELECT data FROM rx_research WHERE id=${key} AND expires_at>now()`;return rows[0]?.data??null;}
export async function saveResearchCached(input,value){await init();const key=researchKey(input);await db()`INSERT INTO rx_research(id,data,expires_at) VALUES(${key},${JSON.stringify(value)}::jsonb,now()+interval '7 days') ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at,updated_at=now()`;return value;}
export async function logAiUsage({job_id='',model,input_tokens=0,output_tokens=0,total_tokens=0}){await init();await db()`INSERT INTO ai_usage(id,job_id,model,input_tokens,output_tokens,total_tokens) VALUES(${randomUUID()},${job_id},${model},${input_tokens},${output_tokens},${total_tokens})`;}
/** A database lease serializes mutations across Vercel instances; CAS prevents stale writes. */
export async function withJob(id,fn){
  await init();const sql=db(),token=randomUUID();
  const rows=await sql`UPDATE rx_jobs SET lock_token=${token},lock_until=now()+interval '310 seconds' WHERE id=${id} AND (lock_until IS NULL OR lock_until<now()) RETURNING data,version`;
  if(!rows.length)throw Object.assign(new Error('Job is busy or missing. Refresh its status in a moment.'),{status:409});
  let job=rows[0].data;let version=rows[0].version;
  const save=async()=>{
    job.updated_at=new Date().toISOString();
    const result=await sql`UPDATE rx_jobs SET data=${JSON.stringify(job)}::jsonb,version=version+1,updated_at=now() WHERE id=${id} AND lock_token=${token} AND version=${version} RETURNING version`;
    if(!result.length)throw new Error('Job lease lost. Refresh before continuing.');version=result[0].version;
  };
  try{await fn(job,save);await save();return job;}
  finally{await sql`UPDATE rx_jobs SET lock_token=NULL,lock_until=NULL WHERE id=${id} AND lock_token=${token}`;}
}
/** Shared fixed windows protect login and Publer across serverless instances. */
export async function rateLimit(name,limit,seconds){
  await init();const key=createHash('sha256').update(name).digest('hex');
  const rows=await db()`INSERT INTO rx_limits(id,count,reset_at) VALUES(${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rx_limits.reset_at<now() THEN 1 ELSE rx_limits.count+1 END, reset_at=CASE WHEN rx_limits.reset_at<now() THEN now()+${seconds}*interval '1 second' ELSE rx_limits.reset_at END RETURNING count,reset_at`;
  if(rows[0].count>limit)throw Object.assign(new Error('Request limit reached. Please wait and retry.'),{status:429});
}
