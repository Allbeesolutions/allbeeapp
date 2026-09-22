import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { apnWalletLabel } from "./modules/apn/wallet.js";

const root = path.resolve(process.cwd(), "src");

describe("APN architecture v7 contracts", () => {
  it("keeps every APN bootstrap/read-heavy table explicitly bounded", () => {
    const source = fs.readFileSync(path.join(root, "data/readers.js"), "utf8");
    const required = [
      "apn_users", "apn_attendance", "apn_targets", "apn_leads",
      "apn_commissions", "apn_commission_projects", "apn_revenue_collections",
      "apn_notifications", "apn_documents", "apn_transfer_history",
      "apn_zone_requests",
    ];
    for (const table of required) {
      expect(source).toMatch(new RegExp("\\b" + table + "\\s*:\\s*\\d+"));
    }
  });

  it("does not use wildcard Postgres realtime events", () => {
    const source = fs.readFileSync(path.join(root, "AllbeeApp.jsx"), "utf8");
    expect(source).not.toContain('event: "*"');
  });

  it("keeps wallet labels correct when consumed through the APN wallet runtime", () => {
    expect(apnWalletLabel("commission")).toBe("Commission");
    expect(apnWalletLabel("referral")).toBe("Referral");
    expect(apnWalletLabel("incentive")).toBe("Incentive");
  });

  it("keeps APN monolith dependencies free of select-star reads", () => {
    for (const file of ["AllbeeApp.jsx", "APNAdmin.jsx", "APNWallet.jsx"]) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source).not.toContain('.select("*")');
    }
  });
});
