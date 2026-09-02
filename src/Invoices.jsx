import React from "react";

export default function Invoices({ db, mutate, openModal, removeItem, portalClients, runtime = {} }) {
  const { useState, Banknote, BadgeCheck, FileText, Plus, Pencil, Trash2, Empty, money, todayISO, fmtDate, INVOICE_STATUS } = runtime;
  const [status, setStatus] = useState("All");
  const all = [...db.invoices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = status === "All" ? all : all.filter((iv) => iv.status === status);
  const setIvStatus = (iv, sv) => mutate((d) => ({ ...d, invoices: d.invoices.map((x) => x.id === iv.id ? { ...x, status: sv, paid: sv === "Paid" } : x) }), { action: `marked invoice ${iv.number || ""} for ${iv.client} ${sv}`, module: "Invoices" });
  const del = (iv) => removeItem("invoices", iv, { name: (iv.number || "Invoice") + " · " + iv.client, audit: `deleted invoice for ${iv.client}` });
  const tone = (sv) => sv === "Paid" ? "pos" : sv === "Overdue" ? "neg" : sv === "Sent" ? "pri" : sv === "Cancelled" ? "" : "accent";
  const outstanding = all.filter((iv) => iv.status === "Sent" || iv.status === "Overdue").reduce((a, iv) => a + (Number(iv.amount) || 0), 0);
  const paid = all.filter((iv) => iv.status === "Paid").reduce((a, iv) => a + (Number(iv.amount) || 0), 0);
  return (
    <div className="content">
      <div className="page-head"><h3>Invoices</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "invoice" })}><Plus size={16} />New invoice</button></div>
      <div className="sumrow">
        <div className="card"><div className="k"><Banknote size={14} /> Outstanding</div><div className="v mono">{money(outstanding)}</div></div>
        <div className="card"><div className="k"><BadgeCheck size={14} /> Paid</div><div className="v mono">{money(paid)}</div></div>
      </div>
      <div className="toolbar"><div className="seg">{["All", ...INVOICE_STATUS].map((sv) => <button key={sv} className={status === sv ? "on" : ""} onClick={() => setStatus(sv)}>{sv}</button>)}</div></div>
      <div className="card">
        {list.length === 0 ? <Empty icon={<FileText size={22} color="var(--muted)" />} title="No invoices" text="Raise an invoice, track its payment, and optionally share it to the client portal." action={<button className="btn primary" onClick={() => openModal({ type: "invoice" })}><Plus size={16} />New invoice</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl">
            <thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th><th className="num-cell">Amount</th><th></th></tr></thead>
            <tbody>{list.map((iv) => (
              <tr key={iv.id}>
                <td><div style={{ fontWeight: 600 }}>{iv.number || "—"}</div>{iv.title && <div className="hint-line" style={{ fontSize: 11 }}>{iv.title}</div>}</td>
                <td>{iv.client}{iv.clientId && <span className="badge accent" style={{ marginLeft: 6, fontSize: 10 }}>Shared</span>}</td>
                <td><select className="select" style={{ width: "auto", padding: "4px 6px" }} value={iv.status || "Draft"} onChange={(e) => setIvStatus(iv, e.target.value)}>{INVOICE_STATUS.map((sv) => <option key={sv}>{sv}</option>)}</select></td>
                <td><span className={"badge " + (iv.dueDate && iv.status !== "Paid" && iv.dueDate < todayISO() ? "neg" : "")}>{iv.dueDate ? fmtDate(iv.dueDate) : "—"}</span></td>
                <td className="num-cell mono" style={{ fontWeight: 700 }}>{money(iv.amount)}</td>
                <td><div className="row-actions"><span className={"badge " + tone(iv.status)}>{iv.status || "Draft"}</span><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "invoice", initial: iv })}><Pencil size={14} /></button><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete invoice?", body: `Delete this invoice for ${iv.client}?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(iv) })}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </div>
    </div>
  );
}
