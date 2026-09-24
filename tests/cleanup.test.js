import { describe,it,expect } from 'vitest';
import { retentionDays,managedBlobUrls,RETENTION_STATUSES } from '../lib/cleanup';

describe('retention cleanup safety',()=>{
  it('uses a bounded configurable retention period',()=>{
    expect(retentionDays()).toBe(7);
    expect(retentionDays('30')).toBe(30);
    expect(retentionDays('2')).toBe(7);
    expect(retentionDays('forever')).toBe(7);
  });
  it('only includes final or archived job states',()=>{
    expect([...RETENTION_STATUSES]).toEqual(['archived','submitted','scheduled']);
    expect(RETENTION_STATUSES.has('publer_draft')).toBe(false);
    expect(RETENTION_STATUSES.has('draft')).toBe(false);
    expect(RETENTION_STATUSES.has('needs_attention')).toBe(false);
  });
  it('deletes only managed blobs under the exact record prefix',()=>{
    const media=[
      {url:'https://blob.example/one.png',pathname:'media/job-1/one.png'},
      {url:'https://blob.example/shared.png',pathname:'pool/week/shared.png'},
      {url:'https://blob.example/one.png',pathname:'media/job-1/one.png'},
      {url:'https://other.example/file.png',pathname:'media/job-2/file.png'}
    ];
    expect(managedBlobUrls(media,'media/job-1/')).toEqual(['https://blob.example/one.png']);
  });
});
