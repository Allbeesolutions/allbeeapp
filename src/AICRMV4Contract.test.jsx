import {describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const foundation=read("supabase/migrations/20260904110000_platform_v5_wave.sql");
const sql=read("supabase/migrations/20260904142200_ai_crm_idempotency_race_fix.sql")+read("supabase/migrations/20260904142000_ai_crm_v4_completion.sql");
const reliability=read("supabase/migrations/20260904122000_ai_crm_v4_reliability.sql");
const worker=read("supabase/functions/ai-crm-worker/index.ts");
const webhook=read("supabase/functions/ai-crm-webhook/index.ts");

describe("AI CRM v4 reliability contracts",()=>{
 it("keeps race-safe idempotency backed by a unique key",()=>{expect(foundation).toContain("ai_crm_actions_idempotency_idx");expect(sql).toContain("exception when unique_violation");expect(sql).toContain("where idempotency_key=k");});
 it("uses locked worker claims to prevent duplicate execution",()=>{expect(reliability).toContain("for update skip locked");expect(reliability).toContain("delivery_lock_until=now()+interval '10 minutes'");expect(worker).toContain("ai_crm_worker_claim");});
 it("preserves bounded retry and DLQ behavior",()=>{expect(reliability).toContain("if a.attempt_count>=5");expect(reliability).toContain("next_retry_at=now()+make_interval");expect(reliability).toContain("ai_crm_dead_letters");});
 it("supports admin recovery back to the queue",()=>{expect(reliability).toContain("ai_crm_dlq_recover");expect(reliability).toContain("attempt_count=0");expect(reliability).toContain("next_retry_at=now()");});
 it("records attempts and complete delivery timeline data",()=>{expect(sql).toContain("ai_crm_action_attempts");expect(sql).toContain("ai_crm_action_timeline");expect(sql).toContain("provider_response");expect(sql).toContain("delivery_updated_at");});
 it("protects provider webhooks and deduplicates event ids",()=>{expect(webhook).toContain("verifyResend");expect(webhook).toContain("verifyMeta");expect(webhook).toContain("svix-signature");expect(webhook).toContain("x-hub-signature-256");expect(reliability).toContain("ai_crm_delivery_provider_event_idx");expect(sql).toContain("on conflict do nothing");});
 it("exposes provider health metrics for success, retries, DLQ and latency",()=>{expect(sql).toContain("latency_ms");expect(sql).toContain("retries");expect(sql).toContain("dlq");expect(sql).toContain("success_rate");});
});