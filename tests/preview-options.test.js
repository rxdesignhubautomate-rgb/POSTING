import { describe,it,expect } from 'vitest';
import { buildPreviewOptions } from '../lib/previewOptions';

describe('preview options',()=>{
  it('keeps every selected platform when an old imported job has only one destination',()=>{
    const job={destinations:[{key:'facebook_rx',platform:'facebook',channel_id:'facebook_rx',account_ids:['fb-rx']}]};
    const brief={platforms:['facebook','instagram','youtube'],targets:{facebook:['fb-rx']},primary_keyword:'pharma branding'};
    const options=buildPreviewOptions(job,brief,[{id:'fb-rx',name:'RX Design Hub'}],{facebook:'Facebook',instagram:'Instagram',youtube:'YouTube'});
    expect(options.map(option=>option.platform)).toEqual(['facebook','instagram','youtube']);
    expect(options[0].label).toBe('RX Design Hub');
  });
  it('does not duplicate a destination already represented by its mapped account',()=>{
    const job={destinations:[{key:'facebook_rx',platform:'facebook',account_ids:['fb-rx']}]};
    const brief={platforms:['facebook'],targets:{facebook:['fb-rx']}};
    expect(buildPreviewOptions(job,brief)).toHaveLength(1);
  });
});
