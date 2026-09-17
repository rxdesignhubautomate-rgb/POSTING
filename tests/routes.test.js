import { it,expect,vi,beforeEach,afterEach } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({getJob:vi.fn(),withJob:vi.fn(),head:vi.fn(),publer:vi.fn()}));
vi.mock('../lib/db',()=>({getJob:mocks.getJob,withJob:mocks.withJob,settings:vi.fn(),rateLimit:vi.fn()}));
vi.mock('@vercel/blob',()=>({head:mocks.head}));
vi.mock('../lib/publer',()=>({publer:mocks.publer,unwrap:v=>v,jobResult:v=>v,failures:()=>false}));
vi.mock('../lib/ai',()=>({researchStep:vi.fn(),generatePlatform:vi.fn(),audit:vi.fn()}));
import { GET,POST } from '../app/api/jobs/[id]/route';
import { signSession,cookieName } from '../lib/auth';
const original={...process.env};
const brief={topic:'Visual aid printing',primary_keyword:'visual aid printing',language:'english',platforms:['facebook'],cta_url:'https://rxdesignhub.com',notes:'',targets:{},boards:{}};
let stored;
beforeEach(()=>{
  vi.clearAllMocks();process.env.ADMIN_PASSWORD='a-secure-test-password';process.env.SESSION_SECRET='s'.repeat(40);process.env.DEMO_MODE='false';process.env.BLOB_PUBLIC_ORIGIN='https://my.public.blob.vercel-storage.com';
  stored={id:'test',brief:structuredClone(brief),media:[],content:{facebook:{text:'Existing'}},research:{facts:[]},audit:{approved:true},audit_digest:'prior',status:'ready'};
  mocks.getJob.mockImplementation(async()=>stored);mocks.withJob.mockImplementation(async(id,fn)=>{await fn(stored,vi.fn());return stored;});
});
afterEach(()=>{process.env={...original};});
function req(body,{auth=true,origin='https://studio.example'}={}){return new NextRequest('https://studio.example/api/jobs/test',{method:body?'POST':'GET',headers:{origin,...(auth?{cookie:`${cookieName}=${signSession()}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const context={params:Promise.resolve({id:'test'})};
it('does not read database without login',async()=>{expect((await GET(req(null,{auth:false}),context)).status).toBe(401);expect(mocks.getJob).not.toHaveBeenCalled();});
it('rejects cross-origin mutations before the database',async()=>{expect((await POST(req({action:'save'},{origin:'https://evil.example'}),context)).status).toBe(403);expect(mocks.withJob).not.toHaveBeenCalled();});
it('clears research and copy when the topic changes',async()=>{const response=await POST(req({action:'save',brief:{...brief,topic:'Another printing topic'},content:{facebook:{text:'Old text'}}}),context);expect(response.status).toBe(200);expect(stored.research).toBeNull();expect(stored.content).toEqual({});expect(stored.audit_digest).toBeNull();});
it('preserves source research but invalidates approval on copy edits',async()=>{await POST(req({action:'save',brief,content:{facebook:{text:'Edited'}}}),context);expect(stored.research).toEqual({facts:[]});expect(stored.content.facebook.text).toBe('Edited');expect(stored.audit).toBeNull();});
it('rejects external media origins before any fetch/head',async()=>{const response=await POST(req({action:'media',media:{url:'https://evil.example/media/test/file.png',pathname:'media/test/file.png',name:'file.png',type:'image',width:1080,height:1080,duration:0,size:1000}}),context);expect(response.status).toBe(400);expect(mocks.head).not.toHaveBeenCalled();});
it('rejects an image/video content-type mismatch',async()=>{mocks.head.mockResolvedValueOnce({pathname:'media/test/file.png',size:1000,contentType:'video/mp4'});const response=await POST(req({action:'media',media:{url:'https://my.public.blob.vercel-storage.com/media/test/file.png',pathname:'media/test/file.png',name:'file.png',type:'image',width:1080,height:1080,duration:0,size:1000}}),context);expect(response.status).toBe(400);expect(stored.media).toHaveLength(0);});
it('never returns stored raw research continuation messages',async()=>{stored.research_history=[{role:'assistant',content:'raw'}];stored.research_evidence=['raw'];const body=await (await GET(req(),context)).json();expect(body.research_history).toBeUndefined();expect(body.research_evidence).toBeUndefined();});
