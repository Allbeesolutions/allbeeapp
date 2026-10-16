import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const sw=fs.readFileSync('public/sw.js','utf8');
describe('PWA stale mascot eviction',()=>{
  it('bumps the shell generation and removes prior ALLBEE caches',()=>{
    expect(sw).toContain("const CACHE='allbee-shell-v3'");
    expect(sw).toContain("k.startsWith('allbee-')&&k!==CACHE");
  });
  it('never serves mascot artwork from Cache Storage',()=>{
    expect(sw).toContain("pathname.includes('allbee-ai-mascot')");
    expect(sw).toContain("fetch(req,{cache:'reload'})");
  });
  it('uses network-first delivery for versioned build assets',()=>{
    expect(sw).toContain("url.pathname.startsWith('/assets/')");
    expect(sw).toContain(".catch(()=>caches.match(req))");
  });
  it('does not force-reload active tabs and discard unsent work during updates',()=>{
    expect(sw).toContain("await self.clients.claim()");
    expect(sw).not.toContain("client.navigate(client.url)");
    expect(sw).not.toContain("self.location.hostname==='app.allbeesolutions.com'");
  });
});
