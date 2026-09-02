import React from "react";

export default function Testing({ db, mutate, openModal, removeItem, isAdmin, me, currentUser, team, runtime }) {
  const { useState, LazyTestDetail, Empty, supabase, uid, haptic, uploadAttachment, fileKind, storagePathFromUrl, fmtTime, testProgress, testResultTone, TEST_MAX_IMAGES, TEST_IMAGE_TTL_DAYS, ArrowLeft, ClipboardCheck, FolderKanban, User, Pencil, Trash2, CheckCircle2, XCircle, RotateCcw, ListTodo, X, Plus, Bug, AlertTriangle, ImageIcon, RefreshCw, Send, FileText, ChevronRight, Hourglass, fmtDate, avatarColor } = runtime;
  const [openId, setOpenId] = useState(null);
  const all = [...(db.testing || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = isAdmin ? all : all.filter((s) => s.assignedToId === me.id || (!!currentUser && s.assignedTo === currentUser));
  const del = (s) => removeItem("testing", s, { name: s.title, audit: `deleted test session "${s.title}"` });

  if (openId) return <React.Suspense fallback={<div className="content"><div className="card" aria-busy="true">Loading test session…</div></div>}><LazyTestDetail key={openId} sessionId={openId} db={db} mutate={mutate} isAdmin={isAdmin} me={me} currentUser={currentUser} team={team} openModal={openModal} onBack={() => setOpenId(null)} onDelete={del} runtime={{ Empty, supabase, uid, haptic, uploadAttachment, fileKind, storagePathFromUrl, fmtTime, testProgress, testResultTone, TEST_MAX_IMAGES, TEST_IMAGE_TTL_DAYS, ArrowLeft, ClipboardCheck, FolderKanban, User, Pencil, Trash2, CheckCircle2, XCircle, RotateCcw, ListTodo, X, Plus, Bug, AlertTriangle, ImageIcon, RefreshCw, Send, FileText }} /></React.Suspense>;

  const passed = list.filter((s) => s.result === "Passed").length;
  const failed = list.filter((s) => s.result === "Failed").length;
  const pending = list.filter((s) => (s.result || "Pending") === "Pending").length;

  return (
    <div className="content">
      <div className="page-head"><h3>Testing</h3><span className="spacer" />{isAdmin && <button className="btn primary" onClick={() => openModal({ type: "testSession" })}><Plus size={16} />New test session</button>}</div>
      <div className="sumrow">
        <div className="card"><div className="k"><ClipboardCheck size={14} /> Total tests</div><div className="v mono">{list.length}</div></div>
        <div className="card"><div className="k"><CheckCircle2 size={14} color="var(--pos)" /> Passed</div><div className="v mono pos-txt">{passed}</div></div>
        <div className="card"><div className="k"><XCircle size={14} color="var(--neg)" /> Failed</div><div className="v mono neg-txt">{failed}</div></div>
        <div className="card"><div className="k"><Hourglass size={14} /> Pending</div><div className="v mono">{pending}</div></div>
      </div>
      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ClipboardCheck size={22} color="var(--muted)" />} title={isAdmin ? "No test sessions yet" : "Nothing assigned to you"} text={isAdmin ? "Create a session, add a checklist, and assign a tester to start QA on a project." : "Test sessions assigned to you will show up here."} action={isAdmin ? <button className="btn primary" onClick={() => openModal({ type: "testSession" })}><Plus size={16} />New test session</button> : null} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Session</th><th>Project</th><th>Tester</th><th>Checklist</th><th>Result</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => {
                  const p = testProgress(s);
                  const nBugs = (Array.isArray(s.bugs) ? s.bugs : []).length;
                  return (
                    <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(s.id)}>
                      <td><div style={{ fontWeight: 600 }}>{s.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{fmtDate(new Date(s.createdAt || Date.now()).toISOString().slice(0, 10))}{nBugs ? ` · ${nBugs} issue${nBugs > 1 ? "s" : ""}` : ""}</div></td>
                      <td>{s.projectName ? <span className="tag">{s.projectName}</span> : <span className="hint-line">—</span>}</td>
                      <td><span className="who-cell"><span className="avatar" style={{ background: avatarColor(s.assignedTo || "?"), width: 24, height: 24, fontSize: 10 }}>{(s.assignedTo || "?")[0]}</span>{s.assignedTo || "Unassigned"}</span></td>
                      <td className="mono">{p.done}/{p.total}</td>
                      <td><span className={"badge " + testResultTone(s.result)}>{s.result || "Pending"}</span></td>
                      <td onClick={(e) => e.stopPropagation()}><div className="row-actions">
                        <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setOpenId(s.id)} title="Open"><ChevronRight size={15} /></button>
                        {isAdmin && <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "deleteConfirm", title: "Delete test session?", body: `Delete "${s.title}"?`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => del(s) })}><Trash2 size={14} /></button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
