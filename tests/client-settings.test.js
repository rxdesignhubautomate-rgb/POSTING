import { describe,it,expect } from 'vitest';
import defaults from '../config/channels.json';
import { normalizeClientSettings } from '../lib/clientSettings';

describe('client settings compatibility',()=>{
  it('keeps the corrected flat API shape',()=>{
    const value={accounts:[{id:'a1'}],...defaults};
    const result=normalizeClientSettings(value);
    expect(Array.isArray(result.channels)).toBe(true);
    expect(result.accounts).toEqual([{id:'a1'}]);
  });

  it('repairs the formerly nested API shape without crashing',()=>{
    const value={accounts:[{id:'a1'}],channels:defaults,configured:{publer:true}};
    const result=normalizeClientSettings(value);
    expect(Array.isArray(result.channels)).toBe(true);
    expect(result.channels).toHaveLength(defaults.channels.length);
    expect(result.brands.rx_global.label).toBe('RX Design Hub Global');
    expect(result.configured.publer).toBe(true);
  });
});
