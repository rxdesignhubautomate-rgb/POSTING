export function buildPreviewOptions(job,brief,accounts=[],platformNames={}){
  const selected=brief?.platforms??[],allowed=new Set(selected),result=[];
  for(const destination of job?.destinations??[]){
    if(!allowed.has(destination.platform))continue;
    const accountIds=destination.account_ids??[];
    result.push({key:destination.key,platform:destination.platform,label:accountIds.length===1?accounts.find(a=>a.id===accountIds[0])?.name??destination.import_channel_id??destination.channel_id:destination.import_channel_id??destination.channel_id,accountIds,keyword:destination.primary_keyword,persona:destination.persona,topic:destination.topic,notes:destination.notes});
  }
  for(const platform of selected){
    const ids=brief?.targets?.[platform]??[];
    if(ids.length)for(const id of ids){
      if(result.some(option=>option.platform===platform&&option.accountIds.includes(id)))continue;
      result.push({key:`${platform}:${id}`,platform,label:accounts.find(a=>a.id===id)?.name??id,accountIds:[id],keyword:brief.primary_keyword,persona:brief.persona_key});
    }
    else if(!result.some(option=>option.platform===platform))result.push({key:platform,platform,label:platformNames[platform]??platform,accountIds:[],keyword:brief.primary_keyword,persona:brief.persona_key});
  }
  return result;
}
