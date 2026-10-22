import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPilotClient, currentUser, getOwnProfile, saveOwnProfile, inviteUser,
  listConversations, acceptConversation, listMessages, sendMessage, softDeleteMessage, unwrap
} from "./client.js";

const env = import.meta.env;
const clientOrError = (() => {
  try { return { client: createPilotClient(env) }; }
  catch (error) { return { error: error.message }; }
})();

const shortId = (id) => id ? id.slice(0, 8) + "…" + id.slice(-4) : "—";
const dateText = (timestamp) => timestamp ? new Date(timestamp).toLocaleString() : "";

export function NeonPilot() {
  const client = clientOrError.client;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!client);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [signup, setSignup] = useState(false);
  const [editing, setEditing] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");

  const report = (error) => setNotice(error?.message || String(error || "Something went wrong"));

  const refreshConversations = useCallback(async () => {
    if (!client) return;
    const rows = await listConversations(client);
    setConversations(rows);
    return rows;
  }, [client]);

  const loadSignedIn = useCallback(async () => {
    if (!client) return;
    try {
      const next = await currentUser(client);
      setUser(next);
      const profile = await getOwnProfile(client);
      setName(profile?.display_name || next.name || "");
      setBio(profile?.bio || "");
      await refreshConversations();
      setNotice("");
    } catch (error) {
      if (/Sign in is required/.test(error?.message || "")) setUser(null);
      else report(error);
    } finally {
      setLoading(false);
    }
  }, [client, refreshConversations]);

  useEffect(() => { loadSignedIn(); }, [loadSignedIn]);

  const refreshMessages = useCallback(async () => {
    if (client && selected?.id && selected.accepted_at) {
      setMessages(await listMessages(client, selected.id));
    } else setMessages([]);
  }, [client, selected]);

  useEffect(() => {
    refreshMessages().catch(report);
    if (!selected?.accepted_at) return;
    const interval = setInterval(() => refreshMessages().catch(report), 5000);
    return () => clearInterval(interval);
  }, [refreshMessages, selected]);

  const accountId = user?.id || null;
  const invitation = selected && !selected.accepted_at;
  const canAccept = invitation && selected.created_by !== accountId;
  const otherParty = selected && (selected.participant_one_id === accountId
    ? selected.participant_two_id : selected.participant_one_id);

  async function handleAuth(event) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true); setNotice("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || password.length < 8) throw new Error("Enter a valid email and a password of at least 8 characters.");
      const res = signup
        ? await client.auth.signUp({ email: cleanEmail, password, options: { data: { name: name.trim().slice(0, 100) } } })
        : await client.auth.signInWithPassword({ email: cleanEmail, password });
      unwrap(res, signup ? "Registration failed" : "Login failed");
      setPassword("");
      try { await loadSignedIn(); }
      catch { /* Email verification may be required by the managed provider. */ }
      if (signup) setNotice("Registration submitted. Verify your email if requested, then sign in.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!client || busy) return;
    setBusy(true);
    try {
      unwrap(await client.auth.signOut(), "Could not sign out.");
      setUser(null); setMessages([]); setSelected(null); setConversations([]); setNotice("");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveOwnProfile(client, name, bio);
      setEditing(false); setNotice("Profile saved.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function invite(event) {
    event.preventDefault();
    if (!recipientId.trim()) return;
    setBusy(true);
    try {
      const result = await inviteUser(client, recipientId.trim());
      setRecipientId("");
      const chats = await refreshConversations();
      setSelected(chats?.find((c) => c.id === result.id) || result);
      setNotice("Invitation sent. Messaging is locked until the recipient accepts.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function accept() {
    if (!selected) return;
    setBusy(true);
    try {
      await acceptConversation(client, selected.id);
      const chats = await refreshConversations();
      setSelected(chats?.find((c) => c.id === selected.id) || null);
      setNotice("Invitation accepted. Private messaging is enabled.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (!selected || !message.trim()) return;
    setBusy(true);
    try {
      await sendMessage(client, selected.id, message);
      setMessage(""); await refreshMessages();
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function removeOwnMessage(id) {
    setBusy(true);
    try { await softDeleteMessage(client, id); await refreshMessages(); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  }

  if (clientOrError.error) return <main className="setup">
    <span className="eyebrow">ALLBEE / STAGING</span>
    <h1>Backend pilot not configured</h1>
    <p>{clientOrError.error}</p>
    <p>This isolated test workspace does not use the existing production Supabase keys or customer data.</p>
  </main>;

  if (loading) return <main className="setup"><h1>Checking secure session…</h1></main>;

  return <div className="shell">
    <header className="site-header">
      <div className="logo"><span className="mark">A</span><div>ALLBEE <small>REPLACEMENT BACKEND LAB</small></div></div>
      <span className="environment">ISOLATED STAGING</span>
    </header>
    <div className="container">
      <div className="page-heading">
        <div><span className="eyebrow">NEON AUTH · ROW SECURITY · PRIVATE CHAT</span>
          <h1>{user ? "Communication test desk" : "Sign in to the test environment"}</h1>
          <p>This is not AllBee production. Fresh test accounts only; existing customers and records are not migrated.</p>
        </div>
        {user && <button className="ghost" onClick={logout} disabled={busy}>Sign out</button>}
      </div>
      {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
      {!user
        ? <div className="login-card">
            <div className="line-title"><h2>{signup ? "Create test account" : "Test account login"}</h2><span>NEON AUTH</span></div>
            <form onSubmit={handleAuth}>
              {signup && <label>Full name<input value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} autoComplete="name"/></label>}
              <label>Email address<input type="email" value={email} required onChange={(event) => setEmail(event.target.value)} autoComplete="email"/></label>
              <label>Password<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={signup ? "new-password" : "current-password"}/></label>
              <button disabled={busy} className="primary" type="submit">{busy ? "Processing…" : signup ? "Register" : "Sign in"}</button>
            </form>
            <button className="text-button" onClick={() => { setSignup(!signup); setNotice(""); }}>
              {signup ? "Already registered? Sign in" : "New test account? Register"}
            </button>
          </div>
        : <>
            <div className="detail-strip">
              <div><span className="eyebrow">SIGNED IN USER</span><strong>{user.email || name || "Member"}</strong><span className="mono">ID {shortId(accountId)}</span></div>
              <div><span className="eyebrow">PERMISSION</span><strong>Client-only pilot</strong><span>No admin role self-assignment</span></div>
              <div><span className="eyebrow">DATA</span><strong>Neon staging</strong><span>RLS enforced server-side</span></div>
            </div>
            <div className="work-grid">
              <section className="panel">
                <div className="line-title"><h2>Profile</h2><button className="text-button" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit"}</button></div>
                <p className="help">Only your own profile is accessible. Company roles are private server-side data.</p>
                {editing
                  ? <form onSubmit={saveProfile}>
                      <label>Display name<input required minLength={1} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
                      <label>Bio<textarea maxLength={2000} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
                      <button className="primary" type="submit" disabled={busy}>Save profile</button>
                    </form>
                  : <><h3>{name || "Complete your profile"}</h3><p>{bio || "No bio yet."}</p></>}
                <hr/>
                <div className="line-title"><h2>Invite a user</h2></div>
                <p className="help">For privacy, no public user directory. Share UUIDs between consenting test accounts.</p>
                <form onSubmit={invite}>
                  <label>Recipient user ID<input required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} /></label>
                  <button className="secondary" disabled={busy} type="submit">Send invitation</button>
                </form>
              </section>
              <section className="panel chat-panel">
                <div className="line-title"><h2>Conversations</h2><button className="text-button" onClick={() => refreshConversations().catch(report)}>Refresh</button></div>
                <div className="conversation-list" aria-label="Your conversations">
                  {conversations.length === 0 && <p className="help">No conversations. Invite another signed-in tester.</p>}
                  {conversations.map((c) => <button key={c.id} className={"conversation" + (selected?.id === c.id ? " selected" : "")}
                    onClick={() => setSelected(c)}>
                    <span>Chat with {shortId(c.participant_one_id === accountId ? c.participant_two_id : c.participant_one_id)}</span>
                    <small>{c.accepted_at ? "Accepted" : c.created_by === accountId ? "Awaiting recipient" : "Needs your approval"}</small>
                  </button>)}
                </div>
                <div className="thread">
                  {!selected ? <p className="help">Choose a conversation above.</p>
                  : <>
                    <div className="thread-top"><div><strong>{shortId(otherParty)}</strong><small>{invitation ? "Invitation pending" : "Secure conversation"}</small></div></div>
                    {invitation
                      ? <div className="pending">
                          <p>{canAccept ? "This user has invited you to chat. Accept to start messaging." : "Your invitation is awaiting the recipient's acceptance."}</p>
                          {canAccept && <button className="primary" disabled={busy} onClick={accept}>Accept invitation</button>}
                        </div>
                      : <>
                          <div className="messages" aria-live="polite">
                            {messages.length === 0 && <p className="help">No messages yet.</p>}
                            {messages.map((m) => <div key={m.id} className={"bubble" + (m.sender_user_id === accountId ? " own" : "")}>
                              {m.deleted_at ? <em>Message deleted</em> : <p>{m.body}</p>}
                              <small>{dateText(m.created_at)}</small>
                              {!m.deleted_at && m.sender_user_id === accountId && Date.now() - new Date(m.created_at).getTime() < 3600000 &&
                                <button className="text-button" disabled={busy} onClick={() => removeOwnMessage(m.id)}>Delete</button>}
                            </div>)}
                          </div>
                          <form className="message-form" onSubmit={send}>
                            <input aria-label="Message" placeholder="Type a message…" value={message} maxLength={8000} required onChange={(e) => setMessage(e.target.value)}/>
                            <button className="primary" disabled={busy || !message.trim()} type="submit">Send</button>
                          </form>
                        </>}
                  </>}
                </div>
              </section>
            </div>
          </>}
    </div>
    <footer>ALLBEE SYSTEMS · PRIVATE STAGING PILOT · NOT PRODUCTION</footer>
  </div>;
}
