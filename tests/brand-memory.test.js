import { describe,expect,it } from 'vitest';
import { buildMemoryBlock,canonicalProfileId,getBasicIdeaPresets,getProfileMemory,selectSeoTargets } from '../brand-memory/index';
import { lintDraft } from '../lib/seo-lint';

describe('brand memory',()=>{
  it('maps existing app ids without renaming them',()=>{
    expect(canonicalProfileId('rx_global')).toBe('rx-global');
    expect(canonicalProfileId('visualaid_lucknow')).toBe('va-lucknow');
    expect(canonicalProfileId('shubham')).toBe('sk-personal');
  });
  it('builds a compact single-profile, single-platform block',()=>{
    const block=buildMemoryBlock('rx_global','facebook');
    expect(block).toContain('RX Design Hub');expect(block).toContain('PLATFORM RULES (facebook)');
    expect(block).not.toContain('Shubham in first person');expect(block.length).toBeLessThan(7200);
  });
  it('supplies useful preset ideas for every profile',()=>{
    for(const id of ['rx_global','visualaid_lucknow','shubham'])expect(getBasicIdeaPresets(id).length).toBeGreaterThanOrEqual(6);
  });
  it('rotates primary keywords and avoids recent local cities',()=>{
    const first=selectSeoTargets('rx-global',{topic:'Cardiac division visual aid redesign',seed:'same'});
    const next=selectSeoTargets('rx-global',{topic:'Cardiac division visual aid redesign',seed:'same',previousPrimary:first.primary});
    expect(next.primary).not.toBe(first.primary);
    const local=selectSeoTargets('va-lucknow',{topic:'Visual aid',seed:'city',recentCities:['Kanpur','Varanasi','Prayagraj']});
    expect(['Kanpur','Varanasi','Prayagraj']).not.toContain(local.geo);
  });
});

describe('SEO lint',()=>{
  it('passes compliant Facebook copy and scores it highly',()=>{
    const primary='pharma visual aid design',body=`${primary} starts with a clean brief, not a crowded page.\n\nWe plan one message for each spread, confirm the page sequence and run a proof round before production. That gives the MR a practical flow for the doctor call without relying on unsupported product claims.\n\nSend the brief on WhatsApp +91 92195 48031 and review the process at https://rxdesignhub.com\n\n#RXDesignHub #PharmaBranding`;
    const result=lintDraft({profileId:'rx-global',platform:'facebook',draft:{text:body},meta:{primary}});
    expect(result.errors).toEqual([]);expect(result.score).toBeGreaterThanOrEqual(90);
  });
  it('flags banned language, stuffing, length, hashtags and bad phone numbers',()=>{
    const result=lintDraft({profileId:'rx-global',platform:'facebook',draft:{text:'unlock visual aid printing, visual aid printing, visual aid printing. Call 9999999999.'},meta:{primary:'visual aid printing'}});
    expect(result.errors.join(' ')).toMatch(/300-900|repeated|banned|canonical|hashtags/i);
  });
  it('requires local geo in the opening and prevents recent repeats',()=>{
    const result=lintDraft({profileId:'va-lucknow',platform:'instagram',draft:{caption:'visual aid printing Lucknow with a practical proof process. #Lucknow #PharmaPrinting #RXDesignHub',altText:'visual aid printing Lucknow sample'},meta:{primary:'visual aid printing Lucknow',geo:'Kanpur',recentCities:['Kanpur']}});
    expect(result.errors.join(' ')).toMatch(/Kanpur/);
  });
  it('enforces personal YouTube disambiguation',()=>{
    const result=lintDraft({profileId:'sk-personal',platform:'youtube',draft:{title:'Shubham Kumar builds a better workflow',description:'Shubham Kumar shares a practical workflow. '.repeat(20),tags:Array(8).fill('founder')},meta:{primary:'Shubham Kumar'}});
    expect(result.errors.join(' ')).toMatch(/founder of RX Design Hub/i);
  });
  it('enforces weekly personal disambiguation when required',()=>{
    const caption='Shubham Kumar shares a practical automation lesson from this week. '.repeat(6)+' #ShubhamKumar #FounderJourney #Bootstrapping';
    const result=lintDraft({profileId:'sk-personal',platform:'facebook',draft:{caption},meta:{primary:'Shubham Kumar',requiresDisambiguation:true}});
    expect(result.errors.join(' ')).toMatch(/founder of RX Design Hub/i);
  });
  it('checks Instagram alt text and cover wording limits',()=>{
    const caption='visual aid printing Lucknow starts with a clear proof. '.repeat(6)+' #Lucknow #PharmaPrinting #RXDesignHub';
    const result=lintDraft({profileId:'va-lucknow',platform:'instagram',draft:{caption,hashtags:['#Lucknow','#PharmaPrinting','#RXDesignHub'],altText:'x'.repeat(101),onScreenText:'one two three four five six seven',locationTag:'Lucknow'},meta:{primary:'visual aid printing Lucknow',geo:'Lucknow'}});
    expect(result.errors.join(' ')).toMatch(/alt text|on-screen/i);
  });
  it('allows X only for the global profile',()=>{
    const result=lintDraft({profileId:'sk-personal',platform:'x',draft:{posts:['Shubham Kumar on systems.']},meta:{primary:'Shubham Kumar'}});
    expect(result.errors.join(' ')).toMatch(/only available/);
  });
});
