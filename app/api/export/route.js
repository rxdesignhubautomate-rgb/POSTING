import ExcelJS from 'exceljs';
import { authorize,errorResponse } from '../../../lib/auth';
import { listJobs } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(req){try{
  authorize(req);const jobs=await listJobs(),book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Posts',{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=[['Week','week_id',24],['Channel','channel',28],['Persona','persona',28],['Format','format',16],['Slot IST','slot_at',28],['Created','created_at',24],['Topic','topic',55],['Keyword','keyword',32],['Platforms','platforms',35],['Status','status',24],['Mode','mode',16],['Scheduled at','scheduled_at',28],['Publer job ID','job_id',28],['Error','error',65]].map(([header,key,width])=>({header,key,width}));
  for(const j of jobs){const row=sheet.addRow({week_id:j.week_id??'',channel:j.channel_id??'',persona:j.persona??j.brief.persona_key??'',format:j.format??'',slot_at:j.slot_at??'',created_at:j.created_at,topic:j.brief.topic,keyword:j.brief.primary_keyword,platforms:j.brief.platforms.join(', '),status:j.status,mode:j.delivery?.mode??'draft',scheduled_at:j.delivery?.scheduled_at??'',job_id:j.delivery?.job_id??'',error:j.error??''});row.alignment={wrapText:true,vertical:'top'};row.getCell(10).fill={type:'pattern',pattern:'solid',fgColor:{argb:j.status==='needs_attention'||j.status==='needs_fix'?'FFFFCCCC':['scheduled','submitted','publer_draft','approved'].includes(j.status)?'FFD8F0D8':'FFFFE9AE'}};}
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF12695F'}};sheet.autoFilter=`A1:N${sheet.rowCount}`;
  return new Response(await book.xlsx.writeBuffer(),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="rx-posts-tracker.xlsx"','Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
