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

export function isWeekJobPast(job,now=new Date()){
  const time=Date.parse(job?.slot_at??'');
  return job?.status==='submitted'||Number.isFinite(time)&&time<new Date(now).getTime();
}

export function splitWeekJobs(jobs=[],now=new Date()){
  const upcoming=[],past=[];
  for(const job of jobs)(isWeekJobPast(job,now)?past:upcoming).push(job);
  upcoming.sort((a,b)=>Date.parse(a.slot_at??0)-Date.parse(b.slot_at??0));
  past.sort((a,b)=>Date.parse(b.slot_at??0)-Date.parse(a.slot_at??0));
  return {upcoming,past};
}
