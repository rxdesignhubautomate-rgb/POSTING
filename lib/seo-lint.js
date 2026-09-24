import { bannedPhrases,canonicalProfileId,getPlatformRule } from '../brand-memory/index';

const count=(text,needle)=>needle?text.toLowerCase().split(needle.toLowerCase()).length-1:0;
const hashtags=text=>text.match(/#[\p{L}\p{N}_]+/gu)??[];
const textOf=(platform,draft)=>platform==='youtube'?draft.description??'':platform==='x'||platform==='twitter'?(draft.posts??[draft.text??'']).join('\n'):draft.caption??draft.text??draft.description??'';
const exactPhone=/\+?91[\s-]?\d{5}[\s-]?\d{5}|\b\d{10}\b/g;

export function lintDraft({profileId,platform,draft,meta={},inputFacts=[]}){
  const id=canonicalProfileId(profileId),p=platform==='twitter'?'x':platform,rule=getPlatformRule(p),errors=[],warnings=[];
  const text=textOf(p,draft),title=draft.title??'',primary=meta.primary??draft.meta?.primary??'',all=[title,text,...(draft.hashtags??[]),draft.first_comment_hashtags??''].join(' ');
  const length=[...text].length,hashCount=(draft.hashtags?.length??hashtags(all).length);
  if(rule?.captionLength&&(length<rule.captionLength[0]||length>rule.captionLength[1]))errors.push(`Caption must be ${rule.captionLength[0]}-${rule.captionLength[1]} characters.`);
  if(p==='youtube'){
    if([...title].length>rule.titleMax)errors.push(`YouTube title must be ${rule.titleMax} characters or fewer.`);
    if(length<rule.descriptionMinChars||length>rule.descriptionMaxChars)errors.push(`YouTube description must be ${rule.descriptionMinChars}-${rule.descriptionMaxChars} characters.`);
    if(primary&&!title.slice(0,rule.titleKeywordChars).toLowerCase().includes(primary.toLowerCase()))errors.push(`Primary keyword must appear in the first ${rule.titleKeywordChars} title characters.`);
    const tagChars=(draft.tags??[]).join(',').length;if((draft.tags?.length??0)<rule.tags.min||(draft.tags?.length??0)>rule.tags.max||tagChars>rule.tags.maxTotalChars)warnings.push(`Use ${rule.tags.min}-${rule.tags.max} tags within ${rule.tags.maxTotalChars} characters.`);
    if(!draft.pinnedComment?.trim())warnings.push('Add a pinned comment suggestion.');
    if(!draft.thumbnailText?.trim()||draft.thumbnailText.trim().split(/\s+/).length>4)warnings.push('Add thumbnail text of two to four words.');
    if(!draft.category?.trim())warnings.push('Select a YouTube category.');
  }else if(primary&&p!=='x'&&!text.slice(0,rule?.hookChars??125).toLowerCase().includes(primary.toLowerCase()))errors.push(`Primary keyword must appear in the first ${rule?.hookChars??125} characters.`);
  else if(primary&&p==='x'&&!all.toLowerCase().includes(primary.toLowerCase()))errors.push('Primary keyword must appear naturally once on X.');
  if(primary&&count(all,primary)>2)errors.push('Primary keyword is repeated more than twice.');
  if(rule?.hashtags&&(hashCount<rule.hashtags.min||hashCount>rule.hashtags.max))errors.push(`Use ${rule.hashtags.min}-${rule.hashtags.max} hashtags.`);
  const bad=bannedPhrases.find(phrase=>all.toLowerCase().includes(phrase.toLowerCase()));if(bad)errors.push(`Remove banned phrase: “${bad}”.`);
  if(id==='va-lucknow'&&meta.geo&&!`${title}\n${text}`.split('\n')[0].toLowerCase().includes(meta.geo.toLowerCase()))errors.push(`Put rotated location “${meta.geo}” in the first line or title.`);
  if(id==='va-lucknow'&&meta.geo&&(meta.recentCities??[]).some(city=>city.toLowerCase()===meta.geo.toLowerCase()))errors.push(`Location “${meta.geo}” was used within the last 14 days.`);
  if(id==='sk-personal'&&p==='youtube'&&!/(founder of rx design hub|rx design hub, lucknow)/i.test(text))errors.push('YouTube description must identify Shubham as founder of RX Design Hub, Lucknow.');
  if(id==='sk-personal'&&['facebook','instagram'].includes(p)&&meta.requiresDisambiguation&&!/(founder of rx design hub|rx design hub, lucknow)/i.test(text))errors.push('This week’s first personal post must identify Shubham as founder of RX Design Hub, Lucknow.');
  for(const phone of all.match(exactPhone)??[]){const digits=phone.replace(/\D/g,'');if(!['919219548031','919129172980','9219548031','9129172980'].includes(digits))errors.push(`Use only a canonical RX phone number; found ${phone}.`);}
  if(p==='x'){if(id!=='rx-global')errors.push('X is only available for RX Design Hub Global.');if([...(draft.posts?.[0]??draft.text??'')].length>280)errors.push('X post exceeds 280 characters.');}
  if(/\b(no\.?\s*1|best(?:\s+in|\s+for)?|award(?:ed|s)?|\d+(?:\.\d+)?%)\b/i.test(all)&&!inputFacts.filter(Boolean).some(f=>all.includes(f)))errors.push('Remove or source the unverifiable ranking, award, best, or percentage claim.');
  if(p==='instagram'){
    const alt=draft.altText??draft.alt_text??draft.alt_texts?.[0]??'';
    if(!alt)warnings.push('Add descriptive image alt text when an image is used.');
    else if([...alt].length>(rule.altTextMax??100))errors.push(`Instagram alt text must be ${rule.altTextMax??100} characters or fewer.`);
    if(draft.onScreenText&&draft.onScreenText.trim().split(/\s+/).length>(rule.onScreenTextWords??6))errors.push(`Instagram on-screen text must be ${rule.onScreenTextWords??6} words or fewer.`);
    if(id==='va-lucknow'&&!draft.locationTag)warnings.push('Suggest the rotated city as the Instagram location tag.');
  }
  const score=Math.max(0,100-errors.length*18-warnings.length*6);
  return {score,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
