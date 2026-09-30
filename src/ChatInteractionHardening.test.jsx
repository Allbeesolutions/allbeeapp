import { describe,it,expect } from "vitest";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
describe("chat interaction hardening",()=>{
 it("enforces server AI authorization before provider use",()=>{const s=read("supabase/functions/ai-chat-v2/index.ts");expect(s).toContain('rpc("ai_chat_authorized")');expect(s).toContain('authorized !== true');});
 it("separates APN edit and delete windows",()=>{const s=read("src/APNTeamChat.jsx");expect(s).toContain("300000");expect(s).toContain("3600000");expect(s).toContain("editRemaining > 0");});
 it("supports explicit touch double tap",()=>{const s=read("src/ui/doubleTap.js");expect(s).toContain('pointerType !== "touch"');expect(read("src/ui/MessageReactions.jsx")).toContain("isTouchDoubleTap");expect(read("src/APNTeamChat.jsx")).toContain("isTouchDoubleTap");expect(read("src/Chat.jsx")).toContain("isTouchDoubleTap");});
 it("refreshes client chat for message and reaction changes",()=>{for(const p of ["src/ClientSupportChat.jsx","src/AdminClientChat.jsx"]){const s=read(p);expect(s).toContain('event:"*",schema:"public",table:"apn_chat_messages"');expect(s).toContain('event:"*",schema:"public",table:"apn_chat_reactions"');}});
 it("hardens team reaction RPC authorization",()=>{const s=read("supabase/migrations/20260930154500_hao_ai_chat_security_realtime.sql");expect(s).toContain("public.is_client() or public.is_partner()");expect(s).toContain("team_chat_reactions_sel");expect(s).toContain("apn_chat_reactions_sel");});
});
