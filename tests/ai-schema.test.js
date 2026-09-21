import { it,expect,vi } from 'vitest';
import { readFile } from 'node:fs/promises';

it('accepts object-shaped competitor angles from research responses',async()=>{
  process.env.OPENAI_API_KEY='test';
  global.fetch=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({
    search_intent:'Informational',
    keywords:['a','b','c','d','e','f','g','h','i','j'],
    questions:['q1','q2','q3'],
    hashtags:Array.from({length:20},(_,i)=>({tag:`#tag${i}`,rank:i+1,rationale:'relevant'})),
    facts:[{fact:'Fact one',source_url:'https://example.com/1'},{fact:'Fact two',source_url:'https://example.com/2'},{fact:'Fact three',source_url:'https://example.com/3'}],
    competitor_angles:[{angle:'Speed',note:'Same-day proofing'},{angle:'Quality',note:'Paper finish'}]
  }),output:[]}),{status:200,headers:{'Content-Type':'application/json'}}));
  const { researchStep }=await import('../lib/ai');
  const job={brief:{topic:'Visual aid design',primary_keyword:'visual aid',language:'english',notes:''}};
  await researchStep(job);
  expect(job.research.competitor_angles).toEqual(expect.arrayContaining([expect.stringContaining('angle: Speed')]));
});

it('gives the compliance reviewer the uploaded image evidence',async()=>{
  process.env.OPENAI_API_KEY='test';
  const sample=await readFile(new URL('../public/sample.png',import.meta.url));
  let requestBody;
  global.fetch=vi.fn(async(url,options)=>{
    if(String(url).startsWith('https://blob.example/'))return new Response(sample,{status:200,headers:{'Content-Type':'image/png'}});
    requestBody=JSON.parse(options.body);
    return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({approved:true,issues:[]}),output:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const { audit }=await import('../lib/ai');
  const job={
    brief:{topic:'Visual aid printing',primary_keyword:'visual aid printing',language:'english',platforms:['pinterest'],cta_url:'https://rxdesignhub.com',notes:'',targets:{},boards:{}},
    media:[{url:'https://blob.example/sample.png',name:'sample.png',type:'image'}],
    research:{facts:[]},
    content:{pinterest:{title:'Visual aid sample',description:'A practical print example.',alt_texts:['Blue and white pages with a large heading and curved graphic bands.']}}
  };
  await audit(job);
  expect(requestBody.input[0].content.some(item=>item.type==='input_image')).toBe(true);
  expect(job.audit.approved).toBe(true);
});
