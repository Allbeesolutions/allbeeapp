import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sql = read("supabase/migrations/20260904163000_security_v5_certification.sql");
const hardening = read("supabase/migrations/20260904100000_security_v3_adversarial_assertions.sql");

describe("Security v5 contracts", () => {
  it("audits RLS and sensitive write boundaries", () => {
    expect(sql).toContain("rls_failures");
    expect(sql).toContain("anon_sensitive_writes");
    expect(sql).toContain("authenticated_sensitive_writes");
  });
  it("audits SECURITY DEFINER execution and search_path", () => {
    expect(sql).toContain("definer_public_or_anon_execute");
    expect(sql).toContain("definer_without_explicit_search_path");
    expect(sql).toContain("search_path=%");
  });
  it("audits security-invoker views and exposes an assertion RPC", () => {
    expect(sql).toContain("security_invoker_view_failures");
    expect(sql).toContain("security_v5_assert");
    expect(sql).toContain("status'<>'secure");
  });
  it("keeps the previously hardened sensitive tables protected", () => {
    expect(hardening).toContain("revoke insert,update,delete on table public.%I from public,anon,authenticated");
    expect(hardening).toContain("apn_chat_attachments");
    expect(hardening).toContain("ai_crm_actions");
  });
});


describe("Current security hardening regression contracts", () => {
  it("locks Super Admin account-management boundaries in the Edge Function", () => {
    const adminUsers = read("supabase/functions/admin-users/index.ts");
    expect(adminUsers).toContain('targetRole === "superadmin" && callerRole !== "superadmin"');
    expect(adminUsers).toContain('Only a Super Admin may reset another Super Admin\'s password.');
    expect(adminUsers).toContain('Only a Super Admin may change another Super Admin\'s email.');
    expect(adminUsers).toContain('Only a Super Admin may permanently delete an APN account.');
  });

  it("locks notification state behind the unread-count SECURITY DEFINER RPC", () => {
    const sql = read("supabase/migrations/20260905121000_notification_unread_count_definer.sql");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke execute on function public.notification_unread_count() from public,anon");
    expect(sql).toContain("grant execute on function public.notification_unread_count() to authenticated");
  });

  it("keeps server-side APN age validation and sensitive-action triggers", () => {
    const age = read("supabase/migrations/20260905118000_apn_server_age_validation.sql");
    const audit = read("supabase/migrations/20260905119000_sensitive_action_audit_coverage.sql");
    expect(age).toContain("extract(year from age(current_date,d))");
    expect(age).toContain("years<18");
    expect(age).toContain("d>current_date");
    expect(audit).toContain("security_sensitive_change_trigger");
    expect(audit).toContain("security_sensitive_actions");
  });

  it("does not expose internal team chat through an all-authenticated RLS policy", () => {
    const teamChat = read("supabase/migrations/20260928182000_harden_team_chat_direct_rls.sql");
    expect(teamChat).toContain("drop policy if exists team_chat_all_authenticated");
    expect(teamChat).toContain("not public.is_client() and not public.is_partner()");
    expect(teamChat).toContain("(data->>'userId') = auth.uid()::text");
    expect(teamChat).toContain("revoke update on public.team_chat from authenticated, anon, public");
  });
});

describe("internal APN helper RPC grants", () => {
  it("keeps privileged system writers off the browser Data API", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260929103000_harden_apn_internal_helper_rpc_grants.sql"), "utf8");
    for (const helper of [
      "apn_consolidated_wallet_refresh(text)",
      "apn_referral_audit(text,text,text,jsonb)",
      "apn_referral_notify(text,text,text,text)",
      "apn_referral_refresh_wallet(text)",
      "apn_rule_audit(text,text,text,jsonb)",
      "apn_withdrawal_add_timeline(public.apn_withdrawal_requests,text,text)",
      "apn_withdrawal_audit_event(text,text,uuid,jsonb)",
    ]) expect(sql).toContain(`${helper} from public, anon, authenticated`);
  });
});

describe("CRM and Knowledge internal logger grants", () => {
  it("prevents clients from forging privileged system log records", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260929105500_harden_crm_knowledge_internal_loggers.sql"), "utf8");
    expect(sql).toContain("crm_log_event(text,text,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated");
    expect(sql).toContain("knowledge_log_change(text,text,text,jsonb,jsonb,text,text) from public, anon, authenticated");
  });
});

describe("team chat RLS auth init-plan optimization", () => {
  it("evaluates auth.uid once per statement without changing ownership checks", () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260929113000_optimize_team_chat_rls_auth_initplan.sql"), "utf8");
    expect(sql).toContain("data->>'userId' = (select auth.uid())::text");
    expect(sql).toContain("not public.is_client()");
    expect(sql).toContain("not public.is_partner()");
    expect(sql).toContain("public.is_admin()");
  });
});
