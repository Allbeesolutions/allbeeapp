import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Check, ChevronRight, Hourglass, Lock as LockIcon, Pencil, Plus, Search, ShieldCheck, Trash2, Unlock as UnlockIcon, Wallet, X } from "lucide-react";

export default function Accounts({ db, bal, mutate, openModal, openBalance, removeItem, locks = [], lockPeriod, unlockPeriod, isSuper, currentUser, helpers }) {
  const { todayISO, supabase, emitToast, money, fmtPeriod, fmtDate, expenseScope, SplitBar, ExpenseSharePanel, Empty } = helpers;
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [financeV5, setFinanceV5] = useState(null);
  const [financeV5Error, setFinanceV5Error] = useState("");
  const refreshFinanceV5 = useCallback(async () => {
    if (!isSuper) return;
    const { data, error } = await supabase.rpc("finance_v5_dashboard");
    if (error) { setFinanceV5Error(error.message); return; }
    setFinanceV5(data || null); setFinanceV5Error("");
  }, [isSuper]);
  useEffect(() => { refreshFinanceV5(); }, [refreshFinanceV5]);
  const thisPeriod = todayISO().slice(0, 7);
  const lockedThis = locks.includes(thisPeriod);
  const doLock = async (p, on) => { try { on ? await lockPeriod(p, currentUser) : await unlockPeriod(p); emitToast(on ? "Period locked." : "Period unlocked.", "success"); } catch (e) { emitToast(e.message || "Couldn't update the lock.", "error"); } };
  const list = useMemo(() => {
    let r = [...db.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    if (view !== "all") r = r.filter((t) => t.kind === view);
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter((t) => [t.client, t.project, t.category, t.notes].join(" ").toLowerCase().includes(s)); }
    return r;
  }, [db.transactions, view, q]);

  const del = async (t) => {
    // APN income is a cross-module financial posting. Revoke the APN project
    // first so the partner wallet/project/collections are reversed before the
    // finance rows are soft-deleted into the recycle bin.
    if (t.kind === "income" && t.incomeSource === "apn" && t.apnProjectId) {
      try {
        const { error } = await supabase.rpc("apn_finalize_finance_income_revoke", {
          p_transaction_id: t.id,
          p_reason: `Finance income entry deleted by ${currentUser || "Finance"}.`,
        });
        if (error) throw new Error(error.message);
        emitToast("APN income revoked and commission reversed.", "success");
      } catch (e) {
        emitToast(e.message || "Could not revoke the APN income entry.", "error");
        return;
      }
    }
    removeItem("transactions", t, {
      name: `${t.kind === "income" ? "Income" : "Expense"} ${money(t.amount)}${t.client ? " · " + t.client : ""}`,
      cascadeRows: t.kind === "income" && t.apnProjectId ? (db.transactions || []).filter((x) => x.id !== t.id && (x.apnCommissionOfIncome === t.id || x.id === "apn-expense:" + t.id)) : [],
      cascadeLabel: "APN commission expense",
      audit: `deleted a ${t.kind} of ${money(t.amount)}${(db.transactions || []).some((x) => x.id !== t.id && (x.apnCommissionOfIncome === t.id || x.id === "apn-expense:" + t.id)) ? " and its APN commission expense" : ""}`,
    });
  };

  return (
    <div className="content">
      <div className="page-head"><h3>Share & accounts</h3><span className="spacer" />
        <button className="btn" onClick={() => openModal({ type: "expense" })}><Plus size={16} />Add expense</button>
        <button className="btn primary" onClick={() => openModal({ type: "income" })}><Plus size={16} />Add income</button>
      </div>

      {lockedThis && <div className="banner" style={{ marginLeft: 0, marginRight: 0, marginBottom: 14 }}><LockIcon size={15} /> {fmtPeriod(thisPeriod)} is locked — income, expenses and withdrawals dated this month are frozen{isSuper ? "." : " until a partner unlocks it."}</div>}
      {isSuper && financeV5Error && <div className="auth-msg err" role="alert"><AlertTriangle size={15} />Finance v5 reconciliation could not load: {financeV5Error}</div>}
      {isSuper && financeV5 && <div className="card" style={{ marginBottom: 16 }}><div className="item-row"><div className="item-main"><div className="item-title"><ShieldCheck size={15} style={{ verticalAlign: -2 }} /> Finance v5 control panel</div><div className="item-meta">Authoritative transaction totals, APN commission expense linkage, paid withdrawals, and forward cash forecast.</div></div><button className="btn sm" onClick={refreshFinanceV5}>Refresh</button></div><div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}><div className="card stat"><div className="lbl">Income</div><div className="num mono">{money(financeV5.transactions.income)}</div></div><div className="card stat"><div className="lbl">Expenses</div><div className="num mono">{money(financeV5.transactions.expenses)}</div></div><div className="card stat"><div className="lbl">Net cash</div><div className="num mono">{money(financeV5.transactions.net)}</div></div><div className="card stat"><div className="lbl">APN commission expenses</div><div className="num mono">{money(financeV5.apn.commission_expenses)}</div></div><div className="card stat finance-v5-forecast-card" title="Projected net cash for the next 3 months: forecast revenue minus forecast expenses."><div className="lbl">3-month forward forecast</div><div className="num mono">{money(financeV5.forecast.net)}</div><div className="sub">Projected net cash · next 3 months</div></div><div className="card stat finance-v5-reconciliation-card"><div className="lbl">Reconciliation</div><div className={`num mono ${financeV5.reconciliation.status === "balanced" ? "pos-txt" : "neg-txt"}`} style={{ fontSize: 20, lineHeight: 1.15, whiteSpace: "normal", overflowWrap: "anywhere" }}>{financeV5.reconciliation.status === "balanced" ? "Balanced" : `${financeV5.reconciliation.exceptions} exceptions`}</div><div className="sub">{financeV5.reconciliation.status === "balanced" ? "All APN commission mappings agree" : "Review Finance reconciliation"}</div></div></div></div>}

      {isSuper && (
        <div className="card stat" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <LockIcon size={16} color="var(--muted)" />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700 }}>Financial locking</div>
              <div className="hint-line" style={{ fontSize: 12 }}>Lock a closed month to freeze its books. Only partners can lock or unlock.</div>
            </div>
            <button className={"btn sm " + (lockedThis ? "" : "primary")} onClick={() => doLock(thisPeriod, !lockedThis)}>
              {lockedThis ? <><UnlockIcon size={13} />Unlock {fmtPeriod(thisPeriod)}</> : <><LockIcon size={13} />Lock {fmtPeriod(thisPeriod)}</>}
            </button>
          </div>
          {locks.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {locks.map((p) => <span key={p} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LockIcon size={11} />{fmtPeriod(p)}<button className="iconbtn" style={{ width: 20, height: 20 }} onClick={() => doLock(p, false)} title="Unlock"><X size={11} /></button></span>)}
          </div>}
        </div>
      )}

      <div className="cards-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <div className="card balance-card" onClick={() => openBalance("Haji")}><div className="stripe" style={{ background: "var(--haji)" }} />
          <div className="who"><span className="dot" style={{ background: "var(--haji)" }} /> Haji</div>
          <div className="amt mono" style={{ fontSize: 24, color: bal.Haji < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.Haji)}</div>
          <div className="hint">Breakdown <ChevronRight size={13} /></div></div>
        <div className="card balance-card" onClick={() => openBalance("Alim")}><div className="stripe" style={{ background: "var(--alim)" }} />
          <div className="who"><span className="dot" style={{ background: "var(--alim)" }} /> Alim</div>
          <div className="amt mono" style={{ fontSize: 24, color: bal.Alim < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.Alim)}</div>
          <div className="hint">Breakdown <ChevronRight size={13} /></div></div>
        <div className="card stat"><div className="lbl"><Wallet size={14} /> Company balance</div>
          <div className="num mono" style={{ color: bal.company < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.company)}</div>
          <div className="sub">Haji + Alim · {db.transactions.length} entries</div></div>
        <div className="card stat account-balance-card" role="button" tabIndex={0} title="View APN partner balance details" onClick={() => openBalance("__account__")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBalance("__account__"); } }} style={{ cursor: "pointer" }}><div className="lbl"><Wallet size={14} /> Account balance</div>
          <div className="num mono" style={{ color: bal.account < 0 ? "var(--neg)" : "var(--ink)" }}>{money(bal.account)}</div>
          <div className="sub">Company + unwithdrawn APN commission {money(bal.apnCommission)} · View details</div></div>
      </div>

      <ExpenseSharePanel db={db} />

      <div className="toolbar">
        <div className="search"><Search size={16} color="var(--muted)" /><input placeholder="Search client, project, notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg">{[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<Wallet size={22} color="var(--muted)" />} title="No entries yet" text="Record your first income or expense to start tracking the partner split."
            action={<button className="btn primary" onClick={() => openModal({ type: "income" })}><Plus size={16} />Add income</button>} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Client / project</th><th>Category</th><th className="num-cell">Amount</th><th>Split</th><th></th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                    <td><div style={{ fontWeight: 600 }}>{t.project || t.client || "—"}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{t.client || ""}</div></td>
                    <td><span className={"badge " + (t.kind === "income" ? "pos" : "neg")}>{t.kind === "income" ? "Income" : "Expense"}</span> <span className="tag">{t.category}</span>{t.kind === "expense" && expenseScope(t) === "company" && <span className="tag" style={{ marginLeft: 4 }}>Shared</span>}{t.kind === "income" && Number(t.apnCommissionDistributionTotal) > 0 && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>APN deductions {money(t.apnCommissionDistributionTotal)} · partner {money(t.apnPartnerCommission || 0)} · referral {money(t.apnReferralCommission || 0)} · district {money(t.apnDistrictCommission || 0)} · state {money(t.apnStateCommission || 0)}</div>}{t.kind === "expense" && t.apnCommissionCombined && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>Single APN deduction · partner {money(t.apnPartnerCommission || 0)} · referral {money(t.apnReferralCommission || 0)} · district {money(t.apnDistrictCommission || 0)} · state {money(t.apnStateCommission || 0)}</div>}{t.apnCommissionExpense && t.apnCommissionOfIncome && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>Linked to project income</div>}{t.apnWithdrawalExpense && <div className="hint-line" style={{ fontSize: 11, marginTop: 3 }}>Paid APN withdrawal · wallet {t.apnWalletType || "commission"}</div>}</td>
                    <td className={"num-cell mono " + (t.kind === "income" ? "pos-txt" : "neg-txt")} style={{ fontWeight: 700 }}>{money(t.kind === "income" ? t.amount : -t.amount, { sign: t.kind === "income" })}</td>
                    <td style={{ minWidth: 130 }}><SplitBar h={t.hajiPct} a={t.alimPct} legend={false} /><div className="split-legend"><span>H {t.hajiPct}%</span><span>A {t.alimPct}%</span></div></td>
                    <td><div className="row-actions">
                      <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: t.kind, initial: t })}><Pencil size={14} /></button>
                      <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete entry?", body: `Remove this ${t.kind} of ${money(t.amount)}? Balances will recalculate.`, note: "It moves to Recently deleted — restore within 60 days.", onConfirm: () => del(t) })}><Trash2 size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

