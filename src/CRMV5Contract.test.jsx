import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sql = read("supabase/migrations/20260904161000_crm_v5_certification.sql");
const ui = read("src/EnterpriseCRM.jsx");

describe("CRM v5 contracts", () => {
  it("defines stage automation rules and transition trigger", () => {
    expect(sql).toContain("crm_stage_automation_rules");
    expect(sql).toContain("crm_v5_stage_automation");
    expect(sql).toContain("crm_v5_stage_automation_trg");
    expect(sql).toContain("Automated %s-stage follow-up.");
  });
  it("provides deterministic lead score and win probability", () => {
    expect(sql).toContain("crm_v5_score_lead");
    expect(sql).toContain("win_probability");
    expect(sql).toContain("lost_risk");
    expect(sql).toContain("completed_follow_ups");
  });
  it("provides scoped sales forecast and pipeline metrics", () => {
    expect(sql).toContain("crm_v5_dashboard");
    expect(sql).toContain("weighted_pipeline");
    expect(sql).toContain("open_pipeline");
    expect(sql).toContain("public.crm_can_read");
  });
  it("keeps automation and dashboard RPCs non-public", () => {
    expect(sql).toContain("revoke execute on function public.crm_v5_dashboard() from public,anon");
    expect(sql).toContain("revoke execute on function public.crm_v5_score_lead(uuid) from public,anon");
    expect(sql).toContain("revoke execute on function public.crm_v5_score_lead(uuid),public.crm_v5_stage_automation() from public,anon,authenticated");
  });
  it("exposes advanced Kanban and Customer 360 surfaces", () => {
    expect(ui).toContain("crm-kanban");
    expect(ui).toContain("Customer 360");
    expect(ui).toContain("crmIntelligence");
  });
});
