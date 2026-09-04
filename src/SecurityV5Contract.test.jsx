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
