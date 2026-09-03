import React from "react";


export default function MyEarnings(props) {
  const { db, me, role, payroll, profile, go } = props;
  const { money, fmtDate, Empty, Banknote, Coins, Gift, Hourglass, UserPlus, Wallet, staffEarnings } = props.runtime || {};

  if (role === "superadmin") {
    return (
      <div className="content">
        <div className="page-head"><h3>My earnings</h3></div>
        <div className="card"><Empty icon={<Wallet size={22} color="var(--muted)" />} title="Partners draw from the profit share" text="As a partner you don't take a fixed salary or commission — your earnings come from the Haji & Alim split tracked in Share & accounts." action={<button className="btn primary" onClick={() => go("accounts")}><Wallet size={16} />Open Share & accounts</button>} /></div>
      </div>
    );
  }
  const E = staffEarnings(db, payroll, { id: me.id, name: me.name }, profile?.created_at);
  const realised = E.items.filter((i) => i.realized);
  const pipeline = E.items.filter((i) => !i.realized);
  const kindTone = (k) => k === "Student" ? "pri" : k === "Project" ? "accent" : "pos";
  const Row = ({ i }) => (
    <tr>
      <td><div style={{ fontWeight: 600 }}>{i.name}</div>{i.date && <div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(i.date)}</div>}</td>
      <td><span className={"badge " + kindTone(i.kind)}>{i.kind}</span></td>
      <td className="num-cell mono">{money(i.base)}</td>
      <td><span className="hint-line">{i.status}</span></td>
      <td className="num-cell mono" style={{ fontWeight: 700, color: i.realized ? "var(--pos)" : "var(--muted)" }}>{money(i.commission)}</td>
    </tr>
  );
  return (
    <div className="content">
      <div className="page-head"><h3>My earnings</h3></div>
      {!E.configured && E.items.length === 0 ? (
        <div className="card"><Empty icon={<Coins size={22} color="var(--muted)" />} title="No earnings set up yet" text="Once an admin sets your salary or commission rate, what you earn from ALLBEE shows up here — including a share of every student, project and client you bring in." /></div>
      ) : (
        <>
          <div className="sumrow">
            <div className="card"><div className="k"><Wallet size={14} /> Earned to date</div><div className="v mono pos-txt">{money(E.totalToDate)}</div></div>
            <div className="card"><div className="k"><Coins size={14} /> Commission earned</div><div className="v mono">{money(E.realisedComm)}</div></div>
            <div className="card"><div className="k"><Hourglass size={14} /> In pipeline</div><div className="v mono">{money(E.pipelineComm)}</div></div>
            {E.fixedMonthly > 0 && <div className="card"><div className="k"><Banknote size={14} /> Salary / month</div><div className="v mono">{money(E.fixedMonthly)}</div></div>}
            {E.incentivesTotal > 0 && <div className="card"><div className="k"><Gift size={14} /> Incentives</div><div className="v mono">{money(E.incentivesTotal)}</div></div>}
          </div>

          {E.fixedMonthly > 0 && (
            <div className="card stat" style={{ marginBottom: 16 }}>
              <div className="lbl"><Banknote size={14} /> Fixed salary</div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 10 }}>
                <div><div className="hint-line">Per month</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(E.fixedMonthly)}</div></div>
                <div><div className="hint-line">Months on the team</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{E.months}</div></div>
                <div><div className="hint-line">Salary to date (estimate)</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{money(E.salaryToDate)}</div></div>
              </div>
              <div className="hint-line" style={{ marginTop: 8 }}>Estimated from your joining date — your actual payslip is settled by the finance team.</div>
            </div>
          )}

          {E.incentives.length > 0 && (
            <div className="card stat" style={{ marginBottom: 16 }}>
              <div className="lbl"><Gift size={14} /> Incentives</div>
              <div style={{ marginTop: 10 }}>
                {E.incentives.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map((x) => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                    <div><div style={{ fontWeight: 600 }}>{x.note || "Incentive"}</div>{x.date && <div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(x.date)}</div>}</div>
                    <div className="mono" style={{ fontWeight: 700, color: "var(--pos)" }}>{money(x.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="hint-line" style={{ marginTop: 8 }}>One-off incentives added by your admin — included in your earned-to-date total.</div>
            </div>
          )}

          <div className="card">
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Coins size={15} /><span style={{ fontWeight: 700 }}>Commission</span>
              {E.pct > 0 ? <span className="badge pri">{E.pct}% of each deal</span> : <span className="hint-line">No commission rate set — you're on a fixed salary.</span>}
            </div>
            {E.items.length === 0 ? (
              <Empty icon={<UserPlus size={22} color="var(--muted)" />} title="Nothing to show yet" text="Register a student, add a project, or bring in a client with a deal value and your commission appears here." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Item</th><th>Type</th><th className="num-cell">Value</th><th>Status</th><th className="num-cell">Your commission</th></tr></thead>
                  <tbody>
                    {realised.length > 0 && <tr><td colSpan={5} style={{ background: "var(--surface-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700 }}>Earned</td></tr>}
                    {realised.map((i) => <Row key={i.id} i={i} />)}
                    {pipeline.length > 0 && <tr><td colSpan={5} style={{ background: "var(--surface-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700 }}>Pipeline — not earned yet</td></tr>}
                    {pipeline.map((i) => <Row key={i.id} i={i} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Team leads: superadmin sets a lead + their members ─────────────────── */