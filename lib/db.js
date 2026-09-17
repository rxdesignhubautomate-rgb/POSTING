import { neon } from '@neondatabase/serverless';
import { randomUUID,createHash } from 'node:crypto';
let initPromise;
function db(){const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;if(!url)throw new Error('Connect a Neon Postgres database in Vercel and set DATABASE_URL.');return neon(url);}
export async function init(){
  if(!initPromise)initPromise=(async()=>{
    const sql=db();
    await sql`CREATE TABLE IF NOT EXISTS rx_jobs (id text PRIMARY KEY, data jsonb NOT NULL, version integer NOT NULL DEFAULT 0, lock_token text, lock_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS rx_settings (id text PRIMARY KEY, data jsonb NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS rx_limits (id text PRIMARY KEY, count integer NOT NULL DEFAULT 0, reset_at timestamptz NOT NULL)`;
  })().catch(e=>{initPromise=undefined;throw e;});return initPromise;
}
export async function listJobs(){await init();const rows=await db()`SELECT data FROM rx_jobs ORDER BY updated_at DESC LIMIT 200`;return rows.map(r=>r.data);}
export async function getJob(id){await init();const rows=await db()`SELECT data FROM rx_jobs WHERE id=${id}`;if(!rows.length)throw Object.assign(new Error('Job not found.'),{status:404});return rows[0].data;}
export async function createJob(data){await init();await db()`INSERT INTO rx_jobs(id,data) VALUES(${data.id},${JSON.stringify(data)}::jsonb)`;return data;}
export async function settings(){await init();const rows=await db()`SELECT data FROM rx_settings WHERE id='connections'`;return rows[0]?.data??{accounts:[],options:[],workspaces:[]};}
export async function saveSettings(value){await init();await db()`INSERT INTO rx_settings(id,data) VALUES('connections',${JSON.stringify(value)}::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`;}
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
