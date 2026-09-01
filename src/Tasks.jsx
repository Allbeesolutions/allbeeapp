import React, { useMemo, useState } from "react";
import * as Icons from "./icons.jsx";

export default function Tasks(props) {
  const { db, mutate, openModal, isAdmin = true, currentUser, me, openTask, removeItem } = props;
  const { Empty, Progress, assigneeText, avatarColor, canActOnTask, canEditTask, fmtDate, haptic, isMultiAssignee, isTaskAssignee, nextTaskState, priorityTone, taskAction, taskAssignees } = props.runtime || {};
  const { ArrowRight, CalendarClock, ExternalLink, ListTodo, Pencil, Plus, ShieldCheck, Trash2, Undo2 } = Icons;

  const [filter, setFilter] = useState("active");
  const [scope, setScope] = useState("mine"); // staff: mine | assigned
  const who = me || { name: currentUser };
  const list = useMemo(() => {
    let r = [...db.tasks].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!isAdmin) r = r.filter((t) => scope === "assigned"
      ? ((who.id && t.assignedById === who.id) || t.assignedBy === currentUser)
      : isTaskAssignee(t, who));
    if (filter === "active") r = r.filter((t) => t.status !== "Completed");
    else if (filter === "progress") r = r.filter((t) => t.status === "In Progress");
    else if (filter === "done") r = r.filter((t) => t.status === "Completed");
    return r;
  }, [db.tasks, filter, scope, isAdmin, currentUser, who.id, who.name]);

  const auditFor = (action) => ({ action, module: "Tasks" });

  // advance is only ever called by the assigned person (button is gated below).
  // A task assigned to both partners needs each of them to Accept before Start.
  const advance = (t) => {
    const patch = nextTaskState(t, currentUser);
    const note = patch.status ? `moved "${t.title}" to ${patch.status}` : `accepted "${t.title}"`;
    haptic(patch.status === "Completed" ? [10, 40, 10] : 12);
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, ...patch } : x) }), auditFor(note));
  };
  const undo = (t) => {
    const history = [...(t.history || []), { status: "In Progress", at: Date.now(), by: currentUser }];
    mutate((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, status: "In Progress", progress: Math.min(t.progress ?? 90, 90), history } : x) }),
      auditFor(`restored task "${t.title}" from Completed to In Progress`));
  };
  const askDelete = (t) => openModal({
    type: "deleteConfirm", title: "Delete task?",
    body: `This moves "${t.title}" to Recently deleted.`, note: "You can restore it within 60 days.",
    onConfirm: () => removeItem("tasks", t, { name: t.title, audit: `deleted task "${t.title}"` }),
  });

  return (
    <div className="content">
      <div className="page-head"><h3>{isAdmin ? "Tasks" : "My tasks"}</h3><span className="spacer" />
        <button className="btn primary" onClick={() => openModal({ type: "task" })}><Plus size={16} />New task</button></div>
      <div className="toolbar">
        <div className="seg">{[["all", "All"], ["active", "Active"], ["progress", "Progress"], ["done", "Completed"]].map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
        {!isAdmin && <div className="seg">{[["mine", "Assigned to me"], ["assigned", "I assigned"]].map(([k, l]) => <button key={k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>{l}</button>)}</div>}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty icon={<ListTodo size={22} color="var(--muted)" />} title="No tasks here"
            text={isAdmin ? "Assign work to anyone on the team. Tasks move Created → Accepted → In Progress → Completed." : "Tasks assigned to you will appear here. Accept one to get started."}
            action={<button className="btn primary" onClick={() => openModal({ type: "task" })}><Plus size={16} />New task</button>} />
        ) : list.map((t) => {
          const canAct = canActOnTask(t, currentUser);
          const canEdit = canEditTask(t, currentUser, isAdmin);
          const act = canAct ? taskAction(t, currentUser) : null;
          return (
            <div key={t.id} className="item-row">
              <div className="item-main">
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  {t.num != null && <span className="badge mono" style={{ fontWeight: 700 }}>#{t.num}</span>}
                  <button className="ttl-link" onClick={() => openTask(t.id)}>{t.title}</button>
                  <span className={"badge " + (t.status === "Completed" ? "pos" : t.status === "In Progress" ? "accent" : "pri")}>{t.status}</span>
                  {t.priority && <span className={"badge " + priorityTone(t.priority)}>{t.priority}</span>}
                </div>
                {t.desc && <div className="item-meta" style={{ marginTop: 6 }}>{t.desc.length > 140 ? t.desc.slice(0, 140) + "…" : t.desc}</div>}
                <div className="item-meta" style={{ marginTop: 6 }}>
                  <span>{t.assignedBy} → <b style={{ color: isMultiAssignee(t) ? "var(--ink)" : avatarColor(taskAssignees(t)[0]) }}>{assigneeText(t)}</b></span>
                  {t.due && <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> {fmtDate(t.due)}</span>}
                  {!canAct && t.status !== "Completed" && <span className="hint-line" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ShieldCheck size={11} />{isAdmin ? "Monitor only — " : ""}{isMultiAssignee(t) ? "assignees control status" : `${assigneeText(t)} controls status`}</span>}
                </div>
              </div>
              <div className="row-actions">
                {act && <button className="btn sm primary" disabled={act.disabled} onClick={() => { if (!act.disabled) advance(t); }}>{act.label}<ArrowRight size={13} /></button>}
                {t.status === "Completed" && (canAct || canEdit) && <button className="btn sm" onClick={() => undo(t)}><Undo2 size={13} />Undo</button>}
                <button className="iconbtn" style={{ width: 32, height: 32 }} title="Open task" onClick={() => openTask(t.id)}><ExternalLink size={14} /></button>
                {canEdit && <button className="iconbtn" style={{ width: 32, height: 32 }} title="Edit" onClick={() => openModal({ type: "task", initial: t })}><Pencil size={14} /></button>}
                {canEdit && <button className="iconbtn" style={{ width: 32, height: 32 }} title="Delete" onClick={() => askDelete(t)}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
