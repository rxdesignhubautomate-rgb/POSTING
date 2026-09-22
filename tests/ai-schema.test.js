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

it('automatically repairs unsupported production and camera claims before approval',async()=>{
  process.env.OPENAI_API_KEY='test';
  const sample=await readFile(new URL('../public/sample.png',import.meta.url));
  let modelCall=0;
  global.fetch=vi.fn(async(url)=>{
    if(String(url).startsWith('https://blob.example/'))return new Response(sample,{status:200,headers:{'Content-Type':'image/png'}});
    modelCall++;
    const value=modelCall===1
      ?{approved:false,issues:['Pinterest and YouTube claim Spot UV, foil finish, and macro tilt shots not supported by the image.']}
      :modelCall===2
        ?{pinterest:{title:'Visual aid printing sample',description:'Visual aid printing sample with a clear page layout, readable hierarchy, and neutral paper presentation. https://rxdesignhub.com',alt_texts:['Printed visual aid sample showing layout and paper details.'],claims:[]}}
        :{approved:true,issues:[]};
    return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(value),output:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const { audit }=await import('../lib/ai');
  const job={
    brief:{topic:'Visual aid printing',primary_keyword:'visual aid printing',language:'english',platforms:['pinterest'],cta_url:'https://rxdesignhub.com',notes:'',targets:{},boards:{}},
    media:[{url:'https://blob.example/sample.png',name:'sample.png',type:'image'}],
    research:{facts:[]},
    content:{pinterest:{title:'Spot UV and foil finish',description:'Visual aid printing with macro tilt shots and moving light. https://rxdesignhub.com',alt_texts:['Printed sample.'],claims:[]}}
  };
  await audit(job);
  expect(modelCall).toBe(3);
  expect(job.content.pinterest.description).not.toMatch(/spot uv|foil|macro|tilt/i);
  expect(job.audit).toMatchObject({approved:true,auto_repaired_issues:expect.arrayContaining([expect.stringContaining('Spot UV')])});
});

it('checks account-specific cards that fall back to shared platform copy',async()=>{
  process.env.OPENAI_API_KEY='test';
  const sample=await readFile(new URL('../public/sample.png',import.meta.url));
  global.fetch=vi.fn(async(url)=>String(url).startsWith('https://blob.example/')
    ?new Response(sample,{status:200,headers:{'Content-Type':'image/png'}})
    :new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({approved:true,issues:[]}),output:[]}),{status:200,headers:{'Content-Type':'application/json'}}));
  const { auditPlatform }=await import('../lib/ai');
  const job={
    brief:{topic:'Visual aid printing',primary_keyword:'visual aid printing',language:'english',platforms:['pinterest'],cta_url:'https://rxdesignhub.com',notes:'',targets:{pinterest:['pin-1']},boards:{}},
    media:[{url:'https://blob.example/sample.png',name:'sample.png',type:'image'}],research:{facts:[]},
    content:{pinterest:{title:'Visual aid printing sample',description:'Visual aid printing sample with clear layout and paper details. https://rxdesignhub.com',alt_texts:['Printed visual aid sample showing layout and paper details.'],claims:[]}}
  };
  await expect(auditPlatform(job,'pinterest:pin-1')).resolves.toMatchObject({approved:true,issues:[]});
});

it('repairs platform validation errors introduced by automatic compliance repair',async()=>{
  process.env.OPENAI_API_KEY='test';
  const validDescription=['pharma','visual','aid','printing',...Array(195).fill('practical'),'https://rxdesignhub.com','#PrintDesign','#VisualAid','#PharmaBranding'].join(' ');
  let modelCall=0;
  global.fetch=vi.fn(async()=>{
    modelCall++;
    const value=modelCall===1
      ?{approved:false,issues:['Remove unsupported clinical references.']}
      :modelCall===2
        ?{youtube:{title:'pharma visual aid printing guide',description:'pharma visual aid printing with neutral layout. https://rxdesignhub.com #PrintDesign #VisualAid #PharmaBranding',tags:[],claims:[]}}
        :modelCall===3
          ?{title:'pharma visual aid printing guide',description:validDescription,tags:[],claims:[]}
          :{approved:true,issues:[]};
    return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(value),output:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const { audit }=await import('../lib/ai');
  const job={brief:{topic:'Visual aid printing',primary_keyword:'pharma visual aid printing',language:'english',platforms:['youtube'],cta_url:'https://rxdesignhub.com',notes:'',targets:{},boards:{}},media:[],research:{facts:[]},content:{youtube:{title:'pharma visual aid printing',description:validDescription,tags:[],claims:[]}}};
  await audit(job);
  expect(modelCall).toBe(4);
  expect(job.content.youtube.description.split(/\s+/)).toHaveLength(203);
  expect(job.audit.approved).toBe(true);
});
