import React, { useState, useMemo, useEffect, useCallback } from "react";
import * as Icons from "./icons.jsx";

export default function APNNetwork(props) {
  const { db = {}, meRow, pid, reload, onOpenWithdrawals, refreshTick = 0 } = props;
  const { APNReferralMetric, Avatar, Dashboard, Empty, Modal, fmtDate, fmtDateTime, money, referralCodeFor, referralLinkFor, referralQrFor, referralWalletFor, todayISO, Users, Copy, Pencil, Send, Download, Coins, CalendarDays, Hourglass, Wallet, BadgeCheck, UserCheck, UserPlus, Link2, Clock, Trophy, ChevronRight, TrendingUp, supabase, exportRowsToExcel } = props.runtime || {};

  const [view, setView] = useState("dashboard");
  const [network, setNetwork] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderPeriod, setLeaderPeriod] = useState("lifetime");
  const [codeDraft, setCodeDraft] = useState("");
  const [codeState, setCodeState] = useState("idle");
  const [referralDraft, setReferralDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [detail, setDetail] = useState(null);
  const codeRow = referralCodeFor?.(db, pid) || null;
  const wallet = referralWalletFor?.(db, pid) || { pending: 0, approved: 0, withdrawable: 0, paid: 0, lifetime: 0, monthly: 0 };
  const relationships = Array.isArray(db.apn_referral_relationships) ? db.apn_referral_relationships.filter(Boolean) : [];
  const apnUsers = Array.isArray(db.apn_users) ? db.apn_users.filter(Boolean) : [];
  const ownRelationship = relationships.find((row) => row.referred_id === pid);
  const link = referralLinkFor(codeRow?.code);
  const referralRows = Array.isArray(network) && network.length ? network.filter(Boolean) : relationships.filter((row) => row.referrer_id === pid).map((row) => ({ relationship_id: row.id, referred_id: row.referred_id, referred_name: "APN Partner", referred_apn_id: "—", status: row.status, linked_at: row.linked_at, revenue: 0, earnings: 0 }));
  const totalReferrals = referralRows.filter(Boolean).length;
  const activeReferrals = referralRows.filter((row) => row && row.status === "active").length;
  const pendingReferrals = referralRows.filter((row) => row && apnUsers.some((u) => u.id === row.referred_id && u.status === "pending")).length;

  // Keep the refresh function referentially stable. The old inline function was
  // listed in the effect dependencies, so every setNetwork/setLeaderboard render
  // created a new function and retriggered the effect indefinitely, producing an
  // RPC storm that could make the Network page appear to crash/freeze.
  const refresh = useCallback(async () => {
    if (!supabase?.rpc || !pid) return;
    const [networkResult, boardResult] = await Promise.all([
      supabase.rpc("apn_referral_network", { p_partner_id: pid }),
      supabase.rpc("apn_referral_leaderboard", { p_period: leaderPeriod }),
    ]);
    if (!networkResult.error) setNetwork(Array.isArray(networkResult.data) ? networkResult.data.filter((row) => row && typeof row === "object") : []);
    if (!boardResult.error) setLeaderboard(Array.isArray(boardResult.data) ? boardResult.data.filter((row) => row && typeof row === "object") : []);
  }, [pid, leaderPeriod, supabase]);
  useEffect(() => {
    if (!codeRow && pid && supabase?.rpc) supabase.rpc("apn_referral_ensure_code", { p_partner_id: pid }).then(() => reload?.()).catch(() => {});
    refresh().catch(() => {});
  }, [pid, leaderPeriod, codeRow?.code, refreshTick]);
  useEffect(() => { if (codeRow?.code && !codeDraft) setCodeDraft(codeRow.code); }, [codeRow?.code]);
  useEffect(() => {
    const value = codeDraft.trim().toUpperCase();
    if (!codeRow || codeRow.rename_count >= 1 || !value || value === codeRow.code) { setCodeState(value === codeRow?.code ? "available" : "idle"); return undefined; }
    if (!/^[A-Z0-9][A-Z0-9_-]{3,19}$/.test(value)) { setCodeState("invalid"); return undefined; }
    let cancelled = false;
    setCodeState("checking");
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("apn_referral_code_available", { p_code: value, p_exclude_partner: pid });
      if (!cancelled) setCodeState(error ? "unknown" : data ? "available" : "taken");
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [codeDraft, codeRow?.code, codeRow?.rename_count, pid]);

  const run = async (action, success) => {
    setBusy(true); setMessage(null);
    try { await action(); await reload?.(); await refresh(); setMessage({ type: "ok", text: success }); }
    catch (error) { setMessage({ type: "err", text: error?.message || "The referral action could not be completed." }); }
    finally { setBusy(false); }
  };
  const saveCode = () => run(async () => {
    const value = codeDraft.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,19}$/.test(value)) throw new Error("Use 4–20 letters, numbers, hyphens, or underscores.");
    if (codeState === "taken" || codeState === "checking" || codeState === "unknown") throw new Error("Choose a referral code that can be verified as available.");
    const { data, error } = await supabase.rpc("apn_referral_rename_code", { p_partner_id: pid, p_new_code: value });
    if (error) throw error;
    setCodeDraft(data || value);
  }, "Referral code updated.");
  const linkCode = () => run(async () => {
    const { error } = await supabase.rpc("apn_referral_link_code", { p_partner_id: pid, p_code: referralDraft.trim(), p_source: "manual" });
    if (error) throw error;
    setReferralDraft("");
  }, "Referral relationship linked. Only future collections can earn referral earnings.");
  const exportNetwork = async () => {
    await exportRowsToExcel(`allbee-referral-network-${todayISO()}.xlsx`, "Referral Network", [
      { label: "Referral", value: (row) => row.referred_name || "APN Partner" },
      { label: "APN ID", value: (row) => row.referred_apn_id || "" },
      { label: "Status", value: (row) => row.status },
      { label: "Joined", value: (row) => row.linked_at ? fmtDate(row.linked_at) : "" },
      { label: "Revenue", value: (row) => row.revenue },
      { label: "Referral earnings", value: (row) => row.earnings },
    ], referralRows);
    setMessage({ type: "ok", text: "Referral network exported." });
  };
  const copy = async (value, label) => {
    if (!value) return;
    try { await navigator.clipboard?.writeText(value); setMessage({ type: "ok", text: `${label} copied.` }); } catch { setMessage({ type: "err", text: `Could not copy ${label.toLowerCase()}.` }); }
  };
  const share = async () => {
    if (!link) return;
    if (navigator.share) { try { await navigator.share({ title: "Join ALLBEE APN", text: `Join my APN network with code ${codeRow.code}.`, url: link }); return; } catch { /* cancelled */ } }
    copy(link, "Referral link");
  };
  const earningRows = (Array.isArray(db.apn_referral_earnings) ? db.apn_referral_earnings : []).filter(Boolean).filter((row) => row.referrer_id === pid);
  const timelineRows = (Array.isArray(db.apn_referral_timeline) ? db.apn_referral_timeline : []).filter(Boolean).filter((row) => row.partner_id === pid).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const statusTone = (s) => s === "active" ? "pos" : s === "disabled" ? "neg" : "pri";

  return <div>
    <div className="apn-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={18} /> My Network</div>
    <div className="apn-seg-scroll" aria-label="Referral network sections">
      {[['dashboard', 'Dashboard'], ['referrals', 'Referrals'], ['timeline', 'Timeline'], ['leaderboard', 'Leaderboard']].map(([key, label]) => <button key={key} className={view === key ? "on" : ""} onClick={() => setView(key)}>{label}</button>)}
    </div>
    {message && <div className={`auth-msg ${message.type === "ok" ? "ok" : "err"}`} style={{ marginBottom: 12 }}>{message.text}</div>}

    {view === "dashboard" && <>
      <div className="apn-rowcard" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}><div style={{ fontWeight: 800, fontSize: 16 }}>Your referral identity</div><div className="hint-line" style={{ marginTop: 4 }}>Share your permanent code or link. Direct referrals only; no downstream or recursive earnings.</div>
            <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}><input className="input mono" style={{ flex: "1 1 160px", maxWidth: 250 }} value={codeDraft} onChange={(e) => { setCodeDraft(e.target.value.toUpperCase()); setCodeState("idle"); }} disabled={!codeRow || codeRow.rename_count >= 1} aria-label="Referral code" /><button className="btn sm" onClick={() => copy(codeRow?.code, "Referral code")}><Copy size={13} />Copy</button>{codeRow && codeRow.rename_count < 1 && <button className="btn sm primary" onClick={saveCode} disabled={busy || !["available", "idle"].includes(codeState)}><Pencil size={13} />Rename once</button>}</div>
            {codeRow?.rename_count >= 1 && <div className="hint-line" style={{ marginTop: 6 }}>This referral code has used its one allowed rename.</div>}
            {codeState !== "idle" && <div className="hint-line" style={{ color: ["available"].includes(codeState) ? "var(--pos)" : ["checking", "unknown"].includes(codeState) ? "var(--muted)" : "var(--neg)" }}>{codeState === "checking" ? "Checking code availability…" : codeState === "available" ? "Referral code available." : codeState === "taken" ? "That referral code is already in use." : codeState === "invalid" ? "Use 4–20 letters, numbers, hyphens, or underscores." : "Could not verify code availability."}</div>}
          </div>
          {link && <div style={{ textAlign: "center" }}><img src={referralQrFor(link)} alt="QR code for your APN referral link" width="112" height="112" style={{ display: "block", borderRadius: 10, border: "1px solid var(--border)" }} /><button className="btn sm" style={{ marginTop: 7 }} onClick={share}><Send size={13} />Share link</button></div>}
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: 12 }}><input className="input mono" value={link} readOnly aria-label="Referral link" /><button className="btn sm" onClick={() => copy(link, "Referral link")}><Copy size={13} /></button><button className="btn sm" onClick={exportNetwork}><Download size={13} />Export</button></div>
      </div>
      <div className="apn-metrics" style={{ marginBottom: 12 }}>
        <APNReferralMetric label="Lifetime earnings" value={money(wallet.lifetime)} icon={<Coins size={13} />} tone="pos" />
        <APNReferralMetric label="Monthly earnings" value={money(wallet.monthly)} icon={<CalendarDays size={13} />} />
        <APNReferralMetric label="Pending" value={money(wallet.pending)} icon={<Hourglass size={13} />} />
        <APNReferralMetric label="Withdrawable" value={money(wallet.withdrawable)} icon={<Wallet size={13} />} tone="accent" />
        <APNReferralMetric label="Paid" value={money(wallet.paid)} icon={<BadgeCheck size={13} />} tone="pos" />
        <APNReferralMetric label="Total referrals" value={totalReferrals} icon={<Users size={13} />} />
        <APNReferralMetric label="Active referrals" value={activeReferrals} icon={<UserCheck size={13} />} tone="pos" />
        <APNReferralMetric label="Pending referrals" value={pendingReferrals} icon={<UserPlus size={13} />} tone="accent" />
      </div>
      <div className="apn-rowcard" style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, marginBottom: 8 }}>Link a referral code</div>{ownRelationship ? <div className="hint-line">You are linked to a direct referrer since {fmtDate(ownRelationship.linked_at)}. This relationship cannot be replaced.</div> : <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><input className="input mono" style={{ flex: "1 1 180px" }} value={referralDraft} onChange={(e) => setReferralDraft(e.target.value.toUpperCase())} placeholder="Enter one referral code" aria-label="Referral code from another partner" /><button className="btn sm primary" onClick={linkCode} disabled={busy || !referralDraft.trim()}><Link2 size={13} />Link code</button></div>}</div>
      <div className="apn-rowcard" style={{ padding: 0, marginBottom: 12 }}>
        <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Referral earnings <span className="badge" style={{ marginLeft: 5 }}>{earningRows.length}</span></div>
        {earningRows.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Coins size={22} color="var(--muted)" />} title="No referral earnings yet" text="When a referred partner's collection is recorded, the snapshot %, revenue, and your earnings appear here." /></div>
          : earningRows.slice().sort((a, b) => new Date(b.collection_at) - new Date(a.collection_at)).slice(0, 6).map((row) => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>Collection {money(row.revenue_amount)} · {row.referral_percent}% snapshot</div><div className="hint-line" style={{ fontSize: 11 }}>On {fmtDate(row.collection_at)}{row.relationship_id && " · logged against your network"}</div></div>
              <div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{money(row.referral_amount)}</div><span className={"badge " + (row.status === "paid" ? "pos" : row.status === "pending" ? "pri" : "neg")} style={{ marginTop: 3 }}>{row.status}</span></div>
            </div>
          ))}
        {earningRows.length > 6 && <div className="hint-line" style={{ padding: 10, fontSize: 11 }}>Showing the latest 6 of {earningRows.length} — use the Timeline for the full history.</div>}
      </div>
      <div className="apn-rowcard"><div style={{ fontWeight: 700, marginBottom: 8 }}>Referral withdrawals</div><div className="hint-line" style={{ marginBottom: 9 }}>Withdrawable balance: {money(wallet.withdrawable)}. New requests use the secure Withdrawal Center, which locks the balance and keeps one settlement history for every wallet.</div><button className="btn sm primary" onClick={onOpenWithdrawals}><Wallet size={13} />Open Withdrawal Center</button></div>
    </>}

    {view === "referrals" && <div className="apn-rowcard" style={{ padding: 0 }}><div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>Direct referrals <span className="badge" style={{ marginLeft: 5 }}>{referralRows.length}</span></div>{referralRows.length === 0 ? <div style={{ padding: 8 }}><Empty icon={<Users size={22} color="var(--muted)" />} title="No direct referrals yet" text="Share your code or link to invite your first partner." action={<button className="btn primary" onClick={() => setView("dashboard")}><Send size={14} />Share invitation</button>} /></div> : referralRows.map((row) => <button key={row.relationship_id} type="button" className="apn-rowcard" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, borderBottom: "1px solid var(--border)", borderRadius: 0, textAlign: "left", boxShadow: "none" }} onClick={() => setDetail(row)}><Avatar name={row.referred_name} size={36} fontSize={14} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{row.referred_name || "APN Partner"}</div><div className="hint-line" style={{ fontSize: 12 }}>{row.referred_apn_id || "APN partner"} · Joined {fmtDate(row.linked_at)}</div></div><div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{money(row.earnings)}</div><span className={`badge ${statusTone(row.status)}`}>{row.status}</span></div><ChevronRight size={16} color="var(--muted)" /></button>)}</div>}

    {view === "timeline" && <div className="apn-rowcard">{timelineRows.length === 0 ? <Empty icon={<Clock size={22} color="var(--muted)" />} title="No referral activity yet" text="Linking a code, a new referral, earnings, and withdrawals will appear here." /> : <div className="apn-list">{timelineRows.map((row) => <div key={row.id} className="apn-rowcard" style={{ boxShadow: "none", background: "var(--surface-2)" }}><div style={{ display: "flex", gap: 9 }}><div style={{ display: "flex", gap: 9 }}><span className="pos"><Clock size={13} /></span><div><div style={{ fontWeight: 700 }}>{row.title}</div><div className="hint-line" style={{ fontSize: 12, marginTop: 3 }}>{row.description}</div><div className="hint-line" style={{ fontSize: 11, marginTop: 5 }}>{fmtDateTime(row.created_at)}</div></div></div></div></div>)}</div>}</div>}

    {view === "leaderboard" && <div className="apn-rowcard"><div className="apn-seg-scroll">{[["monthly", "Monthly"], ["yearly", "Yearly"], ["lifetime", "Lifetime"]].map(([key, label]) => <button key={key} className={leaderPeriod === key ? "on" : ""} onClick={() => setLeaderPeriod(key)}>{label}</button>)}</div>{leaderboard.length === 0 ? <Empty icon={<Trophy size={22} color="var(--muted)" />} title="Leaderboard is waiting" text="Referral earnings will appear here after a referred partner's collection is recorded." /> : leaderboard.map((row, index) => <div key={row.partner_id} className="apn-rank"><span className={`pos ${index < 3 ? `g${index + 1}` : ""}`}>{index + 1}</span><Avatar name={row.partner_name} size={28} fontSize={11} /><div style={{ flex: 1, fontWeight: 700 }}>{row.partner_name}{row.partner_id === pid && <span className="badge pri" style={{ marginLeft: 6 }}>You</span>}</div><div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 700 }}>{money(row.earnings)}</div><div className="hint-line" style={{ fontSize: 11 }}>{row.referral_count} referrals</div></div></div>)}</div>}

    {detail && <Modal title={detail.referred_name || "Referral details"} onClose={() => setDetail(null)} footer={<button className="btn" onClick={() => setDetail(null)}>Close</button>}><div className="hint-line" style={{ marginBottom: 10 }}>{detail.referred_apn_id} · Linked {fmtDate(detail.linked_at)}</div><div className="apn-metrics"><APNReferralMetric label="Revenue" value={money(detail.revenue)} icon={<TrendingUp size={13} />} /><APNReferralMetric label="Referral earnings" value={money(detail.earnings)} icon={<Coins size={13} />} tone="pos" /></div><div style={{ marginTop: 14, fontWeight: 700 }}>Referral earnings</div>{earningRows.filter((row) => row.relationship_id === detail.relationship_id).map((row) => <div key={row.id} className="item-meta" style={{ justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)" }}><span>{money(row.revenue_amount)} · {row.referral_percent}% snapshot · {fmtDate(row.collection_at)}</span><span className="badge">{row.status}</span></div>)}</Modal>}
  </div>;
}

/* ── training + quiz ─────────────────────────────────────────────────── */