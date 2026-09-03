import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const appSource = readFileSync(resolve(root, "AllbeeApp.jsx"), "utf8");
const walletSource = readFileSync(resolve(root, "APNWallet.jsx"), "utf8");
const modalSource = readFileSync(resolve(root, "APNWalletDetailModal.jsx"), "utf8");

describe("APN runtime contract regressions", () => {
  it("passes every helper used by APN Admin", () => {
    const required = [
      "apnAdminActionCounts", "apnApprovalNotification", "apnApproverFor", "apnBuildCommissions",
      "apnEffectiveStatus", "apnHealthScore", "apnLastSeenLabel", "apnMetricLabel",
      "apnNotificationSender", "apnNotify", "apnPercent", "apnSafeHtml", "apnStatusLabel",
      "apnTargetProgress", "apnTimelineEntry"
    ];
    const routeStart = appSource.indexOf("runtime={{ ...Icons, supabase, todayISO, money, fmtDate, fmtDateTime");
    const routeEnd = appSource.indexOf("}} />", routeStart);
    const routeRuntime = appSource.slice(routeStart, routeEnd);
    for (const name of required) expect(routeRuntime).toContain(name);
  });

  it("keeps fmtDate available to the wallet detail modal and guards missing formatters", () => {
    expect(walletSource).toContain("runtime={{ ...Icons, Empty, fmtDate, fmtDateTime, money }}");
    expect(modalSource).toContain("const { Empty, Coins, fmtDate, fmtDateTime, money } = runtime;");
    expect(modalSource).toContain("const safeFmtDate = fmtDate ||");
    expect(modalSource).toContain("const safeFmtDateTime = fmtDateTime ||");
    expect(modalSource).toContain("const safeMoney = money ||");
    expect(walletSource).toContain("const sourcePartnerId = l.snapshot?.sourcePartnerId || earning?.referred_id");
    expect(walletSource).toContain("const sourcePartnerName = l.snapshot?.sourcePartnerName || l.snapshot?.referredName");
    expect(walletSource).toContain("const sourceApnId = l.snapshot?.sourcePartnerApnId || l.snapshot?.referredApnId");
  });
});
