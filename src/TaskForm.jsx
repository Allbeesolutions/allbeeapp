import React, { useState, useMemo } from "react";

export default function TaskForm({ initial, onSave, onClose, currentUser, team = [], people = [], isAdmin = true, runtime }) {
  const { Modal, Field, Check, uid, USERS, COMBINED, PRIORITIES } = runtime;
  // Everyone (admins, staff AND interns) can assign a task to one or more
  // teammates. The roster always includes the person creating it, so they can
  // assign work to themselves too.
  const roster = team.includes(currentUser) ? team : [currentUser, ...team];
  // name → stable user id, so a saved task keeps pointing at the right person
  // even if their display name is edited later (fixes assigned tasks that stop
  // showing up for the assignee). Legacy tasks with no ids still match by name.
  const idByName = useMemo(() => {
    const m = {};
    (people || []).forEach((p) => { if (p && p.name && p.id) m[p.name] = p.id; });
    return m;
  }, [people]);
  const initialAssignees = () => {
    if (Array.isArray(initial?.assignees) && initial.assignees.length) return initial.assignees.slice();
    if (initial?.assignedTo === COMBINED) return USERS.slice();
    if (initial?.assignedTo) return [initial.assignedTo];
    return [currentUser];
  };
  const [f, setF] = useState(() => ({
    title: "", desc: "", assignedBy: currentUser,
    priority: "Medium", due: "", notes: "", ...initial,
    assignees: initialAssignees(),
  }));
  const up = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleAssignee = (name) => setF((s) => ({
    ...s,
    assignees: s.assignees.includes(name) ? s.assignees.filter((x) => x !== name) : [...s.assignees, name],
  }));
  const valid = f.title.trim().length > 0 && f.assignees.length > 0;
  const save = () => {
    if (!valid) return;
    const assignees = f.assignees.slice();
    // Keep a readable `assignedTo` string for older/simple views, and preserve
    // the special two-partner label so existing combined-task behaviour is unchanged.
    const bothPartners = assignees.length === USERS.length && USERS.every((u) => assignees.includes(u));
    const assignedTo = assignees.length === 1 ? assignees[0] : bothPartners ? COMBINED : assignees.join(", ");
    // Attach stable ids next to the names (missing when someone isn't in the
    // roster yet — matching then simply falls back to the name).
    const assigneeIds = assignees.map((n) => idByName[n]).filter(Boolean);
    const assignedById = idByName[f.assignedBy] || initial?.assignedById || null;
    onSave({
      ...initial, id: initial?.id || uid(), title: f.title.trim(), desc: f.desc.trim(),
      assignedBy: f.assignedBy, assignedById, assignedTo, assignees, assigneeIds, priority: f.priority, due: f.due,
      notes: f.notes.trim(), status: initial?.status || "Created", progress: initial?.progress ?? 0,
      history: initial?.history || [{ status: "Created", at: Date.now(), by: f.assignedBy }],
      comments: initial?.comments || [], attachments: initial?.attachments || [], accepts: initial?.accepts || [],
      createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal title={initial?.id ? "Edit task" : "New task"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!valid}><Check size={16} />{initial?.id ? "Save task" : "Create task"}</button></>}>
      <Field label="Task title" required><input className="input" value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="Design the landing page" /></Field>
      <Field label="Description"><textarea className="textarea" value={f.desc} onChange={(e) => up("desc", e.target.value)} placeholder="Full, detailed instructions — write as much as you need." /></Field>
      <Field label="Assigned by"><input className="input" value={f.assignedBy} disabled style={{ opacity: .7 }} /></Field>
      <Field label={`Assign to${f.assignees.length > 1 ? ` · ${f.assignees.length} people` : ""}`} required
        hint={f.assignees.length > 1 ? "Everyone selected must accept before the task can start; any of them can complete it." : undefined}>
        <div className="perm-list">
          {roster.map((n) => (
            <label key={n} className="perm-item">
              <input type="checkbox" checked={f.assignees.includes(n)} onChange={() => toggleAssignee(n)} />{n}{n === currentUser ? " (you)" : ""}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid2">
        <Field label="Priority"><select className="select" value={f.priority} onChange={(e) => up("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Due date"><input className="input" type="date" value={f.due} onChange={(e) => up("due", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" style={{ minHeight: 60 }} value={f.notes} onChange={(e) => up("notes", e.target.value)} /></Field>
    </Modal>
  );
}
