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
export async function listJobs(){await init();const rows=await db()`SELECT data FROM rx_jobs ORDER BY updated_at DESC LIMIT 200`;return rows.map(r=>r.data);}
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
export async function listWeekJobs(weekId){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE data->>'week_id'=${weekId} ORDER BY data->>'slot_at' ASC`;return rows.map(r=>r.data);}
export async function listRunnableJobs(limit=6){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE COALESCE(data->>'status','') IN ('queued','researching','writing','reviewing','approved','importing','scheduling','processing') ORDER BY updated_at ASC LIMIT ${limit}`;return rows.map(r=>r.data);}
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
