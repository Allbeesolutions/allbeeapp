import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const app=fs.readFileSync('src/AllbeeApp.jsx','utf8');
const chat=fs.readFileSync('src/Chat.jsx','utf8');
const sql=fs.readFileSync('supabase/migrations/20260928072000_storage_private_business_files.sql','utf8');
describe('private business storage',()=>{
 it('keeps private uploads free of permanent public URLs',()=>{expect(app).toContain('options.privateBusiness ? "business-files"');expect(app).toContain('if (options.privateBusiness) return { url: "", bucket');});
 it('stores new internal team-chat files privately',()=>{expect(chat).toContain('uploadAttachment(file, { privateBusiness: true })');});
 it('opens private files with short lived signed URLs',()=>{expect(chat).toContain('.from("business-files").createSignedUrl(attachment.path, 600)');});
 it('keeps clients out of the internal bucket',()=>{expect(sql).toContain("not public.is_client()");expect(sql).toContain("public=false");});
});
