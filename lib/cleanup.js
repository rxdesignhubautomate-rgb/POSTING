import { del } from '@vercel/blob';
import { claimMaintenance,listRetentionJobs,deleteRetentionJob,listOrphanMediaPools,deleteMediaPool,cleanupExpiredRows } from './db';

export const RETENTION_STATUSES=new Set(['archived','submitted','scheduled']);

export function retentionDays(value=process.env.RETENTION_DAYS){
  const parsed=Number(value??7);
  return Number.isInteger(parsed)&&parsed>=7&&parsed<=3650?parsed:7;
}

export function managedBlobUrls(media,prefix){
  return [...new Set((Array.isArray(media)?media:[]).filter(item=>typeof item?.url==='string'&&typeof item?.pathname==='string'&&item.pathname.startsWith(prefix)).map(item=>item.url))];
}

async function removeRecordWithBlobs({id,data,prefix,remove,blobDelete}){
  const urls=managedBlobUrls(data,prefix);
  if(urls.length){
    if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error(`Blob token is missing; kept ${id} for a later cleanup.`);
    await blobDelete(urls);
  }
  await remove(id);
  return urls.length;
}

export async function cleanupOldContent({days=retentionDays(),jobLimit=100,poolLimit=50,blobDelete=del}={}){
  const summary={retention_days:days,jobs_deleted:0,pools_deleted:0,blobs_deleted:0,expired:{research:0,topics:0,usage:0,weeks:0},errors:[]};
  for(const row of await listRetentionJobs(days,jobLimit))try{
    summary.blobs_deleted+=await removeRecordWithBlobs({id:row.id,data:row.data?.media,prefix:`media/${row.id}/`,remove:deleteRetentionJob,blobDelete});
    summary.jobs_deleted++;
  }catch(error){summary.errors.push({type:'job',id:row.id,error:error.message});}
  for(const row of await listOrphanMediaPools(days,poolLimit))try{
    summary.blobs_deleted+=await removeRecordWithBlobs({id:row.id,data:row.data,prefix:'pool/',remove:deleteMediaPool,blobDelete});
    summary.pools_deleted++;
  }catch(error){summary.errors.push({type:'media_pool',id:row.id,error:error.message});}
  summary.expired=await cleanupExpiredRows(days);
  return summary;
}

export async function runDailyCleanup(options={}){
  if(!await claimMaintenance('retention-cleanup',86400))return {skipped:true,reason:'already_ran_today'};
  return cleanupOldContent(options);
}
