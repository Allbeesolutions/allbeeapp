import React from "react";

export default function APNAdminContent({ db, openModal, removeRow, runtime = {} }) {
  const { fmtDate, Empty, FileText, Download, Eye, Trash2, Plus, Search } = runtime;
  const training = (db.apn_training || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const quizzes = (db.apn_quizzes || []);
  return (
    <div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Training</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnTraining" })}><Plus size={15} />Lesson</button></div>
      <div className="apn-list" style={{ marginBottom: 18 }}>
        {training.length === 0 ? <div className="card stat"><Empty icon={<GraduationCap size={20} color="var(--muted)" />} title="No lessons yet" text="Add sales training for each category." /></div>
          : training.map((t) => (
            <div key={t.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{APN_SERVICE_LABEL[t.category]}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{t.title}</div>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnTraining", initial: t })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_training", t.id, `deleted APN lesson "${t.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
      <div className="page-head" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 16 }}>Quizzes</h3><span className="spacer" /><button className="btn primary" onClick={() => openModal({ type: "apnQuiz" })}><Plus size={15} />Quiz</button></div>
      <div className="apn-list">
        {quizzes.length === 0 ? <div className="card stat"><Empty icon={<ClipboardCheck size={20} color="var(--muted)" />} title="No quizzes yet" text="A passed quiz unlocks that category's lead submission for partners." /></div>
          : quizzes.map((qz) => (
            <div key={qz.id} className="card stat" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tag">{APN_SERVICE_LABEL[qz.category]}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{qz.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{(qz.questions || []).length} questions · pass {qz.passPct || 60}%</div></div>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => openModal({ type: "apnQuiz", initial: qz })}><Pencil size={14} /></button>
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_quizzes", qz.id, `deleted APN quiz "${qz.title}"`)}><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
