import React, { useState, useRef } from "react";
import * as Icons from "./icons.jsx";

export default function TestDetail({ sessionId, db, mutate, isAdmin, me, currentUser, team, openModal, onBack, onDelete, runtime = {} }) {
  const { testProgress, uid, haptic, TEST_MAX_IMAGES = 5, fileKind, uploadAttachment, storagePathFromUrl, supabase, testResultTone, TEST_IMAGE_TTL_DAYS = 30, fmtTime } = runtime;
  const { ArrowLeft, Empty, ClipboardCheck, FolderKanban, User, AlertTriangle, Check, CheckCircle2, XCircle, Bug, ImageIcon, Plus, Pencil, Trash2, RotateCcw, Send, FileText, RefreshCw, ListTodo, X } = { ...Icons, ...runtime };
  const s = (db.testing || []).find((x) => x.id === sessionId);
  const [newItem, setNewItem] = useState("");
  const [bugText, setBugText] = useState("");
  const [bugImgs, setBugImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const [notes, setNotes] = useState(s?.notes || "");
  const fileRef = useRef(null);

  if (!s) {
    return (
      <div className="content">
        <button className="backlink" onClick={onBack}><ArrowLeft size={15} />Back to testing</button>
        <div className="card"><Empty icon={<ClipboardCheck size={22} color="var(--muted)" />} title="Session not found" text="It may have been deleted. Check Recently deleted to restore it." /></div>
      </div>
    );
  }

  const isTester = s.assignedToId === me.id || (!!currentUser && s.assignedTo === currentUser);
  const canAct = isAdmin || isTester;   // tick items, add notes/bugs, set result
  const checklist = Array.isArray(s.checklist) ? s.checklist : [];
  const bugs = Array.isArray(s.bugs) ? s.bugs : [];
  const prog = testProgress(s);
  const patch = (fn, audit) => mutate((d) => ({ ...d, testing: (d.testing || []).map((x) => x.id === s.id ? fn(x) : x) }), audit || null);
  const A = (action) => ({ action, module: "Testing" });

  const toggle = (id) => {
    if (!canAct) return;
    patch((x) => ({ ...x, checklist: (x.checklist || []).map((i) => i.id === id ? { ...i, done: !i.done, by: currentUser, at: Date.now() } : i) }), A(`updated the checklist on "${s.title}"`));
  };
  const setItemNote = (id, note) => patch((x) => ({ ...x, checklist: (x.checklist || []).map((i) => i.id === id ? { ...i, note } : i) }));
  const addItem = () => { const t = newItem.trim(); if (!t || !isAdmin) return; patch((x) => ({ ...x, checklist: [...(x.checklist || []), { id: uid(), text: t, done: false, note: "", by: "", at: 0 }] }), A(`added a checklist item to "${s.title}"`)); setNewItem(""); };
  const removeItemRow = (id) => { if (!isAdmin) return; patch((x) => ({ ...x, checklist: (x.checklist || []).filter((i) => i.id !== id) }), A(`updated the checklist on "${s.title}"`)); };
  const setResult = (r) => { if (!canAct) return; haptic(r === "Passed" ? [10, 40, 10] : 12); patch((x) => ({ ...x, result: r }), A(r === "Pending" ? `reset test "${s.title}" to Pending` : `marked test "${s.title}" as ${r}`)); };

  const pickImages = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setImgErr("");
    const room = TEST_MAX_IMAGES - bugImgs.length;
    if (room <= 0) { setImgErr(`Up to ${TEST_MAX_IMAGES} screenshots per report.`); if (e.target) e.target.value = ""; return; }
    setBusy(true);
    try {
      for (const file of files.slice(0, room)) {
        if (fileKind(file) !== "image") { setImgErr("Only image files can be attached here."); continue; }
        const up = await uploadAttachment(file);
        setBugImgs((prev) => prev.length >= TEST_MAX_IMAGES ? prev : [...prev, { url: up.url, name: up.name, path: up.path || storagePathFromUrl(up.url), at: Date.now() }]);
      }
    } catch (er) { setImgErr(er.message || "Upload failed."); }
    finally { setBusy(false); if (e.target) e.target.value = ""; }
  };
  const addBug = () => {
    const t = bugText.trim(); if ((!t && !bugImgs.length) || !canAct) return;
    const bug = { id: uid(), text: t, images: bugImgs, by: currentUser, byId: me.id, at: Date.now() };
    patch((x) => ({ ...x, bugs: [...(x.bugs || []), bug] }), A(`reported an issue on "${s.title}"`));
    setBugText(""); setBugImgs([]); setImgErr("");
  };
  const removeBug = (bug) => {
    if (!(isAdmin || bug.byId === me.id)) return;
    // best-effort remove the stored screenshots so they don't linger
    const paths = (bug.images || []).map((im) => im.path || storagePathFromUrl(im.url)).filter(Boolean);
    if (paths.length) { try { supabase.storage.from("attachments").remove(paths); } catch { /* ignore */ } }
    patch((x) => ({ ...x, bugs: (x.bugs || []).filter((b) => b.id !== bug.id) }), A(`removed an issue from "${s.title}"`));
  };
  const saveNotes = () => { if (notes !== (s.notes || "")) patch((x) => ({ ...x, notes })); };

  return (
    <div className="content">
      <button className="backlink" onClick={onBack}><ArrowLeft size={15} />Back to testing</button>
      <div className="detail-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{s.title}</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            {s.projectName ? <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FolderKanban size={12} />{s.projectName}</span> : <span className="tag">General</span>}
            <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><User size={12} />{s.assignedTo || "Unassigned"}</span>
            <span className={"badge " + testResultTone(s.result)}>{s.result || "Pending"}</span>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn sm" onClick={() => openModal({ type: "testSession", initial: s })}><Pencil size={13} />Edit</button>
            <button className="btn sm danger" onClick={() => openModal({ type: "deleteConfirm", title: "Delete test session?", body: `Delete "${s.title}"? Its checklist and reports will be removed.`, note: "Moves to Recently deleted — restore within 60 days.", onConfirm: () => { onDelete(s); onBack(); } })}><Trash2 size={13} />Delete</button>
          </div>
        )}
      </div>

      {/* result controls */}
      <div className="card stat" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="lbl"><ClipboardCheck size={14} /> Checklist progress</div>
          <div className="num mono" style={{ fontSize: 22 }}>{prog.done}/{prog.total}</div>
        </div>
        <div style={{ minWidth: 180, flex: 1 }}>
          <div className="progress-track"><div className="progress-fill" style={{ width: (prog.total ? Math.round((prog.done / prog.total) * 100) : 0) + "%", background: s.result === "Failed" ? "var(--neg)" : s.result === "Passed" ? "var(--pos)" : "var(--primary)" }} /></div>
        </div>
        {canAct && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className={"btn sm " + (s.result === "Passed" ? "primary" : "")} onClick={() => setResult("Passed")}><CheckCircle2 size={14} />Pass</button>
            <button className={"btn sm " + (s.result === "Failed" ? "danger" : "")} onClick={() => setResult("Failed")}><XCircle size={14} />Fail</button>
            {s.result !== "Pending" && <button className="btn sm" onClick={() => setResult("Pending")}><RotateCcw size={13} />Reset</button>}
          </div>
        )}
      </div>

      {/* checklist */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><ListTodo size={16} />Checklist</div>
        <div style={{ padding: "6px 16px 12px" }}>
          {checklist.length === 0 ? <div className="hint-line" style={{ padding: "14px 0" }}>No checklist items yet.{isAdmin ? " Add the first below." : ""}</div>
            : checklist.map((i) => (
              <div key={i.id} className="check-item">
                <div className={"check-box" + (i.done ? " done" : "")} role="checkbox" tabIndex={0} aria-checked={!!i.done} onClick={() => canAct && toggle(i.id)} onKeyDown={(e) => { if (canAct && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(i.id); } }} title={canAct ? "Toggle" : "Read-only"} style={{ cursor: canAct ? "pointer" : "default" }}>{i.done && <Check size={14} />}</div>
                <div className="check-main" style={{ flex: 1, minWidth: 0 }}>
                  <div className={"check-txt" + (i.done ? " done" : "")}>{i.text}</div>
                  {canAct
                    ? <input className="input" style={{ marginTop: 6, fontSize: 13, padding: "6px 10px" }} value={i.note || ""} onChange={(e) => setItemNote(i.id, e.target.value)} placeholder="Add a note (e.g. crashes on Samsung A34)…" />
                    : (i.note ? <div className="hint-line" style={{ marginTop: 4 }}>{i.note}</div> : null)}
                  {i.done && i.by && <div className="hint-line" style={{ marginTop: 4, fontSize: 11 }}>Tested by {i.by} · {fmtTime(i.at)}</div>}
                </div>
                {isAdmin && <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => removeItemRow(i.id)} title="Remove item"><X size={13} /></button>}
              </div>
            ))}
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="Add a checklist item…" />
              <button className="btn" onClick={addItem}><Plus size={15} />Add</button>
            </div>
          )}
        </div>
      </div>

      {/* bug reports */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Bug size={16} />Issues & bug reports <span className="hint-line" style={{ fontWeight: 500, marginLeft: "auto" }}>Screenshots auto-delete after {TEST_IMAGE_TTL_DAYS} days</span></div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {bugs.length === 0 && <div className="hint-line">No issues reported yet.</div>}
          {bugs.map((b) => (
            <div key={b.id} className="bug-card">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {b.text && <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{b.text}</div>}
                  <div className="hint-line" style={{ marginTop: 4, fontSize: 11 }}>{b.by || "—"} · {fmtTime(b.at)}</div>
                </div>
                {(isAdmin || b.byId === me.id) && <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => removeBug(b)} title="Delete report"><Trash2 size={13} /></button>}
              </div>
              {(b.images || []).length > 0 && (
                <div className="thumb-row">
                  {(b.images || []).map((im, idx) => <img key={idx} className="thumb" src={im.url} alt={im.name || "screenshot"} onClick={() => window.open(im.url, "_blank", "noreferrer")} />)}
                </div>
              )}
            </div>
          ))}
          {canAct && (
            <div style={{ borderTop: bugs.length ? "1px solid var(--border)" : "none", paddingTop: bugs.length ? 12 : 0 }}>
              <textarea className="textarea" style={{ minHeight: 64 }} value={bugText} onChange={(e) => setBugText(e.target.value)} placeholder="Describe the issue…" />
              {imgErr && <div className="field-err" style={{ marginTop: 6 }}><AlertTriangle size={13} />{imgErr}</div>}
              <div className="thumb-row" style={{ marginTop: 10 }}>
                {bugImgs.map((im, idx) => (
                  <div key={idx} style={{ position: "relative" }}>
                    <img className="thumb" src={im.url} alt={im.name} />
                    <button className="iconbtn" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%" }} onClick={() => setBugImgs((p) => p.filter((_, i) => i !== idx))}><X size={12} /></button>
                  </div>
                ))}
                {bugImgs.length < TEST_MAX_IMAGES && (
                  <label className="thumb-add-label" htmlFor="test-screenshot-upload" title="Add screenshot">{busy ? <RefreshCw size={18} className="spin" /> : <ImageIcon size={18} />}</label>
                )}
                <input id="test-screenshot-upload" ref={fileRef} type="file" accept="image/*" multiple onChange={pickImages} style={{ display: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn primary" onClick={addBug} disabled={busy || (!bugText.trim() && !bugImgs.length)}><Send size={14} />Add report</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* session notes */}
      <div className="card stat">
        <div className="lbl" style={{ marginBottom: 8 }}><FileText size={14} /> Session notes</div>
        {canAct
          ? <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Overall notes for this test session…" />
          : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: s.notes ? "var(--ink)" : "var(--muted)" }}>{s.notes || "No notes."}</div>}
      </div>
    </div>
  );
}
