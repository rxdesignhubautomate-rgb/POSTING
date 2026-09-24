import { describe,it,expect } from 'vitest';
import { calendarJobTime,splitCalendarJobs,isWeekJobPast,splitWeekJobs } from '../lib/calendarView';

describe('calendar visibility',()=>{
  const now=new Date('2026-09-25T10:00:00+05:30');
  it('keeps future schedules visible and moves passed or posted work to history',()=>{
    const future={id:'future',status:'scheduled',delivery:{scheduled_at:'2026-09-26T10:00:00+05:30'}};
    const passed={id:'passed',status:'scheduled',delivery:{scheduled_at:'2026-09-24T10:00:00+05:30'}};
    const posted={id:'posted',status:'submitted',delivery:{started_at:'2026-09-25T09:55:00+05:30'}};
    const draft={id:'draft',status:'publer_draft',delivery:{started_at:'2026-09-20T10:00:00+05:30'}};
    const result=splitCalendarJobs([passed,draft,future,posted],now);
    expect(result.upcoming.map(j=>j.id)).toEqual(['future']);
    expect(result.past.map(j=>j.id)).toEqual(['posted','passed']);
  });
  it('uses the scheduled time before delivery start time',()=>{
    const job={status:'scheduled',delivery:{scheduled_at:'2026-10-01T10:00:00+05:30',started_at:'2026-09-20T10:00:00+05:30'}};
    expect(calendarJobTime(job)).toBe(job.delivery.scheduled_at);
  });
  it('moves every passed weekly slot into the collapsed history group',()=>{
    const old={id:'old',status:'needs_attention',slot_at:'2026-09-20T09:30:00+05:30'};
    const next={id:'next',status:'queued',slot_at:'2026-09-26T09:30:00+05:30'};
    expect(isWeekJobPast(old,now)).toBe(true);
    expect(splitWeekJobs([old,next],now)).toMatchObject({upcoming:[{id:'next'}],past:[{id:'old'}]});
  });
});
