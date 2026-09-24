import twitterText from 'twitter-text';
import { z } from 'zod';

export const contentSchema=z.object({caption:z.string().optional(),text:z.string().optional(),title:z.string().optional(),description:z.string().optional(),
  tags:z.array(z.string()).optional(),hashtags:z.array(z.string()).optional(),posts:z.array(z.string()).optional(),videoTitle:z.string().optional(),pinnedComment:z.string().optional(),thumbnailText:z.string().optional(),category:z.string().optional(),onScreenText:z.string().optional(),locationTag:z.string().optional(),
  first_comment_hashtags:z.string().optional(),altText:z.string().optional(),alt_text:z.string().optional(),alt_texts:z.array(z.string()).optional(),cta:z.literal('LEARN_MORE').optional(),
  meta:z.object({primary:z.string(),secondary:z.array(z.string()).default([]),geo:z.string().nullable().optional(),hashtags:z.array(z.string()).default([]),requiresDisambiguation:z.boolean().optional(),seoScore:z.number().min(0).max(100).optional(),errors:z.array(z.string()).optional(),warnings:z.array(z.string()).optional()}).optional(),
  claims:z.array(z.object({text:z.string().min(1),source_url:z.string().url()})).default([])}).strict();
export const textOf = c => c.caption??c.text??c.description??'';
export const hashtags = s => s.match(/#[\p{L}\p{N}_]+/gu)??[];
export const charCount = (p,s) => p==='twitter'?twitterText.parseTweet(s).weightedLength:[...s].length;
const banned=/\b(guaranteed|100%\s*(?:safe|effective)|clinically proven|cures?|miracle|no side effects|best in india|number one|prescription uplift|doctor[- ]endorsed|improves?\s+(?:pcos|ppg|cholesterol|heart|health)|reduces?\s+(?:risk|heart attack|cholesterol|weight)|promotes?\s+weight\s+reduction|therapeutic|efficacy|dosage|disease|clinical(?:ly)?|dapaduce|rosulong)\b/i;

/** Deterministic structural, SEO and obvious-claim checks; semantic audit runs separately. */
export function validate(platform,c,brief,cfg,{imageCount=0,research={facts:[]}}={}) {
  const errors=[],schema=contentSchema.safeParse(c);
  if(!schema.success)return ['Invalid content schema: '+schema.error.message];
  const text=textOf(c),rule=cfg.platforms[platform];
  const field=['instagram','tiktok'].includes(platform)?'caption':['youtube','pinterest'].includes(platform)?'description':'text';
  if(typeof c[field]!=='string'||!c[field].trim())errors.push(`Required ${field} field missing`);
  if(!text.trim())errors.push('Text is required');
  if(charCount(platform,text)>rule.limit)errors.push(`Text exceeds ${rule.limit} characters`);
  const key=brief.primary_keyword.toLowerCase();
  if(!text.slice(0,platform==='youtube'?150:125).toLowerCase().includes(key))errors.push('Primary keyword missing from opening');
  const all=[text,c.title??'',c.first_comment_hashtags??'',...(c.alt_texts??[]),c.alt_text??''].join('\n');
  if(banned.test(all))errors.push('Banned/unverifiable medical or marketing claim');
  if(brief.language==='hinglish' && /[\u0900-\u097F]/u.test(all))errors.push('Hinglish must use Roman script');
  const tags=hashtags(text+(platform==='instagram'?' '+(c.first_comment_hashtags??''):''));
  if(tags.length<rule.hashtags[0]||tags.length>rule.hashtags[1])errors.push(`Use ${rule.hashtags.join('-')} hashtags`);
  if(platform==='instagram' && cfg.env.IG_HASHTAGS_IN_COMMENT && hashtags(text).length)errors.push('Instagram hashtags belong in first_comment_hashtags');
  if(platform==='instagram' && !cfg.env.IG_HASHTAGS_IN_COMMENT && c.first_comment_hashtags)errors.push('Put Instagram hashtags in caption');
  if(!text.includes(brief.cta_url))errors.push('Include the CTA website URL');
  const persona=brief.persona??brief.persona_key;
  const localPersona=['rx_national','lucknow_local','blend_personal_visualaid'].includes(persona);
  if(platform==='google' && localPersona && (!/Lucknow/i.test(text)||!/pan-India/i.test(text)))errors.push('Google copy needs Lucknow and pan-India');
  if(persona==='lucknow_local'&&!text.slice(0,125).toLowerCase().includes('lucknow'))errors.push('Lucknow local copy needs Lucknow in the opening');
  if(persona==='personal'&&brief.cta_url?.includes('rxdesignhub.com'))errors.push('Personal persona must use the personal CTA, not the RX CTA');
  if(platform==='youtube') {
    if(!c.title?.toLowerCase().includes(key)||[...(c.title??'')].length>100)errors.push('YouTube title needs keyword and <=100 characters');
    const words=text.trim().split(/\s+/u).length;
    if(words<200||words>400)errors.push('YouTube description must contain 200-400 words');
    if(!Array.isArray(c.tags)||c.tags.join(',').length>500)errors.push('YouTube tags must total <=500 characters');
  }
  if(platform==='pinterest' && (!c.title||[...c.title].length>100))errors.push('Pinterest title required, <=100 characters');
  if(imageCount && (!c.alt_texts || c.alt_texts.length!==imageCount || c.alt_texts.some(s=>!s.trim()||s.length>1000)))errors.push('Provide one descriptive alt_texts entry for every image (<=1000 characters)');
  for(const claim of c.claims??[]) {
    if(!research.facts?.some(f=>f.source_url===claim.source_url)||!text.includes(claim.source_url)||!all.includes(claim.text)) errors.push('Claims must cite a research fact URL in visible copy');
  }
  return errors;
}
/** Trim only at sentence boundaries and retain the CTA/hashtags tail; caller must revalidate. */
export function trimSafely(platform,c,limit) {
  const next=structuredClone(c),field=c.caption!==undefined?'caption':c.text!==undefined?'text':'description';
  const text=next[field]??'';
  if(charCount(platform,text)<=limit)return next;
  const paragraphs=text.split(/\n\s*\n/);let tail=paragraphs.length>1?paragraphs.pop():'',body=paragraphs.join('\n\n');
  if(!tail){
    const keep=[...new Set([...(text.match(/https?:\/\/\S+/g)??[]),...hashtags(text)])];
    tail=keep.join(' ');body=text;
    for(const token of keep)body=body.replaceAll(token,' ');
    body=body.replace(/\s+/g,' ').trim();
  }
  const sentences=body.match(/[^.!?।]+[.!?।]+(?:\s|$)/gu)??[];
  let result='';
  for(const sentence of sentences) {
    const proposed=result+sentence;
    if(charCount(platform,proposed.trim()+(tail?'\n\n'+tail:''))>limit)break;
    result=proposed;
  }
  if(!result.trim())for(const word of body.split(/\s+/u)){
    const proposed=(result+' '+word).trim();
    if(charCount(platform,proposed+(tail?'\n\n'+tail:''))>limit)break;
    result=proposed;
  }
  next[field]=result.trim()+(tail?'\n\n'+tail:'');
  return next;
}
