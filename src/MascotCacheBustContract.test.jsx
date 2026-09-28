import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
describe('mascot cache-bust contract',()=>{
  it('uses a versioned mascot path so stale mobile/PWA caches cannot show an older image',()=>{
    const src=fs.readFileSync('src/ui/AllbeeMascot.jsx','utf8');
    expect(src).toContain('/allbee-ai-mascot-v3.png');
    expect(src).not.toMatch(/src="\/allbee-ai-mascot\.png"/);
  });
  it('ships the versioned asset',()=>{
    const stat=fs.statSync('public/allbee-ai-mascot-v3.png');
    expect(stat.size).toBeGreaterThan(100000);
  });
});
