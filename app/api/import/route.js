import { authorize,errorResponse } from '../../../lib/auth';
import { archiveImportedRows,getSetting,listJobs,upsertImportedJobs } from '../../../lib/db';
import { defaultChannels } from '../../../lib/channels';
import { combineValidImports,parseImportFile,validateImportRows,summarizeImport } from '../../../lib/calendarImport';

export const runtime='nodejs';
export const maxDuration=300;

async function rowsFromRequest(req){
  const contentType=req.headers.get('content-type')??'';
  if(contentType.includes('multipart/form-data')){
    const form=await req.formData(),file=form.get('file'),confirm=form.get('confirm')==='true';
    if(!file)throw new Error('Upload a CSV or XLSX file.');
    const buffer=Buffer.from(await file.arrayBuffer());
    const text=file.name.toLowerCase().endsWith('.xlsx')?'':buffer.toString('utf8');
    return {rows:await parseImportFile({text,buffer,filename:file.name}),confirm};
  }
  const body=await req.json();
  if(Array.isArray(body.rows))return {rows:body.rows,confirm:Boolean(body.confirm)};
  if(typeof body.csv==='string')return {rows:await parseImportFile({text:body.csv,filename:body.filename??'calendar.csv'}),confirm:Boolean(body.confirm)};
  throw new Error('Send rows, csv, or multipart file.');
}

export async function POST(req){try{
  authorize(req,{write:true});
  const {rows,confirm}=await rowsFromRequest(req);
  const settings=await getSetting('channels',defaultChannels()),existingJobs=await listJobs(5000);
  const report=validateImportRows(rows,{settings,existingJobs});
  const combined=combineValidImports(report.valid,existingJobs),existingCombined=new Set(existingJobs.filter(j=>j.import_mode==='daily_combined').map(j=>j.external_id));
  const dryRun={rows_parsed:report.rows_parsed,rows_valid:report.rows_valid,combined_posts:combined.length,would_create:combined.filter(j=>!existingCombined.has(j.external_id)).length,would_update:combined.filter(j=>existingCombined.has(j.external_id)&&!existingJobs.find(x=>x.external_id===j.external_id)?.delivery).length,would_skip:combined.filter(j=>existingJobs.find(x=>x.external_id===j.external_id)?.delivery).length,errors:report.errors};
  if(!confirm)return Response.json({dryRun});
  if(report.errors.length)throw Object.assign(new Error('Fix import errors before confirming.'),{status:400,details:dryRun});
  const writeResults=await upsertImportedJobs(combined);
  await archiveImportedRows(report.valid.flatMap(v=>v.job.external_id));
  const byExternal=new Map(combined.map(j=>[j.external_id,j]));
  const results=writeResults.map(r=>({...r,week_id:byExternal.get(r.external_id)?.week_id,channel_id:byExternal.get(r.external_id)?.channel_id}));
  return Response.json({dryRun,results,summary:summarizeImport(results)});
}catch(e){return errorResponse(e);}}
