import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const app=fs.readFileSync('src/AllbeeApp.jsx','utf8');
const apn=fs.readFileSync('src/APNProfile.jsx','utf8');
const client=fs.readFileSync('src/ClientPortal.jsx','utf8');
const cropper=fs.readFileSync('src/ui/ProfilePhotoCropper.jsx','utf8');
const mig=fs.readFileSync('supabase/migrations/20260928070000_storage_public_media_split_foundation.sql','utf8');
const publicMediaUpload=/uploadAttachment\(file,\s*\{\s*publicMedia:\s*true\s*\}\)/;
describe('storage access-class split',()=>{
 it('routes cropped profile images to dedicated public media',()=>{
   expect(app).toMatch(publicMediaUpload);
   expect(apn).toMatch(publicMediaUpload);
   expect(client).toMatch(publicMediaUpload);
   expect(app).toContain('setCropFile(file)');
   expect(apn).toContain('setCropFile(file)');
   expect(client).toContain('setCropFile(file)');
   expect(cropper).toContain('PROFILE_PHOTO_SIZE=500');
 });
 it('keeps general business uploads out of public-media',()=>{expect(app).toContain('options.publicMedia ? "public-media" : options.privateBusiness ? "business-files" : "attachments"');});
 it('restricts public media to images and authenticated writes',()=>{expect(mig).toContain("array['image/jpeg','image/png','image/webp','image/gif']");expect(mig).toContain('for insert to authenticated');});
});