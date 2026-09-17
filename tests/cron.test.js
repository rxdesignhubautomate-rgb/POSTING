import { it,expect,beforeEach,vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({listRunnableJobs:vi.fn(),rateLimit:vi.fn(),withJob:vi.fn()}));
vi.mock('../lib/db',()=>({listRunnableJobs:mocks.listRunnableJobs,rateLimit:mocks.rateLimit,withJob:mocks.withJob,getResearchCached:vi.fn(),saveResearchCached:vi.fn()}));
vi.mock('../lib/ai',()=>({researchStep:vi.fn(),generatePlatform:vi.fn(),audit:vi.fn()}));
vi.mock('../lib/publer',()=>({publer:vi.fn()}));
import { POST } from '../app/api/cron/tick/route';

beforeEach(()=>{vi.clearAllMocks();process.env.CRON_SECRET='c'.repeat(40);mocks.listRunnableJobs.mockResolvedValue([]);});
const req=secret=>new NextRequest('https://app.example/api/cron/tick',{headers:{authorization:`Bearer ${secret}`}});

it('rejects missing or wrong cron secret',async()=>{
  expect((await POST(req('wrong'))).status).toBe(401);
});

it('processes runnable jobs up to the route limit',async()=>{
  mocks.listRunnableJobs.mockResolvedValue([{id:'a'},{id:'b'}]);
  mocks.withJob.mockImplementation(async(id,fn)=>{const job={id,status:'awaiting_approval',brief:{platforms:['facebook']},media:[],content:{}};await fn(job,vi.fn());return job;});
  const response=await POST(req(process.env.CRON_SECRET));
  expect(response.status).toBe(200);
  expect(mocks.listRunnableJobs).toHaveBeenCalledWith(6);
});
