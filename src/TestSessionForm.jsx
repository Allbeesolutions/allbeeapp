import React, { useState } from "react";

export default function TestSessionForm({ initial, projects = [], team = [], onSave, onClose, runtime }) {
  const { Modal, Field, Check, uid } = runtime;
  const [f, setF] = useState(() => ({
    title: "", projectId: "", projectName: "", assignedTo: "", assignedToId: "", notes: "",
    checklistText: (Array.isArray(initial?.checklist) ? initial.checklist.map((i) => i.text).join("\n") : ""),
    ...initial,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [err, setErr] = useState("");
  const roster = (team || []).filter((p) => p.role !== "client" && p.active !== false);
  const save = () => {
    if (!f.title.trim()) { setErr("Give the test session a title."); return; }
    const proj = projects.find((p) => p.id === f.projectId);
    const tester = roster.find((p) => p.id === f.assignedToId);
    // preserve existing checklist state; only add/rename from the text box
    const prev = Array.isArray(initial?.checklist) ? initial.checklist : [];
    const lines = f.checklistText.split("\n").map((l) => l.trim()).filter(Boolean);
    const checklist = lines.map((text, i) => {
      const match = prev[i] && prev[i].text === text ? prev[i] : prev.find((p) => p.text === text);
      return match || { id: uid(), text, done: false, note: "", by: "", at: 0 };
    });
    onSave({
      ...initial, id: initial?.id || uid(),
      title: f.title.trim(),
      projectId: proj ? proj.id : (f.projectId || ""),
      projectName: proj ? proj.name : (f.projectName || ""),
      assignedTo: tester ? tester.name : (f.assignedTo || ""),
      assignedToId: tester ? tester.id : (f.assignedToId || ""),
      checklist,
      bugs: Array.isArray(initial?.bugs) ? initial.bugs : [],
      result: initial?.result || "Pending",
      notes: f.notes.trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit test session" : "New test session"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}><Check size={16} />Save session</button></>}>
      <Field label="Title" required error={err}><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AllBee App — release check" /></Field>
      <div className="grid2">
        <Field label="Project" hint="Testing history belongs to this project.">
          {projects.length ? (
            <select className="select" value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">— General / no project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input className="input" value={f.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="Project name" />
          )}
        </Field>
        <Field label="Assign tester">
          <select className="select" value={f.assignedToId} onChange={(e) => set("assignedToId", e.target.value)}>
            <option value="">— Unassigned —</option>
            {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Checklist" hint="One item per line — add as many as you like.">
        <textarea className="textarea" style={{ minHeight: 130 }} value={f.checklistText} onChange={(e) => set("checklistText", e.target.value)}
          placeholder={"Login works\nDashboard works\nTasks working\nNotifications working\nMobile responsive\nSearch working\nDark mode working\nAttendance working"} />
      </Field>
      <Field label="Notes"><textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the tester should know…" /></Field>
    </Modal>
  );
}
