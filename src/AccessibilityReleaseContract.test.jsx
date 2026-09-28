import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const css=fs.readFileSync('src/allbee.css','utf8');
const apn=fs.readFileSync('src/ui/apn-experience.css','utf8');
const chat=fs.readFileSync('src/ui/team-chat.css','utf8');
describe('release accessibility contracts',()=>{
 it('has visible keyboard focus treatment across the application',()=>{expect(css).toMatch(/:focus-visible/);expect(css).toContain('outline');expect(apn).toMatch(/:focus-visible/);});
 it('supports reduced motion in global and high-motion experiences',()=>{expect(css).toContain('prefers-reduced-motion');expect(apn).toContain('prefers-reduced-motion');expect(chat).toContain('prefers-reduced-motion');});
 it('enforces 44px mobile controls on primary navigation and forms',()=>{expect(css).toContain('min-height:44px');expect(css).toContain('width:44px');expect(apn).toContain('min-height:44px');});
 it('keeps mobile form controls large enough to avoid iOS input zoom',()=>{expect(css).toMatch(/font-size:\s*16px/);});
});
