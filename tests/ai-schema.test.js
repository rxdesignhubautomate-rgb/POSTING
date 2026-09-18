import { it,expect,vi } from 'vitest';

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
