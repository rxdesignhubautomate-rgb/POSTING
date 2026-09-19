import ExcelJS from 'exceljs';
import { authorize,errorResponse } from '../../../lib/auth';
import { listJobs } from '../../../lib/db';
import { exportImportRows,IMPORT_HEADERS } from '../../../lib/calendarImport';
export const runtime='nodejs';
export async function GET(req){try{
  authorize(req);const jobs=await listJobs(5000),book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Calendar',{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=[...IMPORT_HEADERS,'status'].map(header=>({header,key:header,width:{topic:55,creative_notes:55,guardrails:55,geo_angle:45,slot_at:28,secondary_keywords:40,external_id:28,cta_url:48}[header]??24}));
  for(const rowData of exportImportRows(jobs)){const row=sheet.addRow(rowData);row.alignment={wrapText:true,vertical:'top'};row.getCell(19).fill={type:'pattern',pattern:'solid',fgColor:{argb:rowData.status==='needs_attention'||rowData.status==='needs_fix'?'FFFFCCCC':['scheduled','submitted','publer_draft','approved'].includes(rowData.status)?'FFD8F0D8':'FFFFE9AE'}};}
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF12695F'}};sheet.autoFilter=`A1:S${sheet.rowCount}`;
  return new Response(await book.xlsx.writeBuffer(),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="rx-posts-tracker.xlsx"','Cache-Control':'no-store'}});
}catch(e){return errorResponse(e);}}
