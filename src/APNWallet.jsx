import React, { useState, useMemo } from "react";
import * as Icons from "./icons.jsx";

export default function APNWallet(props) {
  const {  db, pid, stats, snap, role  } = props;
  const { APNMetric, APNWalletDetailModal, APN_COMM_REVERSED, APN_WITHDRAWAL_TYPES, Empty, apnCommTone, apnCommissionProjectsOf, apnCommsOf, apnPayoutDate, apnProjectSummary, apnRequestAmount, apnRevenueCollectionsOf, apnSnapshotWallet, apnWalletLabel, apnWithdrawalLabel, apnWithdrawalTone, apnWithdrawalWalletFor, fmtDate, fmtDateTime, money } = props.runtime || {};
  const { ArrowDownToLine, BadgeCheck, Banknote, CalendarDays, CheckCircle2, Coins, FolderKanban, Gift, Handshake, Hexagon, Hourglass, RefreshCw, RotateCcw, ShieldAlert, TrendingUp, Wallet } = Icons;

  const snapWallet = apnSnapshotWallet(snap);
  const ledger = snap?.ledger || [];
  const reversals = snap?.reversals || [];
  const frozen = snap?.freeze?.frozen === true;
  const ruleSet = snap?.ruleKnowledge?.ruleSet;
  const hasSnap = snap != null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const [detail, setDetail] = useState(null);
  const eligibleBadge = (row) => {
    if (Number(row.amount) < 0) return <span className="badge neg" style={{ marginTop: 4 }}>Reversed</span>;
    if (!row.eligibleFrom) return <span className="badge" style={{ marginTop: 4 }}>Recorded</span>;
    return <span className={"badge" + (String(row.eligibleFrom).slice(0, 10) > todayKey ? " pri" : " pos")} style={{ marginTop: 4 }}>{String(row.eligibleFrom).slice(0, 10) > todayKey ? `Eligible ${fmtDate(row.eligibleFrom)}` : "Eligible"}</span>;
  };
  const legacyRows = apnCommsOf(db, pid).filter((row) => !row.migratedLedgerId).map((row) => ({ ...row, rowType: "legacy" })).concat(apnCommissionProjectsOf(db, pid).flatMap((project) => apnRevenueCollectionsOf(db, project.id).map((collection) => ({ ...collection, rowType: "collection", project: project.projectName, revenue: collection.receivedAmount, rate: project.commissionRate, amount: collection.commissionGenerated, status: collection.commissionStatus || "Pending", payoutDate: apnPayoutDate(collection.receivedDate), createdAt: collection.createdAt || Date.parse(collection.receivedDate || "") })))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const ownedProjects = apnCommissionProjectsOf(db, pid).map((project) => apnProjectSummary(db, project)).filter((p) => p.status !== "Cancelled");
  const collectionRows = ownedProjects.flatMap((project) => project.collections.map((c) => ({ id: c.id, title: project.projectName || "Project", clientName: project.clientName, project: project.projectName, amount: Number(c.receivedAmount) || 0, date: c.receivedDate, type: "Revenue received", status: c.commissionStatus || "Recorded", detail: `Commission generated ${money(c.commissionGenerated || 0)} at ${project.commissionRate}% · partner ${project.partnerName || "APN partner"}` }))).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const positiveLedger = ledger.filter((l) => Number(l.amount) > 0);
  const negativeLedger = ledger.filter((l) => Number(l.amount) < 0);
  const commissionBreakdown = snapWallet?.commission_breakdown || {};
  const streamAmount = (type) => Number(commissionBreakdown[type] || positiveLedger.filter((l) => l.commissionType === type).reduce((sum, l) => sum + Number(l.amount || 0), 0)) || 0;
  const streamRows = (type) => ledgerRows(positiveLedger.filter((l) => l.commissionType === type));
  const withdrawalRows = (db.apn_withdrawal_requests || []).filter((r) => r.partner_id === pid).map((r) => ({ id: r.id, title: `${apnWalletLabel(r.wallet_type)} withdrawal`, amount: -Math.abs(apnRequestAmount(r)), date: r.requested_at, type: "Withdrawal", status: apnWithdrawalLabel(r.status), statusTone: apnWithdrawalTone(r.status), detail: `${r.preferred_method === "upi" ? "UPI" : "Bank transfer"} · requested ${fmtDateTime(r.requested_at)}` }));
  const ledgerRows = (rows) => rows.map((l) => ({ id: l.id, title: l.snapshot?.projectName || l.snapshot?.project || l.snapshot?.clientName || "Commission entry", amount: Number(l.amount) || 0, date: l.eventAt, type: l.commissionType, status: Number(l.amount) < 0 ? "Deduction" : (l.eligibleFrom && String(l.eligibleFrom).slice(0,10) > todayKey ? `Pending · ${fmtDate(l.eligibleFrom)}` : "Credited"), statusTone: Number(l.amount) < 0 ? "neg" : (l.eligibleFrom && String(l.eligibleFrom).slice(0,10) > todayKey ? "pri" : "pos"), detail: [l.snapshot?.clientName && `Client: ${l.snapshot.clientName}`, l.snapshot?.sourcePartnerName && `Source partner: ${l.snapshot.sourcePartnerName}`, l.snapshot?.recipientRole && `Recipient: ${String(l.snapshot.recipientRole).replace(/_/g, " ")}`, l.baseAmount != null && `${money(l.baseAmount)} at ${l.percent}%`, l.sourceType && `Source: ${l.sourceType}`, l.snapshot?.district && `District: ${l.snapshot.district}`, l.snapshot?.state && `State: ${l.snapshot.state}`].filter(Boolean).join(" · ") }));
  const openDetail = (key) => {
    const earned = positiveLedger.reduce((s,l) => s + Number(l.amount || 0), 0);
    const deductions = Math.abs(negativeLedger.reduce((s,l) => s + Number(l.amount || 0), 0));
    const common = { credit: earned, debit: deductions };
    const details = {
      revenue: { title: "Revenue generated — full details", value: money(stats.revenue), rows: collectionRows, note: "Every collection is shown with its project, client, amount, date and commission generated." },
      earned: { title: "Commission earned — where it came from", value: money(snapWallet ? Number(snapWallet.earned) : stats.commission.earned), rows: ledgerRows(positiveLedger), note: "Credits are automatically recorded by the commission engine. Referral, district and state entries show their source person and scope." },
      pending: { title: "Pending commissions — awaiting eligibility", value: money(snapWallet ? Number(snapWallet.pending) : stats.commission.pending), rows: ledgerRows(positiveLedger.filter(l => l.eligibleFrom && String(l.eligibleFrom).slice(0,10) > todayKey)), note: "Pending means credited to the ledger but not yet eligible for withdrawal." },
      eligible: { title: "Eligible (payable) — full details", value: money(snapWallet ? Number(snapWallet.eligible) : stats.commission.payable), rows: ledgerRows(positiveLedger.filter(l => !l.eligibleFrom || String(l.eligibleFrom).slice(0,10) <= todayKey)), note: "Eligible credits require no separate commission approval; they are engine credits." },
      withdrawable: { title: "Withdrawable — balance calculation", value: money(snapWallet ? Number(snapWallet.withdrawable) : stats.commission.payable), rows: [...ledgerRows(positiveLedger.filter(l => !l.eligibleFrom || String(l.eligibleFrom).slice(0,10) <= todayKey)), ...withdrawalRows], note: "This view shows eligible credits together with withdrawal movements that reduce the available balance." },
      withdrawn: { title: "Withdrawn — payout history", value: money(snapWallet ? Number(snapWallet.withdrawn) : stats.commission.paid), rows: withdrawalRows.filter(r => r.status.toLowerCase() === "paid"), note: "Paid withdrawal requests are shown as outgoing wallet movements." },
      reversed: { title: "Reversed — deductions and recoveries", value: money(snapWallet ? Number(snapWallet.reversed) : 0), rows: ledgerRows(negativeLedger), note: "Reversals and recovery deductions remain visible so the wallet always reconciles to its ledger." },
      balance: { title: "Total balance — reconciliation", value: money(snapWallet ? Number(snapWallet.total_balance) : 0), rows: [...ledgerRows(positiveLedger), ...ledgerRows(negativeLedger), ...withdrawalRows], note: "The total is derived from engine credits, deductions and paid/locked withdrawal movements." },
      projects: { title: "Projects — full details", value: String(ownedProjects.length), rows: ownedProjects.map(p => ({ id:p.id, title:p.projectName || "Project", amount:p.totalReceived, date:p.createdAt || p.updatedAt, status:p.status, statusTone:p.status === "Completed" ? "pos" : "accent", detail:`Client: ${p.clientName || "—"} · Project value ${money(p.projectValue)} · Commission ${money(p.commissionEarned)} at ${p.commissionRate}%` })) },
      completed: { title: "Completed projects", value: String(ownedProjects.filter(p => p.status === "Completed").length), rows: ownedProjects.filter(p => p.status === "Completed").map(p => ({ id:p.id, title:p.projectName || "Project", amount:p.totalReceived, date:p.updatedAt || p.createdAt, status:"Completed", statusTone:"pos", detail:`Client: ${p.clientName || "—"} · Commission earned ${money(p.commissionEarned)}` })) },
      processing: { title: "Processing projects", value: String(ownedProjects.filter(p => p.status === "Processing").length), rows: ownedProjects.filter(p => p.status === "Processing").map(p => ({ id:p.id, title:p.projectName || "Project", amount:p.totalReceived, date:p.updatedAt || p.createdAt, status:"Processing", statusTone:"accent", detail:`Client: ${p.clientName || "—"} · Remaining ${money(p.remainingAmount)}` })) },
      collections: { title: "Collections received", value: String(collectionRows.length), rows: collectionRows },
      incentives: { title: "Total incentives — full details", value: money(stats.totalIncentives), rows: collectionRows.filter((r) => { const c = (db.apn_revenue_collections || []).find(x => x.id === r.id); return Number(c?.incentive) > 0; }).map(r => ({ ...r, amount: Number((db.apn_revenue_collections || []).find(x => x.id === r.id)?.incentive) || 0, type: "Incentive", detail: "Incentive recorded against this collection." })) },
      referral1: { title: "Referral 1% — project earnings", value: money(streamAmount("referral")), rows: streamRows("referral"), note: "Your referral stream is 1% of the qualifying project collections shown below." },
      district1: { title: "District 1% — district-head earnings", value: money(streamAmount("district")), rows: streamRows("district"), note: "District-head earnings are 1% of qualifying collections assigned to your district." },
      state1: { title: "State 1% — state-head earnings", value: money(streamAmount("state")), rows: streamRows("state"), note: "State-head earnings are 1% of qualifying collections across your assigned state scope." }
    };
    setDetail(details[key] || null);
  };
  const legacyList = (rows) => rows.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Coins size={22} color="var(--muted)" />} title="No records" text="Legacy commission records appear here for reference only. The commission engine is the source of truth from now on." /></div>
    : rows.map((c) => (
      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{c.project}{c.kind === "district" ? " (district 1%)" : ""}</div>
          <div className="hint-line" style={{ fontSize: 12 }}>{c.rowType === "collection" ? `Received ${money(c.revenue)} · ${c.rate}% · ${fmtDate(c.receivedDate)}` : `Revenue ${money(c.revenue)} · ${c.rate}% · pay ${fmtDate(c.payoutDate)}`}</div>
        </div>
        <div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{money(c.amount)}</div><span className={"badge " + apnCommTone(c.status)} style={{ marginTop: 4 }}>{c.status}</span>{c.status === APN_COMM_REVERSED && c.reversalReason && <div className="hint-line" style={{ fontSize: 11, maxWidth: "min(220px,42vw)", textAlign: "right", marginTop: 2 }}>{c.reversalReason}</div>}</div>
      </div>
    ));
  return (
    <div>
      <div className="apn-section-h">Wallet</div>
      {frozen && <div className="banner" style={{ margin: "0 0 12px" }}><ShieldAlert size={15} />APN operations are temporarily frozen by an administrator. Balances shown are the latest engine values; no commission, referral, or withdrawal actions can be processed until the freeze is lifted.</div>}
      {snapWallet && <div className="banner" style={{ margin: "0 0 12px" }}><Hexagon size={15} />Balances come from the ALLBEE commission engine and match what ALLBEE AI reports. Active rule set: <b>{ruleSet?.code || "—"}</b>{ruleSet?.effectiveFrom ? ` (from ${fmtDate(ruleSet.effectiveFrom)})` : ""}.</div>}
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} onClick={() => openDetail("revenue")} />
        <APNMetric k="Commission earned" v={money(snapWallet ? Number(snapWallet.earned) : stats.commission.earned)} icon={<Coins size={13} />} tone="pos" onClick={() => openDetail("earned")} />
        <APNMetric k="Referral 1%" v={money(streamAmount("referral"))} icon={<Handshake size={13} />} tone="pos" onClick={() => openDetail("referral1")} />
        {role === "district_head" && <APNMetric k="District 1%" v={money(streamAmount("district"))} icon={<Coins size={13} />} tone="accent" onClick={() => openDetail("district1")} />}
        {role === "state_head" && <APNMetric k="State 1%" v={money(streamAmount("state"))} icon={<Hexagon size={13} />} tone="accent" onClick={() => openDetail("state1")} />}
        <APNMetric k="Pending" v={money(snapWallet ? Number(snapWallet.pending) : stats.commission.pending)} icon={<Hourglass size={13} />} onClick={() => openDetail("pending")} />
        <APNMetric k="Eligible (payable)" v={money(snapWallet ? Number(snapWallet.eligible) : stats.commission.payable)} icon={<Wallet size={13} />} tone="accent" onClick={() => openDetail("eligible")} />
        <APNMetric k="Withdrawable" v={money(snapWallet ? Number(snapWallet.withdrawable) : Number(stats.commission.payable) || 0)} icon={<ArrowDownToLine size={13} />} onClick={() => openDetail("withdrawable")} />
        <APNMetric k="Withdrawn" v={money(snapWallet ? Number(snapWallet.withdrawn) : stats.commission.paid)} icon={<BadgeCheck size={13} />} tone="pos" onClick={() => openDetail("withdrawn")} />
        <APNMetric k="Reversed" v={money(snapWallet ? Number(snapWallet.reversed) : 0)} icon={<RotateCcw size={13} />} tone="neg" onClick={() => openDetail("reversed")} />
        <APNMetric k="Total balance" v={money(snapWallet ? Number(snapWallet.total_balance) : Number(stats.commission.earned) + Number(stats.totalIncentives) || 0)} icon={<Banknote size={13} />} onClick={() => openDetail("balance")} />
        <APNMetric k="Projects" v={stats.projects} icon={<FolderKanban size={13} />} onClick={() => openDetail("projects")} />
        <APNMetric k="Completed projects" v={stats.completedProjects} icon={<CheckCircle2 size={13} />} onClick={() => openDetail("completed")} />
        <APNMetric k="Processing projects" v={stats.processingProjects} icon={<RefreshCw size={13} />} onClick={() => openDetail("processing")} />
        <APNMetric k="Collections received" v={stats.collectionsReceived} icon={<ArrowDownToLine size={13} />} onClick={() => openDetail("collections")} />
        <APNMetric k="Total incentives" v={money(stats.totalIncentives)} icon={<Gift size={13} />} onClick={() => openDetail("incentives")} />
      </div>
      {snapWallet && snap.nextEligibleDate && <div className="banner" style={{ margin: "0 0 12px" }}><CalendarDays size={15} />Next eligibility: <b>{fmtDate(snap.nextEligibleDate)}</b> — pending engine commissions become payable from that date.</div>}
      {!snapWallet && <div className="banner" style={{ margin: "0 0 12px" }}><Handshake size={15} />Tie-up deals settle 1:1 or lower on both sides — a governed deal never pays more than the partner with the lower commission rate.</div>}
      {hasSnap ? <>
        <div className="apn-rowcard" style={{ padding: 0 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Commission ledger <span className="hint-line" style={{ fontWeight: 500 }}>— engine records</span></div>
          {ledger.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Coins size={22} color="var(--muted)" />} title="No engine records yet" text="Once a converted project is paid and completed, its commission is recorded here by the commission engine." /></div>
            : ledger.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{l.snapshot?.project || l.snapshot?.projectNumber || l.snapshot?.clientName || "Ledger entry"}</div>
                  <div className="hint-line" style={{ fontSize: 12 }}>{l.snapshot?.clientName ? `${l.snapshot.clientName} · ` : ""}{l.commissionType}{l.sourceType ? ` · ${l.sourceType}` : ""}{l.baseAmount ? ` · ${money(l.baseAmount)} at ${l.percent}%` : ""} · {fmtDateTime(l.eventAt)}</div>
                </div>
                <div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{Number(l.amount) < 0 ? money(l.amount) : `+${money(l.amount)}`}</div>{eligibleBadge(l)}{l.snapshot?.reversalReason && <div className="hint-line" style={{ fontSize: 11, maxWidth: "min(220px,42vw)", textAlign: "right", marginTop: 2 }}>{l.snapshot.reversalReason}</div>}</div>
              </div>
            ))}
        </div>
        {reversals.length > 0 && <div className="apn-rowcard" style={{ padding: 0, marginTop: 12 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Reversal history</div>
          {reversals.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{money(r.amount)} reversal</div>
                {r.reason && <div className="hint-line" style={{ fontSize: 12 }}>{r.reason}</div>}
              </div>
              <div style={{ textAlign: "right" }}><span className="badge neg">{r.status}</span><div className="hint-line" style={{ fontSize: 11, marginTop: 4 }}>{fmtDateTime(r.appliedAt || r.createdAt)}</div></div>
            </div>
          ))}
        </div>}
        <details className="apn-rowcard" style={{ padding: 0, marginTop: 12 }}>
          <summary style={{ padding: "13px 15px", fontWeight: 700, cursor: "pointer" }}>Legacy records <span className="hint-line" style={{ fontWeight: 500 }}>— read-only projection from before the commission engine; not part of your engine balance</span></summary>
          <div>{legacyList(legacyRows)}</div>
        </details>
      </> : (
        <div className="apn-rowcard" style={{ padding: 0 }}>
          <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Commission history</div>
          {legacyList(legacyRows)}
        </div>
      )}
      <APNWalletDetailModal detail={detail} onClose={() => setDetail(null)} runtime={{ ...Icons, Empty, fmtDateTime, money }} />
    </div>
  );
}

/* ── PR3 withdrawal & settlement center ─────────────────────────────── */
const APN_WITHDRAWAL_TYPES = [
  ["commission", "Commission"], ["referral", "Referral"], ["incentive", "Incentive"],
];
const apnWithdrawalWalletFor = (db, pid, type) => (db.apn_withdrawal_wallets || []).find((row) => row.partner_id === pid && row.wallet_type === type) || { wallet_type: type, pending: 0, approved: 0, withdrawable: 0, locked: 0, paid: 0, lifetime: 0, monthly: 0, today: 0, total_requested: 0, total_approved: 0, total_rejected: 0, total_processing: 0 };
const apnWithdrawalTone = (status) => ({ pending: "pri", under_review: "accent", approved: "pos", processing: "accent", paid: "pos", rejected: "neg", cancelled: "neg", expired: "neg" }[status] || "");
const apnWithdrawalLabel = (status) => String(status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const apnWalletLabel = (type) => APN_WITHDRAWAL_TYPES.find(([key]) => key === type)?.[1] || type;
const apnRequestAmount = (row) => Number(row.approved_amount ?? row.requested_amount) || 0;