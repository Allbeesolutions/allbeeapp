import {describe,it,expect} from 'vitest';import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
describe('profile bio and chat identity cards',()=>{
 it('persists a bounded canonical bio for internal and APN profiles',()=>{const app=read('src/AllbeeApp.jsx'),apn=read('src/APNProfile.jsx');expect(app).toContain('bio.trim().slice(0, 150)');expect(apn).toContain('f.bio.trim().slice(0, 150)');expect(apn).toContain('maxLength={150}');});
 it('opens the selected chat identity profile with large photo and bio',()=>{const chat=read('src/APNTeamChat.jsx');expect(chat).toContain('tc-profile-trigger');expect(chat).toContain('setContactProfile');expect(chat).toContain("<ChatProfileCard");const card=read("src/ui/ChatProfileCard.jsx");expect(card).toContain("size={152}");expect(card).toContain('p.bio||"No bio yet."');});
 it('exposes only bounded profile-card data through the contact RPC',()=>{const sql=read('supabase/migrations/20261001214500_profile_bio_and_chat_profile_cards.sql');expect(sql).toContain('char_length(bio) <= 150');expect(sql).toContain('returns table(contact_id text,contact_type text,name text,apn_id text,district text,state text,photo_url text,bio text');expect(sql).not.toContain('email text');expect(sql).not.toContain('mobile text');});
});
