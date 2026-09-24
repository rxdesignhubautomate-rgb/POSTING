import rxGlobal from './profiles/rx-global.json';
import vaLucknow from './profiles/va-lucknow.json';
import skPersonal from './profiles/sk-personal.json';
import platformRules from './platform-rules.json';
import bannedPhrases from './banned-phrases.json';

const profiles={
  'rx-global':rxGlobal,
  'va-lucknow':vaLucknow,
  'sk-personal':skPersonal
};
const aliases={rx_global:'rx-global',rx_national:'rx-global',visualaid_lucknow:'va-lucknow',lucknow_local:'va-lucknow',shubham:'sk-personal',personal:'sk-personal',blend_personal_visualaid:'sk-personal'};
const voice={
  'rx-global':'RX team voice: practical, confident and specific. Use we. Speak to pharma marketers.',
  'va-lucknow':'Warm local shop-owner voice. Natural Roman-script Hinglish. Use hum and one selected place.',
  'sk-personal':'Shubham in first person: honest, slightly informal, and specific about what he tried or learned.'
};

export function canonicalProfileId(profileId){return profiles[profileId]?profileId:aliases[profileId]??'rx-global';}
export function getProfileMemory(profileId){return profiles[canonicalProfileId(profileId)];}
export function getPlatformRule(platform){return platformRules[platform==='twitter'?'x':platform]??null;}
function stableNumber(value){let n=2166136261;for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function relevantSecondary(profile,topic,index){
  const words=new Set(String(topic).toLowerCase().split(/\W+/).filter(w=>w.length>3));
  return [...profile.secondaryKeywords].sort((a,b)=>{
    const score=s=>s.toLowerCase().split(/\W+/).filter(w=>words.has(w)).length;
    return score(b)-score(a)||stableNumber(`${a}:${index}`)-stableNumber(`${b}:${index}`);
  }).slice(0,2);
}
export function selectSeoTargets(profileId,{topic='',seed='',previousPrimary='',recentCities=[]}={}){
  const profile=getProfileMemory(profileId),base=stableNumber(`${canonicalProfileId(profileId)}:${topic}:${seed}`);
  let primary=profile.primaryKeywords[base%profile.primaryKeywords.length];
  if(primary===previousPrimary&&profile.primaryKeywords.length>1)primary=profile.primaryKeywords[(profile.primaryKeywords.indexOf(primary)+1)%profile.primaryKeywords.length];
  const recent=new Set(recentCities.map(v=>String(v).toLowerCase()));
  const cities=profile.geo?.upCities??[];
  const available=cities.filter(city=>!recent.has(city.toLowerCase()));
  const geo=available.length?available[base%available.length]:cities[base%Math.max(cities.length,1)]??null;
  const hashtags=[...profile.hashtagBank.core,...profile.hashtagBank.rotate].slice(0,5).map(tag=>geo?tag.replace('{City}',geo.replace(/\s+/g,'')):tag);
  return {primary,secondary:relevantSecondary(profile,topic,base),geo,hashtags};
}
export function getBasicIdeaPresets(profileId){
  const profile=getProfileMemory(profileId);
  return profile.topicPillars.slice(0,6).map((topic,index)=>({id:`${profile.id}-${index+1}`,topic:topic.replaceAll('{city}',profile.geo?.upCities?.[index]??'Lucknow').replaceAll('{UP city}',profile.geo?.upCities?.[index]??'Lucknow').replaceAll('{product}','visual aid').replaceAll('{division}','cardiac division'),primary_keyword:profile.primaryKeywords[index%profile.primaryKeywords.length]}));
}
export function buildMemoryBlock(profileId,platform){
  const id=canonicalProfileId(profileId),profile=profiles[id],rule=getPlatformRule(platform);
  if(platform==='twitter'&&id!=='rx-global')throw new Error('X generation is only enabled for RX Design Hub Global.');
  return [
    `PROFILE MEMORY: ${profile.displayName} (${profile.id}, ${profile.scope})`,
    `Positioning: ${profile.positioning}`,
    profile.entityDisambiguation?`Entity: ${profile.entityDisambiguation}`:'',
    `Audience: ${profile.audience.join('; ')}`,
    `Allowed proof: ${(profile.proofPoints??[]).join('; ')||'Only facts supplied in the brief.'}`,
    `Primary keywords: ${profile.primaryKeywords.join('; ')}`,
    `Secondary keywords: ${profile.secondaryKeywords.join('; ')}`,
    `Topic pillars: ${profile.topicPillars.join('; ')}`,
    `Voice: ${voice[id]} ${profile.language}`,
    `CTA options: ${profile.cta.join('; ')}. Canonical link: ${profile.linkTarget}`,
    profile.geo?`Geo: ${profile.geo.base}. Rotation: ${profile.geo.upCities.join(', ')}.`:'',
    `PLATFORM RULES (${platform}): ${JSON.stringify(rule)}`,
    `BANNED PHRASES: ${bannedPhrases.join('; ')}`,
    'Never fabricate clients, testimonials, revenue, order counts, dates, awards, rankings, certifications or medical outcomes. One idea and one CTA per post.'
  ].filter(Boolean).join('\n');
}

export { platformRules,bannedPhrases };
