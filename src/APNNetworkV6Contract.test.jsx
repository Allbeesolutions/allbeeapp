import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const ui = read("src/APNNetwork.jsx");
const wallet = read("src/APNWallet.jsx");
const referral = read("supabase/apn-referral-engine-pr2.sql");
const distribution = read("supabase/migrations/20260903123000_fix_apn_distribution_owner_path.sql");
const distributionRuntime = read("supabase/migrations/20260903050000_apn_commission_wallet_finance_sync.sql");
const settlement = read("supabase/migrations/20260904052000_apn_withdrawal_fifth_rule.sql");
const snapshot = read("supabase/migrations/20260903131000_apn_wallet_ledger_project_identity.sql");

describe("APN Network v6 contracts", () => {
  it("keeps direct referral relationships one-level and future-collection based", () => {
    expect(referral).toContain("Direct referrals only. One referrer -> one referred partner.");
    expect(referral).toContain("No recursive");
    expect(referral).toContain("default_percent numeric(5,2) not null default 1");
    expect(referral).toContain("source_collection_id text not null unique");
  });
  it("preserves referral snapshots and one allowed code rename", () => {
    expect(referral).toContain("rename_count smallint not null default 0");
    expect(referral).toContain("Referral codes can only be renamed once.");
    expect(referral).toContain("referral_percent numeric(5,2) not null");
    expect(referral).toContain("capturedAt");
  });
  it("uses the authoritative ledger for head distribution", () => {
    expect(distribution).toContain("apn_ledger_record_owner");
    expect(distributionRuntime).toContain("recipientRole', 'state_head'");
    expect(distributionRuntime).toContain("recipientRole', 'district_head'");
  });
  it("keeps the 5th-of-month eligibility rule", () => {
    expect(settlement).toContain("APN withdrawals become eligible on the 5th of the month");
    expect(settlement).toContain("make_date(extract(year from current_date)::int, extract(month from current_date)::int, 5)");
  });
  it("uses server-side authoritative wallet identity in the partner wallet", () => {
    expect(snapshot).toContain("apn_partner_financial_snapshot");
    expect(snapshot).toContain("sourcePartnerId");
    expect(wallet).toContain("apnSnapshotWallet");
    expect(ui).toContain("apn_referral_network");
    expect(ui).toContain("apn_referral_leaderboard");
  });
});
