import React, { useState, useMemo } from "react";
import "./allbee.css";

export default function Lock({ isDark, setDark, runtime }) {
  const { supabase, useUsernameAvailability, useEmailAvailability, emitToast, FounderTap, ToastHost, SearchableSelect, PasswordField, LoginAccessAssistant, LOGO_FULL, TN_DISTRICTS, USERS, avatarColor, Users, Building2, GaugeCircle, ArrowLeft, AlertTriangle, Check, RefreshCw, LogIn, Mail, Sun, Moon } = runtime;
  const [mode, setMode] = useState("signin"); // signin | signup
  const [entry, setEntry] = useState("choose"); // choose | form  (the two-button gate)
  const [loginAs, setLoginAs] = useState("employee"); // employee | client (display hint)
  const [acctType, setAcctType] = useState("staff"); // staff | owner
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");   // staff display name
  const [who, setWho] = useState("Haji"); // owner partner identity
  const [code, setCode] = useState("");   // admin access code
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const recoveryMessage = useMemo(() => {
    if (typeof window === "undefined") return "";
    const raw = `${window.location.search} ${window.location.hash}`.toLowerCase();
    return /otp_expired|access_denied|invalid.*token|expired.*token/.test(raw) ? "This password reset link is invalid or expired. Request a new reset email and use its latest link." : "";
  }, []);
  const referralFromUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const hashQuery = String(window.location.hash || "").split("?")[1] || "";
    return new URLSearchParams(`${window.location.search.replace(/^\?/, "")}${hashQuery ? `&${hashQuery}` : ""}`).get("ref")?.trim().toUpperCase() || "";
  }, []);
  const [apn, setApn] = useState(() => ({ mobile: "", dob: "", district: "", taluk: "", city: "", occupation: "", college: "", reason: "", username: "", referralCode: referralFromUrl }));
  const usernameCheck = useUsernameAvailability(apn.username);
  const emailCheck = useEmailAvailability(email);
  const upApn = (k, v) => setApn((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setErr(""); setNotice("");
    if (!email.trim() || !pw) { setErr("Enter your username or email and your password to continue."); return; }
    if (mode === "signup") {
      if (emailCheck.available === false) { setErr("That email already has an account. Sign in or use another email."); return; }
      if ((acctType === "staff" || acctType === "client") && !name.trim()) { setErr("Enter your name so we know who you are."); return; }
      if (acctType === "owner" && !code.trim()) { setErr("Enter the admin access code, or sign up as a team member instead."); return; }
      if (acctType === "partner") {
        if (!name.trim()) { setErr("Enter your full name."); return; }
        if (!apn.mobile.trim()) { setErr("Enter your mobile number."); return; }
        if (!apn.district) { setErr("Select your district."); return; }
        if (!apn.dob) { setErr("Enter your date of birth."); return; }
        const bd = new Date(apn.dob); const now = new Date();
        const age = now.getFullYear() - bd.getFullYear() - (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
        if (isNaN(age) || age < 18) { setErr("You must be at least 18 years old to join APN."); return; }
        if (usernameCheck.available === false) { setErr("That username is already taken. Choose another one."); return; }
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const invokePromise = supabase.functions.invoke("username-login", {
          body: { action: "sign_in", identifier: email, password: pw },
          timeout: 15000,
        });
        const { data, error } = await Promise.race([
          invokePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout:invoke")), 15000)),
        ]);
        if (error) throw Object.assign(new Error(authMessage(error)), { authStatus: authStatus(error) });
        if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error("Invalid login credentials.");
        const sessionResult = await Promise.race([
          supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Authentication session setup timed out. Please try again.")), 15000)),
        ]);
        if (sessionResult?.error) throw sessionResult.error;
      } else {
        const meta = acctType === "owner" ? { name: who, admin_code: code.trim() }
          : acctType === "client" ? { name: name.trim(), role_intent: "client" }
          : acctType === "partner" ? { name: name.trim(), role_intent: "partner", apn: { name: name.trim(), mobile: apn.mobile.trim(), dob: apn.dob, district: apn.district, taluk: apn.taluk.trim(), city: apn.city.trim(), occupation: apn.occupation.trim(), college: apn.college.trim(), reason: apn.reason.trim(), username: apn.username.trim().toLowerCase(), referralCode: apn.referralCode.trim().toUpperCase() } }
          : { name: name.trim() };
        const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pw, options: { data: meta } });
        if (error) throw error;
        if (!data.session) setNotice("Account created. Check your email to confirm it, then sign in.");
      }
    } catch (e) {
      console.error("Auth error:", e);
      const raw = (e && (e.message || e.error_description || e.msg || e.hint || e.details)) || (typeof e === "string" ? e : "");
      const clean = typeof raw === "string" ? raw.trim() : "";
      let msg = clean && clean !== "{}" ? clean : "";
      if (mode === "signin") msg = authMessage(e, "Authentication failed. Please try again.");
      else if (!msg || /database error saving new user/i.test(msg)) {
        msg = acctType === "partner"
          ? "We couldn't create the partner account. Your database may not allow the 'partner' role yet — see the APN setup (profiles.role must permit 'partner'). If it does, this email may already be registered; try another."
          : "We couldn't create the account. Please try again, or use a different email.";
      }
      setErr(msg);
    } finally { setBusy(false); }
  };
  const requestReset = async () => {
    setErr(""); setNotice("");
    if (!email.trim()) { setErr("Enter your email address, username, or APN ID before resetting your password."); return; }
    setResetBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("username-login", { body: { action: "request_reset", identifier: email, redirectTo: `${window.location.origin}${window.location.pathname}` } });
      if (error || data?.error) throw error || new Error(data.error);
      setNotice("Password reset email sent. Check your inbox for the secure reset link.");
      emitToast("Password reset email sent.", "success");
    } catch (e) { const msg = authMessage(e, "Password reset failed. Please try again."); setErr(msg); emitToast(msg, "error"); }
    finally { setResetBusy(false); }
  };
  const authStatus = (e) => {
    const direct = Number(e?.context?.status || e?.status || e?.response?.status);
    return Number.isFinite(direct) && direct > 0 ? direct : 0;
  };
  const authMessage = (e, fallback = "Authentication failed. Please try again.") => {
    const status = authStatus(e);
    const raw = String(e?.message || e || "");
    if (status === 401 || /invalid login credentials|invalid.*credential/i.test(raw)) return "Invalid username/email or password.";
    if (status === 402 || /exceed_egress_quota|payment required|quota/i.test(raw)) return "ALLBEE authentication is temporarily unavailable because the backend service has reached its usage limit. Please try again after service restoration.";
    if (status === 429 || /rate limit|too many requests|429/i.test(raw)) return "Too many authentication attempts. Please wait a minute and try again.";
    if (status >= 500 || /edge function|internal server|bad gateway|service unavailable/i.test(raw)) return "Authentication service is temporarily unavailable. Please try again shortly.";
    if (/timeout|abort|network|failed to fetch|fetch/i.test(raw)) return "We couldn't reach the authentication service. Check your connection and try again.";
    return fallback;
  };
  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="allbee lock" data-theme={isDark ? "dark" : "light"}>
      <ToastHost />
      <div className="lock-card">
        <FounderTap className="lock-logo" src={LOGO_FULL} alt="ALLBEE Solutions" />
        <p>{mode === "signin" ? (entry === "choose" ? "How would you like to sign in?" : (loginAs === "client" ? "Client sign in" : loginAs === "partner" ? "APN partner sign in" : "Employee sign in")) : "Create your account"}</p>

        {mode === "signin" && entry === "choose" ? (
          <>
            <div className="choose-stack" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6, width: "100%" }}>
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("employee"); setEntry("form"); setErr(""); }}><Users size={18} />Employee Login</button>
              <button className="btn" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("client"); setEntry("form"); setErr(""); }}><Building2 size={18} />Client Login</button>
              <button className="btn" style={{ width: "100%", justifyContent: "center", padding: "13px 14px" }} onClick={() => { setLoginAs("partner"); setEntry("form"); setErr(""); }}><GaugeCircle size={18} />APN Partner Login</button>
            </div>
            <button className="linkbtn" onClick={() => { setMode("signup"); setEntry("form"); setAcctType(loginAs === "client" ? "client" : loginAs === "partner" ? "partner" : "staff"); setErr(""); setNotice(""); }}>New here? Create an account</button>
          </>
        ) : (<>
        {mode === "signin" && <button className="linkbtn" style={{ marginBottom: 2, alignSelf: "flex-start" }} onClick={() => { setEntry("choose"); setErr(""); }}><ArrowLeft size={14} />Back</button>}

        {mode === "signup" && (
          <>
            <div className="seg" style={{ width: "100%", marginBottom: 16, flexWrap: "wrap" }}>
              <button type="button" className={acctType === "staff" ? "on" : ""} onClick={() => setAcctType("staff")}>Team member</button>
              <button type="button" className={acctType === "client" ? "on" : ""} onClick={() => setAcctType("client")}>Client</button>
              <button type="button" className={acctType === "partner" ? "on" : ""} onClick={() => setAcctType("partner")}>APN partner</button>
              <button type="button" className={acctType === "owner" ? "on" : ""} onClick={() => setAcctType("owner")}>Owner / admin</button>
            </div>

            {acctType === "partner" ? (
              <div style={{ textAlign: "left" }}>
                <div className="field"><label htmlFor="apn-full-name">Full name</label><input id="apn-full-name" className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder="Your full name" /></div>
                <div className="grid2">
                  <div className="field"><label htmlFor="apn-mobile">Mobile number</label><input id="apn-mobile" className="input" value={apn.mobile} onChange={(e) => upApn("mobile", e.target.value)} placeholder="10-digit mobile" /></div>
                  <div className="field"><label htmlFor="apn-dob">Date of birth</label><input id="apn-dob" className="input" type="date" value={apn.dob} onChange={(e) => upApn("dob", e.target.value)} /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label>District</label><SearchableSelect value={apn.district} onChange={(value) => upApn("district", value)} ariaLabel="APN district" options={[{ value: "", label: "Select district…" }, ...TN_DISTRICTS.map((d) => ({ value: d, label: d }))]} /></div>
                  <div className="field"><label htmlFor="apn-taluk">Taluk</label><input id="apn-taluk" className="input" value={apn.taluk} onChange={(e) => upApn("taluk", e.target.value)} placeholder="Taluk" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="apn-city">City / town</label><input id="apn-city" className="input" value={apn.city} onChange={(e) => upApn("city", e.target.value)} placeholder="City" /></div>
                  <div className="field"><label htmlFor="apn-occupation">Occupation</label><input id="apn-occupation" className="input" value={apn.occupation} onChange={(e) => upApn("occupation", e.target.value)} placeholder="Student, freelancer…" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="apn-college">College (optional)</label><input id="apn-college" className="input" value={apn.college} onChange={(e) => upApn("college", e.target.value)} placeholder="College" /></div>
                  <div className="field"><label htmlFor="apn-username">Username</label><input id="apn-username" className="input" value={apn.username} onChange={(e) => upApn("username", e.target.value)} placeholder="Choose a username" aria-describedby="signup-username-status" />{apn.username.trim() && <div id="signup-username-status" className="hint-line" style={{ color: usernameCheck.available === false ? "var(--neg)" : usernameCheck.available === true ? "var(--pos)" : undefined }}>{usernameCheck.checking ? "Checking availability…" : usernameCheck.available === false ? "Username already taken" : usernameCheck.available === true ? "Username available" : "Availability will be checked when saved."}</div>}</div>
                </div>
                <div className="field"><label htmlFor="apn-referral">Referral code <span className="hint-line" style={{ display: "inline" }}>(optional)</span></label><input id="apn-referral" className="input mono" value={apn.referralCode} onChange={(e) => upApn("referralCode", e.target.value.toUpperCase())} placeholder="Enter a partner's code" />{apn.referralCode && <div className="hint-line">The code is linked once your APN profile is created. You may add one later from My Network.</div>}</div>
                <div className="field"><label htmlFor="apn-reason">Why do you want to join APN?</label><textarea id="apn-reason" className="textarea" value={apn.reason} onChange={(e) => upApn("reason", e.target.value)} placeholder="Tell us briefly why you'd like to become a partner…" /></div>
                <p className="hint-line" style={{ fontSize: 12 }}>APN partners are independent and commission-based — no salary and no joining fee. You must be 18 or older. Applications are approved by an admin.</p>
              </div>
            ) : acctType === "staff" || acctType === "client" ? (
              <div className="field" style={{ textAlign: "left" }}>
                <label htmlFor="account-name">Your name</label>
                <input id="account-name" className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder={acctType === "client" ? "Your name or business" : "e.g. Priya"} />
                {acctType === "client" && <p className="hint-line" style={{ fontSize: 12, marginTop: 6 }}>Client accounts see only their own project updates and quotations.</p>}
              </div>
            ) : (
              <div style={{ textAlign: "left", marginBottom: 4 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>Which partner are you?</label>
                <div className="who-grid" style={{ marginBottom: 12 }}>
                  {USERS.map((u) => (
                    <button key={u} type="button" className="who-btn" onClick={() => setWho(u)}
                      style={who === u ? { borderColor: avatarColor(u), boxShadow: "var(--shadow)" } : undefined}>
                      <div className="av" style={{ background: avatarColor(u), width: 36, height: 36, fontSize: 15 }}>{u[0]}</div>
                      <div className="nm" style={{ fontSize: 14 }}>{u}{who === u ? " ✓" : ""}</div>
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="admin-access-code">Admin access code</label>
                  <input id="admin-access-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} placeholder="Provided by ALLBEE" />
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "left" }}>
          <div className="field">
            <label htmlFor="auth-identifier">{mode === "signin" ? "Username or email" : "Email"}</label>
            <input id="auth-identifier" className="input" type={mode === "signin" ? "text" : "email"} autoComplete={mode === "signin" ? "username" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} placeholder={mode === "signin" ? "username or you@allbee.in" : "you@allbee.in"} />
            {mode === "signup" && email.trim().includes("@") && <div className="hint-line" style={{ color: emailCheck.available === false ? "var(--neg)" : emailCheck.available === true ? "var(--pos)" : undefined }}>{emailCheck.checking ? "Checking email availability…" : emailCheck.available === false ? "Email already registered" : emailCheck.available === true ? "Email available" : ""}</div>}
          </div>
          <PasswordField label="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" />
        </div>

        {(err || recoveryMessage) && <div className="auth-msg err"><AlertTriangle size={14} /> {err || recoveryMessage}</div>}
        {notice && <div className="auth-msg ok"><Check size={14} /> {notice}</div>}

        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={submit} disabled={busy}>
          {busy ? <RefreshCw size={16} className="spin" /> : mode === "signin" ? <LogIn size={16} /> : <Mail size={16} />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {mode === "signin" && <button className="linkbtn" onClick={requestReset} disabled={resetBusy}>{resetBusy ? "Sending reset email…" : "Forgot password?"}</button>}

        <button className="linkbtn" onClick={() => { const goSignup = mode === "signin"; setMode(goSignup ? "signup" : "signin"); if (goSignup && loginAs === "partner") setAcctType("partner"); else if (goSignup && loginAs === "client") setAcctType("client"); setEntry("form"); setErr(""); setNotice(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        </>)}

        <div className="hint-line" style={{ marginTop: 10, fontSize: 11, textAlign: "center" }}>
          <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="/delete-account" target="_blank" rel="noreferrer">Account deletion</a>
        </div>
        <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => setDark(!isDark)}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />} {isDark ? "Light" : "Dark"} mode
        </button>
      </div>
      <LoginAccessAssistant onPick={(t) => { setLoginAs(t); setMode("signin"); setEntry("form"); setErr(""); setNotice(""); }} />
    </div>
  );
}
