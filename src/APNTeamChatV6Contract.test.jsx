import {describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const ui=read("src/APNTeamChat.jsx");
const sql=read("supabase/migrations/20260904154000_apn_chat_v6_attachment_search_fix.sql");
const security=read("supabase/migrations/20260904100000_security_v3_adversarial_assertions.sql");
describe("Team Chat v6 contracts",()=>{
 it("uses server-authorized attachment linking",()=>{expect(ui).toContain('supabase.rpc("apn_chat_attach"');expect(sql).toContain("Message attachment access denied.");expect(sql).toContain("p_size_bytes>10485760");});
 it("uses participant-authorized message search",()=>{expect(ui).toContain('supabase.rpc("apn_chat_search"');expect(sql).toContain("Not a participant.");});
 it("searches messages, mentions, senders and attachment metadata",()=>{expect(sql).toContain("m.body ilike");expect(sql).toContain("m.sender_name ilike");expect(sql).toContain("m.mentions::text ilike");expect(sql).toContain("storage_path");});
 it("keeps realtime and read-state collaboration",()=>{expect(ui).toContain("apn_chat_read_states");expect(ui).toContain("apn_chat_presence");expect(ui).toContain("removeChannel(ch)");});
 it("keeps reply, mention and read receipt UI",()=>{expect(ui).toContain("reply_to_id");expect(ui).toContain("p_mentions");expect(ui).toContain("m.read_at");});
 it("prevents direct attachment table writes",()=>{expect(security).toContain("apn_chat_attachments");expect(ui).not.toContain('from("apn_chat_attachments").insert');});
});
