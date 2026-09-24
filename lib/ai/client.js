import { z } from 'zod';

function stripJson(text){return String(text).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');}
function modelName(fast=false){return (fast&&(process.env.AI_MODEL_FAST||process.env.OPENAI_MODEL_FAST))||process.env.AI_MODEL||process.env.OPENAI_MODEL||'gpt-5.6-terra';}

export async function callJson(schema,system,user,{fast=false,web=false,images=[]}={}){
  if(!process.env.OPENAI_API_KEY)throw new Error('Add OPENAI_API_KEY in Vercel environment variables.');
  const parsedSchema=schema instanceof z.ZodType?schema:z.object(schema);
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    const prompt=attempt?`${user}\n\nPrevious JSON failed validation: ${lastError}. Return corrected JSON only.`:user;
    const body={model:modelName(fast),instructions:system,input:[{role:'user',content:[...images,{type:'input_text',text:prompt}]}],max_output_tokens:6500,...(web?{tools:[{type:'web_search_preview'}]}:{})};
    const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await res.text();let data;try{data=JSON.parse(raw);}catch{data={raw};}
    if(!res.ok){if([429,500,502,503,504].includes(res.status)&&attempt===0){await new Promise(r=>setTimeout(r,800));continue;}throw new Error(JSON.stringify(data.error??data));}
    const text=data.output_text??(data.output??[]).flatMap(o=>o.content??[]).filter(c=>c.type==='output_text'||c.type==='text').map(c=>c.text).join('\n');
    try{return parsedSchema.parse(JSON.parse(stripJson(text)));}
    catch(e){lastError=e.message;}
  }
  throw new Error(`AI JSON validation failed: ${lastError}`);
}

export { modelName };
