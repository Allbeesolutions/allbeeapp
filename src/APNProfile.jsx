import React from "react";

export default function APNProfile({ db, meRow, stats, snap, profile, sessionEmail, mutate, onSignOut, reload, isHead, go, runtime = {} }) {
  const { apnSnapshotWallet, apnSnapshotRate, apnGovernedLimit, useState, useRef, useEffect, apnAvatarUrl, supabase, uploadAttachment, Field, APNMetric, money, TrendingUp, Coins, Award, ShieldHalf, ShieldCheck, apnCalculatedGovernedExplanation, Avatar, Upload, Check, apnIdFor, APNBankDetails, LogOut } = runtime;
  const snapWallet = apnSnapshotWallet(snap);
  const effRate = apnSnapshotRate(snap, stats.completed) ?? stats.level.rate;
  const governed = apnGovernedLimit(db, meRow.id);
  const [f, setF] = useState(() => ({
    name: meRow.name || "", username: meRow.username || profile?.username || "", email: meRow.email || profile?.email || sessionEmail || "", mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "",
    address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", photoUrl: apnAvatarUrl(meRow, profile),
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [usernameState, setUsernameState] = useState("idle");
  const photoRef = useRef(null);
  const set = (key, value) => { setSaved(false); setF((current) => ({ ...current, [key]: value })); };
  useEffect(() => {
    setF({ name: meRow.name || "", username: meRow.username || profile?.username || "", email: meRow.email || profile?.email || sessionEmail || "", mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "", address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", photoUrl: apnAvatarUrl(meRow, profile) });
  }, [meRow.id, meRow.updatedAt, profile?.id, profile?.updated_at, sessionEmail]);
  const normalizedUsername = f.username.trim().toLowerCase().replace(/\s+/g, "");
  useEffect(() => {
    if (!normalizedUsername || normalizedUsername === String(meRow.username || profile?.username || "").toLowerCase()) { setUsernameState(normalizedUsername ? "available" : "idle"); return undefined; }
    let cancelled = false;
    setUsernameState("checking");
    const timer = setTimeout(async () => {
      const localTaken = (db.apn_users || []).some((u) => u.id !== meRow.id && String(u.username || "").toLowerCase() === normalizedUsername);
      if (localTaken) { if (!cancelled) setUsernameState("taken"); return; }
      const { data, error } = await supabase.from("profiles").select("id").ilike("username", normalizedUsername).neq("id", meRow.id).limit(1);
      if (!cancelled) setUsernameState(error ? "unknown" : data?.length ? "taken" : "available");
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [db.apn_users, meRow.id, meRow.username, normalizedUsername, profile?.username]);
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const ext = String(file.name || "").split(".").pop()?.toLowerCase();
    if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") || !["jpg", "jpeg", "png", "webp"].includes(ext)) { setErr("Choose a JPG, JPEG, PNG, or WEBP image."); event.target.value = ""; return; }
    setUploading(true); setErr("");
    try { const uploaded = await uploadAttachment(file); set("photoUrl", uploaded.url); }
    catch (error) { setErr(error.message || "Couldn't upload that image."); }
    finally { setUploading(false); event.target.value = ""; }
  };
  const save = async () => {
    setErr(""); setSaved(false);
    if (!f.name.trim()) return setErr("Enter your full name.");
    if (f.mobile.replace(/\D/g, "").length < 7) return setErr("Enter a valid mobile number.");
    if (!f.email.trim()) return setErr("Enter an email address.");
    if (!f.dob) return setErr("Add your date of birth.");
    if (!normalizedUsername) return setErr("Enter a username.");
    if (usernameState === "taken" || usernameState === "checking" || usernameState === "unknown") return setErr(usernameState === "unknown" ? "Username availability could not be verified. Try again." : "Choose an available username.");
    setBusy(true);
    try {
      const { data: conflicts, error: conflictError } = await supabase.from("profiles").select("id").ilike("username", normalizedUsername).neq("id", meRow.id).limit(1);
      if (conflictError) throw new Error(conflictError.message);
      if (conflicts?.length || (db.apn_users || []).some((u) => u.id !== meRow.id && String(u.username || "").toLowerCase() === normalizedUsername)) throw new Error("That username is already taken.");
      const previousEmail = String(meRow.email || profile?.email || sessionEmail || "").trim().toLowerCase();
      if (f.email.trim().toLowerCase() !== previousEmail) {
        const { error: authError } = await supabase.auth.updateUser({ email: f.email.trim().toLowerCase() });
        if (authError) throw new Error(authError.message);
      }
      const { error: profileError } = await supabase.from("profiles").update({ name: f.name.trim(), username: normalizedUsername, email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), dob: f.dob || null, photo_url: f.photoUrl || null }).eq("id", meRow.id);
      if (profileError) throw new Error(profileError.message);
      const at = Date.now();
      const nextProfile = { name: f.name.trim(), username: normalizedUsername, email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), dob: f.dob || "", address: f.address.trim(), district: f.district.trim(), taluk: f.taluk.trim(), city: f.city.trim(), occupation: f.occupation.trim(), college: f.college.trim(), profilePicture: f.photoUrl || "" };
      const previousProfile = { name: meRow.name || "", username: meRow.username || profile?.username || "", email: previousEmail, mobile: meRow.mobile || profile?.mobile || "", dob: meRow.dob || profile?.dob || "", address: meRow.address || "", district: meRow.district || "", taluk: meRow.taluk || "", city: meRow.city || "", occupation: meRow.occupation || "", college: meRow.college || "", profilePicture: apnAvatarUrl(meRow, profile) };
      const changedFields = Object.keys(nextProfile).filter((key) => String(previousProfile[key] ?? "") !== String(nextProfile[key] ?? ""));
      const profileAction = changedFields.includes("profilePicture") ? (nextProfile.profilePicture ? "changed APN profile picture" : "removed APN profile picture") : "updated own APN profile";
      mutate((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === meRow.id ? { ...u, ...nextProfile, updatedAt: at } : u) }), { action: profileAction, module: "APN", partnerId: meRow.id, previousValue: previousProfile, newValue: nextProfile, metadata: { changedFields } });
      setSaved(true);
    } catch (error) { setErr(error.message || "Couldn't save your profile."); }
    finally { setBusy(false); }
  };
  const field = (label, key, type = "text") => <Field label={label}><input className="input" type={type} value={f[key]} onChange={(e) => set(key, e.target.value)} /></Field>;
  return (
    <div>
      <div className="apn-section-h">My profile</div>
      {isHead && <div className="banner" style={{ margin: "0 0 12px" }}><ShieldHalf size={15} />You lead district {meRow.district || "—"} ({meRow.headRow || "Head"}). Manage members and revenue from the District tab.</div>}
      <div className="apn-metrics" style={{ marginBottom: 14 }}>
        <APNMetric k="Revenue generated" v={money(stats.revenue)} icon={<TrendingUp size={13} />} />
        <APNMetric k="Commission earned" v={money(snapWallet ? Number(snapWallet.earned) : stats.commission.earned)} icon={<Coins size={13} />} tone="pos" />
        <APNMetric k="Level" v={stats.level.name} icon={<Award size={13} />} />
      </div>
      {governed.full && <div className="banner" style={{ margin: "0 0 12px" }}><ShieldCheck size={15} />{apnCalculatedGovernedExplanation(db, meRow.id)} <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => go("targets")}>View targets</button></div>}
      <div className="apn-rowcard" style={{ marginBottom: 14 }}>
        <div className="apn-hero">
          <button type="button" aria-label="Change profile picture" onClick={() => photoRef.current?.click()} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", borderRadius: 999 }}><Avatar name={f.name} url={f.photoUrl} size={48} fontSize={19} /></button>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 17 }}>{f.name}</div><div className="hint-line">{apnIdFor(meRow)} · {stats.level.name}</div><div className="hint-line" style={{ fontSize: 12, marginTop: 4 }}>Click your photo to upload a new picture.</div></div>
          <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button className="btn sm" type="button" onClick={() => photoRef.current?.click()} disabled={uploading}><Upload size={13} />{uploading ? "Uploading…" : "Change picture"}</button>{f.photoUrl && <button className="btn sm" type="button" onClick={() => set("photoUrl", "")} disabled={uploading}>Remove picture</button>}</div>
      </div>
      <div className="apn-rowcard">
        <div className="hint-line" style={{ marginBottom: 12 }}>APN ID is permanent and cannot be edited.</div>
        {field("Full name", "name")}{field("Username", "username")}
        {f.username.trim() && <div className="hint-line" style={{ marginTop: -8, marginBottom: 10, color: usernameState === "taken" ? "var(--neg)" : usernameState === "available" ? "var(--pos)" : "var(--muted)" }}>{usernameState === "checking" ? "Checking username…" : usernameState === "taken" ? "Username is already taken." : usernameState === "available" ? "Username is available." : usernameState === "unknown" ? "Could not verify username availability." : ""}{usernameState === "taken" && <span> Try {normalizedUsername}1, {normalizedUsername}2, or {normalizedUsername}3.</span>}</div>}
        {field("Mobile number", "mobile")}{field("Email", "email", "email")}{field("Date of birth", "dob", "date")}
        {field("Full address", "address")}{field("District", "district")}{field("Taluk", "taluk")}{field("City", "city")}{field("Occupation", "occupation")}{field("College", "college")}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}><button className="btn primary" type="button" onClick={save} disabled={busy || uploading || usernameState === "taken" || usernameState === "checking"}>{busy ? "Saving…" : "Save changes"}</button></div>
        {err && <div className="auth-msg err" style={{ marginTop: 10 }}>{err}</div>}{saved && <div className="auth-msg ok" style={{ marginTop: 10 }}><Check size={14} />Profile saved.</div>}
      </div>
      <div className="apn-rowcard" style={{ marginTop: 14 }}>
        {[
          ["APN ID", apnIdFor(meRow)], ["Current level", `${stats.level.name} (Level ${stats.level.key})`], ["Commission rate", effRate + "%"],
        ].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}><span className="hint-line">{label}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{value || "—"}</span></div>)}
      </div>
      <APNBankDetails db={db} pid={meRow.id} reload={reload} />
      <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={onSignOut}><LogOut size={16} />Sign out</button>
    </div>
  );
}
