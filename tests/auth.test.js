import { describe,it,expect,beforeEach,afterEach } from 'vitest';
import { signSession,validSession,checkPassword,sameOrigin,authorize,isDemo,redact } from '../lib/auth';
const original={...process.env};
beforeEach(()=>{process.env.SESSION_SECRET='a'.repeat(40);process.env.ADMIN_PASSWORD='my-test-password-123456';process.env.DEMO_MODE='false';});
afterEach(()=>{process.env={...original};});
describe('session security',()=>{
  it('accepts a signed session before expiry',()=>expect(validSession(signSession(1000),2000)).toBe(true));
  it('rejects expiry and tampering',()=>{const t=signSession(1000);expect(validSession(t,1000+12*3600000)).toBe(false);expect(validSession(t.slice(0,-3)+'xyz',2000)).toBe(false);expect(validSession(t+'.extra',2000)).toBe(false);});
  it('rejects malformed sessions and short signing secrets',()=>{expect(validSession('bad')).toBe(false);process.env.SESSION_SECRET='short';expect(validSession(signSession)).toBe(false);expect(()=>signSession()).toThrow();});
  it('compares passwords and refuses weak configuration',()=>{expect(checkPassword('wrong')).toBe(false);expect(checkPassword(process.env.ADMIN_PASSWORD)).toBe(true);process.env.ADMIN_PASSWORD='short';expect(()=>checkPassword('short')).toThrow();});
  it('enforces origin for mutations',()=>{expect(()=>sameOrigin({url:'https://studio.example/api/jobs',headers:new Headers({origin:'https://evil.example'})})).toThrow();expect(()=>sameOrigin({url:'https://studio.example/api/jobs',headers:new Headers({origin:'https://studio.example'})})).not.toThrow();});
  it('blocks every live route in demo mode',()=>{process.env.DEMO_MODE='true';expect(()=>authorize({cookies:{get:()=>({value:signSession()})}})).toThrow(/Demo mode/);});
  it('requires a valid login cookie',()=>{expect(()=>authorize({cookies:{get:()=>undefined}})).toThrow(/sign in/);expect(()=>authorize({cookies:{get:()=>({value:signSession()})}})).not.toThrow();});
  it('defaults to safe demo with no password',()=>{delete process.env.ADMIN_PASSWORD;expect(isDemo()).toBe(true);});
  it('redacts credentials from errors',()=>{process.env.PUBLER_API_KEY='secret-publer';process.env.DATABASE_URL='postgres://private';expect(redact('secret-publer postgres://private')).toBe('[REDACTED] [REDACTED]');});
});
