import { handleUpload } from '@vercel/blob/client';
import { authorize,errorResponse } from '../../../lib/auth';
import { getJob } from '../../../lib/db';
import { assertEditable } from '../../../lib/model';
export const runtime='nodejs';
export async function POST(req){try{
  const body=await req.json();
  return Response.json(await handleUpload({body,request:req,
    onBeforeGenerateToken:async pathname=>{
      authorize(req,{write:true});
      const pool=pathname.match(/^pool\/([a-f0-9-]{8,36})\/[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp|mp4|mov)$/i);
      if(pool)return {allowedContentTypes:['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'],maximumSizeInBytes:(/\.(mp4|mov)$/i.test(pathname)?200:20)*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({pool:pool[1]})};
      const match=pathname.match(/^media\/([a-zA-Z0-9._-]{3,120})\/[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp|mp4|mov)$/i);if(!match)throw new Error('Invalid upload path.');
      const job=await getJob(match[1]);assertEditable(job);if(job.media.length>=10)throw new Error('Maximum ten images per job.');
      return {allowedContentTypes:['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'],maximumSizeInBytes:(/\.(mp4|mov)$/i.test(pathname)?200:20)*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({job:job.id})};
    },
    // SDK verifies this callback. The browser registers and verifies metadata through head().
    onUploadCompleted:async()=>{}
  }));
}catch(e){return errorResponse(e);}}
