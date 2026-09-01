export default function ManageUserModal({ person, onClose, onActivity, runtime }) {
  const { useState, Modal, Field, PasswordField, supabase, useUsernameAvailability, TypedConfirm, emitToast, AlertTriangle, Check, Trash2 } = runtime;
  const [designation, setDesignation] = useState(person.designation || "");
  const [username, setUsername] = useState(person.username || "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const usernameCheck = useUsernameAvailability(username, person.id);
  const call = async (body) => { setBusy(true); setMsg(""); setErr(""); try { const { data, error } = await supabase.functions.invoke("admin-users", { body }); if (error) throw error; if (data && data.error) throw new Error(data.error); return true; } catch (e) { setErr((e && e.message) || "Action failed. Is the admin-users function deployed?"); return false; } finally { setBusy(false); } };
  const saveDes = async () => {
    setBusy(true); setMsg(""); setErr("");
    try { const { error } = await supabase.from("profiles").update({ designation: designation.trim() || null }).eq("id", person.id); if (error) throw error; onActivity?.({ action: `updated ${person.name}'s job title`, module: "System", entity: "User", entityId: person.id }); setMsg("Job title updated."); }
    catch (e) { setErr((e && e.message) || "Couldn't update the job title."); }
    finally { setBusy(false); }
  };
  const resetPw = async () => { if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; } if (await call({ action: "reset_password", userId: person.id, password: pw })) { onActivity?.({ action: `reset password for ${person.name}`, module: "System", entity: "User", entityId: person.id }); setMsg("Password reset."); setPw(""); } };
  const saveUsername = async () => {
    setBusy(true); setMsg(""); setErr("");
    const uname = username.trim().toLowerCase().replace(/\s+/g, "") || null;
    if (uname && usernameCheck.available === false) { setBusy(false); setErr("That username is already taken."); return; }
    try { const { error } = await supabase.from("profiles").update({ username: uname }).eq("id", person.id); if (error) throw error; onActivity?.({ action: `updated ${person.name}'s username`, module: "System", entity: "User", entityId: person.id }); setMsg("Username updated."); }
    catch (e) { setErr((e && e.message && /duplicate|unique/i.test(e.message)) ? "That username is already taken." : ((e && e.message) || "Couldn't update the username.")); }
    finally { setBusy(false); }
  };
  const removeUser = async () => {
    if (person.role === "superadmin" || person.role === "partner" || person.role === "district_head" || person.role === "state_head") { setErr("APN and Super Admin accounts use their dedicated lifecycle controls."); return; }
    setBusy(true); setMsg(""); setErr("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: person.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onActivity?.({ action: `deleted user "${person.name}"`, module: "System", entity: "User", entityId: person.id });
      emitToast("User deleted; login access and email reservation were removed.", "success");
      onClose();
    } catch (e) { setErr((e && e.message) || "Couldn't delete the user. No account data was removed."); }
    finally { setBusy(false); setConfirmDelete(false); }
  };
  return (
    <>
    <Modal title={"Manage " + person.name} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <Field label="Job title / designation"><div style={{ display: "flex", gap: 8 }}><input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Developer" /><button className="btn primary" onClick={saveDes} disabled={busy}>Save</button></div></Field>
      <div className="field"><label>Username</label><div style={{ display: "flex", gap: 8 }}><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya" aria-describedby="manage-username-status" /><button className="btn primary" onClick={saveUsername} disabled={busy}>Save</button></div><div id="manage-username-status" className="hint-line" style={{ color: usernameCheck.available === false ? "var(--neg)" : usernameCheck.available === true ? "var(--pos)" : undefined }}>{username.trim() ? usernameCheck.checking ? "Checking availability…" : usernameCheck.available === false ? "Username already taken" : usernameCheck.available === true ? "Username available" : "Availability will be checked when saved." : "They can sign in with this instead of their email."}</div></div>
      <div className="field"><PasswordField label="Reset password" hint="Sets a new password for this user immediately." value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" /><button className="btn primary" onClick={resetPw} disabled={busy}>Reset</button></div>
      {err && <div className="auth-msg err"><AlertTriangle size={14} /> {err}</div>}
      {msg && <div className="auth-msg ok"><Check size={14} /> {msg}</div>}
      {!(["superadmin", "partner", "district_head", "state_head"].includes(person.role)) && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div className="lbl" style={{ fontSize: 12, fontWeight: 700, color: "var(--neg)", marginBottom: 6 }}>Danger zone</div>
          <p className="hint-line" style={{ marginBottom: 10 }}>Permanently delete this account. Their login and profile are removed and the email/username can be reused to re-create them.</p>
          <button className="btn danger" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={15} />Delete user</button>
        </div>
      )}
      <p className="hint-line" style={{ marginTop: 12 }}>Delete, password reset and adding users need the <b>admin-users</b> edge function deployed. Username and job title save directly.</p>
    </Modal>
    {confirmDelete && <TypedConfirm title={`Delete ${person.name}?`} body="This removes the login identity and profile. Existing business, financial, audit, and timeline records are retained." note="The email and username become available again only after the auth identity is successfully removed." actionLabel="Delete user" onConfirm={removeUser} onClose={() => setConfirmDelete(false)} />}
    </>
  );
}
