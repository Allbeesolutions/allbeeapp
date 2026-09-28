import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('legacy mascot compatibility alias', () => {
  it('serves the exact canonical mascot bytes at the first-generation JPEG URL', () => {
    expect(sha('public/allbee-ai-mascot.jpeg')).toBe(sha('src/assets/allbee-ai-mascot.png'));
  });
  it('forces the legacy extension to the real PNG MIME type without caching', () => {
    const config = JSON.parse(fs.readFileSync('vercel.json','utf8'));
    const route = config.headers.find((h) => h.source === '/allbee-ai-mascot.jpeg');
    expect(route).toBeTruthy();
    expect(route.headers).toContainEqual({ key:'Content-Type', value:'image/png' });
    expect(route.headers).toContainEqual({ key:'Cache-Control', value:'no-cache, no-store, must-revalidate' });
  });
});
