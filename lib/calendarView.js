export function calendarJobTime(job){
  if(job?.delivery?.scheduled_at)return job.delivery.scheduled_at;
  if(job?.status==='submitted')return job.delivery?.started_at??job.updated_at??job.created_at;
  return null;
}

export function splitCalendarJobs(jobs=[],now=new Date()){
  const cutoff=now instanceof Date?now.getTime():new Date(now).getTime(),upcoming=[],past=[];
  for(const job of jobs){
    const value=calendarJobTime(job),time=Date.parse(value??'');
    if(!Number.isFinite(time))continue;
    if(job.status==='submitted'||time<cutoff)past.push(job);else upcoming.push(job);
  }
  upcoming.sort((a,b)=>Date.parse(calendarJobTime(a))-Date.parse(calendarJobTime(b)));
  past.sort((a,b)=>Date.parse(calendarJobTime(b))-Date.parse(calendarJobTime(a)));
  return {upcoming,past};
}
