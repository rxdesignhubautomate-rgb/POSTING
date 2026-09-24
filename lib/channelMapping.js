import { brandPlatforms } from './channels';

const clean=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function accountMatchScore(channel,account){
  if(!channel||!account||channel.platform!==account.provider)return -1000;
  const name=clean(account.name),label=clean(channel.label);let score=0;
  if(name===label)score+=160;
  for(const token of label.split(' ').filter(token=>token.length>3))if(name.includes(token))score+=8;
  if(channel.brand==='shubham')score+=name.includes('shubham')?120:-80;
  if(channel.brand==='visualaid_lucknow')score+=(name.includes('lucknow')?120:0)+(name.includes('visual aid')?45:0)-(name.includes('shubham')?100:0);
  if(channel.brand==='rx_global')score+=(name.includes('rx design hub')||name.includes('rxdesignhub')?75:0)-(name.includes('lucknow')?110:0)-(name.includes('shubham')?110:0);
  return score;
}

export function autoMapChannels(settings,accounts=[]){
  const accountById=new Map(accounts.map(account=>[account.id,account])),used=new Set(),channels=settings.channels.map(channel=>({...channel}));
  for(const channel of channels){
    const current=accountById.get(channel.account_id),valid=current?.provider===channel.platform;
    if(valid&&channel.mapping_source!=='auto')used.add(channel.account_id);
    else if(!valid||channel.mapping_source==='auto'){channel.account_id='';delete channel.mapping_source;}
  }
  const eligible=channels.filter(channel=>(brandPlatforms[channel.brand]??[]).includes(channel.platform)&&!channel.account_id),pairs=[];
  for(const channel of eligible)for(const account of accounts)if(!used.has(account.id)&&account.provider===channel.platform)pairs.push({channel,account,score:accountMatchScore(channel,account)});
  pairs.sort((a,b)=>b.score-a.score);
  const mappedChannels=new Set();
  for(const pair of pairs){
    if(pair.score<45||mappedChannels.has(pair.channel.id)||used.has(pair.account.id))continue;
    pair.channel.account_id=pair.account.id;pair.channel.mapping_source='auto';mappedChannels.add(pair.channel.id);used.add(pair.account.id);
  }
  for(const channel of eligible.filter(item=>!item.account_id)){
    const remaining=accounts.filter(account=>account.provider===channel.platform&&!used.has(account.id));
    const competing=eligible.filter(item=>item.platform===channel.platform&&!item.account_id);
    if(remaining.length===1&&competing.length===1){channel.account_id=remaining[0].id;channel.mapping_source='auto';used.add(remaining[0].id);}
  }
  return {...settings,channels};
}
