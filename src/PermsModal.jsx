export default function PermsModal({ person, onSave, onClose, runtime }) {
  const { useState, Modal, Check, GRANTABLE_MODULES } = runtime;
  const init = Array.isArray(person.perms?.modules) ? person.perms.modules : [];
  const [mods, setMods] = useState(init);
  const toggle = (k) => setMods((m) => m.includes(k) ? m.filter((x) => x !== k) : [...m, k]);
  return (
    <Modal title={`Module access — ${person.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { onSave(mods); onClose(); }}><Check size={15} />Save access</button></>}>
      <p className="hint-line" style={{ lineHeight: 1.55 }}>Tick the business modules {person.name} can open. Their personal screens — tasks, attendance, leave and daily updates — are always available.</p>
      <div className="perm-list">
        {GRANTABLE_MODULES.map(([k, label]) => (
          <label key={k} className="perm-item">
            <input type="checkbox" checked={mods.includes(k)} onChange={() => toggle(k)} />{label}
          </label>
        ))}
      </div>
    </Modal>
  );
}

