import React from "react";

export default function APNQuizTaker({ quiz, onPass, onClose, runtime }) {
  const { useState, Modal, Check, APN_SERVICE_LABEL } = runtime;
  const [ans, setAns] = useState({});
  const [result, setResult] = useState(null);
  const qs = quiz.questions || [];
  const submit = () => {
    const correct = qs.filter((q, i) => ans[i] === q.answer).length;
    const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
    setResult({ pct, correct, pass: pct >= (quiz.passPct || 60) });
    if (pct >= (quiz.passPct || 60)) onPass(pct);
  };
  return (
    <Modal title={quiz.title || "Quiz"} onClose={onClose}
      footer={result ? <button className="btn primary" onClick={onClose}>Done</button> : <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit} disabled={Object.keys(ans).length < qs.length}><Check size={15} />Submit quiz</button></>}>
      {result ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 40 }}>{result.pass ? "🎉" : "😕"}</div>
          <h3 style={{ margin: "8px 0" }}>{result.pct}% — {result.pass ? "Passed!" : "Not passed"}</h3>
          <p className="hint-line">{result.pass ? `${APN_SERVICE_LABEL[quiz.category]} leads are now unlocked.` : `You need ${quiz.passPct || 60}% to pass. Review the training and try again.`}</p>
        </div>
      ) : qs.map((q, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {q.q}</div>
          {(q.options || []).map((opt, oi) => (
            <div key={oi} className={"apn-quiz-opt" + (ans[i] === oi ? " sel" : "")} onClick={() => setAns((s) => ({ ...s, [i]: oi }))}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (ans[i] === oi ? "var(--primary)" : "var(--border)"), background: ans[i] === oi ? "var(--primary)" : "transparent", flex: "none" }} />
              <span>{opt}</span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
