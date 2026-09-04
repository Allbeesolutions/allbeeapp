import {describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sql=read("supabase/migrations/20260904152300_automation_retry_bound_fix.sql")+read("supabase/migrations/20260904152100_automation_v4_event_dispatch_fix.sql")+read("supabase/migrations/20260904152200_automation_event_dedupe_fix.sql")+read("supabase/migrations/20260904152000_automation_v4_certification.sql");
const ui=read("src/AutomationV4.jsx");
describe("Automation v4 reliability contracts",()=>{
 it("uses enabled rules and rejects simulation-only execution",()=>{expect(sql).toContain("not r.enabled or r.simulation_only");expect(sql).toContain("Simulation-only rule cannot execute.");});
 it("claims due jobs with skip-locked concurrency",()=>{expect(sql).toContain("for update skip locked");expect(sql).toContain("status in ('approved','queued')");});
 it("bounds retries at five attempts and records DLQ",()=>{expect(sql).toContain("if attempt>=5");expect(sql).toContain("business_automation_dead_letters");expect(sql).toContain("next_retry_at=now()+make_interval");});
 it("dispatches enabled event rules into the queue",()=>{expect(sql).toContain("trigger_type='event'");expect(sql).toContain("business_automation_queue");expect(sql).toContain("business_automation_dispatch_event");});
 it("deduplicates identical event emissions",()=>{expect(sql).toContain("dedupe_key");expect(sql).toContain("create unique index if not exists business_automation_events_dedupe_idx");expect(sql).toContain("on conflict do nothing");});
 it("keeps admin simulation and DLQ recovery controls in the UI",()=>{expect(ui).toContain("business_automation_simulate");expect(ui).toContain("business_automation_dlq_recover");});
});
