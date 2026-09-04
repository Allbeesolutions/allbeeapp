import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const guard = read("supabase/migrations/20260905100000_fix_partner_signup_bootstrap_guard.sql");
const signup = read("supabase/migrations/20260824120000_fix_apn_signup_pending_approval.sql");
const appn = read("src/AllbeeApp.jsx");

describe("Partner signup regression contracts", () => {
  it("allows only the transaction-local signup bootstrap to bypass auth.uid", () => {
    expect(guard).toContain("signup_bootstrap boolean");
    expect(guard).toContain("not signup_bootstrap");
    expect(guard).toContain("allbee.apn_signup_bootstrap");
    expect(guard).toContain("You cannot create another APN profile.");
  });

  it("preserves the pending partner provisioning flow", () => {
    expect(signup).toContain("set_config('allbee.apn_signup_bootstrap', '1', true)");
    expect(signup).toContain("'status', 'pending'");
    expect(signup).toContain("'role', 'partner'");
    expect(signup).toContain("apnId");
  });

  it("keeps production signup client-side on Supabase Auth", () => {
    expect(appn).toContain("supabase.auth.signUp");
    expect(appn).toContain('role_intent: "partner"');
    expect(appn).toContain("referralCode: apn.referralCode.trim().toUpperCase()");
  });

  it("does not grant the trigger function client execute permission", () => {
    expect(guard).toContain("revoke execute on function public.apn_users_guard() from public, anon, authenticated");
  });
});
