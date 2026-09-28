import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
const sw=fs.readFileSync('public/sw.js','utf8');
describe('PWA shell contract',()=>{
 it('caches only same-origin shell/static assets and preserves push',()=>{expect(sw).toContain("const SHELL=");expect(sw).toContain("url.origin!==self.location.origin");expect(sw).toContain("url.pathname.startsWith('/assets/')");expect(sw).toContain("showNotification");});
 it('does not cache API or mutation requests',()=>{expect(sw).toContain("req.method!=='GET'");expect(sw).toContain("url.pathname.startsWith('/api/')");expect(sw).toContain("url.pathname.startsWith('/functions/')");});
});
