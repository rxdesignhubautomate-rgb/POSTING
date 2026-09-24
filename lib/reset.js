import { publer } from './publer';

export const resetTables=['rx_jobs','rx_weeks','rx_media','rx_research','topic_research','ai_usage','rx_limits'];

async function rowsFor(sql,table){
  switch(table){
    case 'rx_jobs':return sql`SELECT * FROM rx_jobs`;
    case 'rx_weeks':return sql`SELECT * FROM rx_weeks`;
    case 'rx_media':return sql`SELECT * FROM rx_media`;
    case 'rx_research':return sql`SELECT * FROM rx_research`;
    case 'topic_research':return sql`SELECT * FROM topic_research`;
    case 'ai_usage':return sql`SELECT * FROM ai_usage`;
    case 'rx_limits':return sql`SELECT * FROM rx_limits`;
    case 'rx_settings':return sql`SELECT * FROM rx_settings`;
    default:throw new Error('Unknown reset table.');
  }
}
export async function createResetBackup(sql){
  const tables={};for(const table of [...resetTables,'rx_settings'])tables[table]=await rowsFor(sql,table);
  return {created_at:new Date().toISOString(),format:'rx-studio-backup-v1',tables};
}
export async function listResetPublerPosts(client=publer){
  if(!process.env.PUBLER_API_KEY||!process.env.PUBLER_WORKSPACE_ID)return {posts:[],configured:false,errors:[]};
  const posts=[],errors=[];
  for(const state of ['scheduled','draft'])try{
    for(let page=0;page<50;page++){
      const value=await client('GET',`/posts?state=${state}&page=${page}`),items=Array.isArray(value)?value:(value?.posts??[]);
      for(const item of items)posts.push({...item,reset_state:state});
      const pages=Number(value?.total_pages??1);if(!items.length||page+1>=pages)break;
    }
  }catch(e){errors.push(`${state}: ${e.message}`);}
  return {posts:[...new Map(posts.filter(p=>p.id).map(p=>[p.id,p])).values()],configured:true,errors};
}
export async function inspectReset({sql,publerClient=publer}={}){
  const backup=await createResetBackup(sql),publerResult=await listResetPublerPosts(publerClient);
  return {counts:Object.fromEntries(Object.entries(backup.tables).map(([name,rows])=>[name,rows.length])),publer:publerResult};
}
export async function performReset({sql,confirm,all=false,includePubler=true,includeBlob=false,publerClient=publer,blobList,blobDelete,onBackup}={}){
  if(confirm!=='RESET')throw Object.assign(new Error('Type RESET exactly to confirm the fresh start.'),{status:400});
  const backup=await createResetBackup(sql);
  if(onBackup)await onBackup(backup);
  const publerResult=includePubler?await listResetPublerPosts(publerClient):{posts:[],configured:false,errors:[]},publerDeleted=[],publerErrors=[...publerResult.errors];
  if(includePubler)for(const post of publerResult.posts)try{await publerClient('DELETE',`/posts/${encodeURIComponent(post.id)}`);publerDeleted.push(post.id);}catch(e){publerErrors.push(`${post.id}: ${e.message}`);}
  const blobDeleted=[],blobErrors=[];
  if(includeBlob&&blobList&&blobDelete)for(const prefix of ['media/','pool/'])try{
    let cursor;do{const page=await blobList({prefix,cursor,limit:1000});const urls=(page.blobs??[]).map(b=>b.url);if(urls.length){await blobDelete(urls);blobDeleted.push(...urls);}cursor=page.hasMore?page.cursor:undefined;}while(cursor);
  }catch(e){blobErrors.push(`${prefix}: ${e.message}`);}
  await sql`TRUNCATE TABLE rx_jobs,rx_weeks,rx_media,rx_research,topic_research,ai_usage,rx_limits`;
  if(all)await sql`DELETE FROM rx_settings`;else await sql`DELETE FROM rx_settings WHERE id='channels'`;
  return {backup,summary:{database:Object.fromEntries(resetTables.map(name=>[name,backup.tables[name].length])),settings_deleted:all?'all':['channels'],settings_kept:all?[]:['connections'],publer_found:publerResult.posts.length,publer_deleted:publerDeleted,publer_errors:publerErrors,blob_deleted:blobDeleted,blob_errors:blobErrors,manual_publer_cleanup:publerErrors.length>0?publerResult.posts.filter(p=>!publerDeleted.includes(p.id)).map(p=>p.id):[]}};
}
