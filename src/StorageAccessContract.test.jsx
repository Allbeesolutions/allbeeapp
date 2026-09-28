import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const app=fs.readFileSync('src/AllbeeApp.jsx','utf8');
const apn=fs.readFileSync('src/APNProfile.jsx','utf8');
const mig=fs.readFileSync('supabase/migrations/20260928070000_storage_public_media_split_foundation.sql','utf8');
describe('storage access-class split',()=>{
 it('routes new profile images to dedicated public media',()=>{expect(app).toContain('uploadAttachment(file, { publicMedia: true })');expect(apn).toContain('uploadAttachment(file, { publicMedia: true })');});
 it('keeps general business uploads out of public-media',()=>{expect(app).toContain('options.publicMedia ? "public-media" : options.privateBusiness ? "business-files" : "attachments"');});
 it('restricts public media to images and authenticated writes',()=>{expect(mig).toContain("array['image/jpeg','image/png','image/webp','image/gif']");expect(mig).toContain('for insert to authenticated');});
});
