import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPilotClient, currentUser, getMyMemberAccess, getOwnProfile, saveOwnProfile, inviteUser,
  listConversations, reconcileSelectedConversation, acceptConversation, listMessages, sendMessage, softDeleteMessage,
  listTasks, createTask, setTaskState, listMyNotifications, acknowledgeNotification,
  sendMemberNotification, manageMemberRole, unwrap
} from "./client.js";

const env = import.meta.env;
const clientOrError = (() => {
  try { return { client: createPilotClient(env) }; }
  catch (error) { return { error: error.message }; }
})();

const shortId = (id) => id ? id.slice(0, 8) + "…" + id.slice(-4) : "—";
const dateText = (timestamp) => timestamp ? new Date(timestamp).toLocaleString() : "";

const INTERNAL_TEST_ROLES = new Set(['superadmin','admin','accountant','staff','intern']);
const TASK_STATE_OPTIONS = ['open','in_progress','blocked','done','cancelled'];

function TaskWorkspace({client, user}) {
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [assignee, setAssignee] = useState(user.id);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState('');
  const refresh = useCallback(async () => {
    try { setTasks(await listTasks(client)); setTaskError(''); }
    catch (error) { setTaskError(error?.message || 'Tasks unavailable'); }
  }, [client]);
  useEffect(() => { refresh(); }, [refresh]);
  async function addTask(e) {
    e.preventDefault(); if (taskBusy) return;
    setTaskBusy(true);
    try { await createTask(client, {title:taskTitle,assigneeUserId:assignee}); setTaskTitle(''); await refresh(); }
    catch (error) { setTaskError(error?.message || 'Task creation failed'); }
    finally { setTaskBusy(false); }
  }
  async function changeStatus(taskId, next) {
    setTaskBusy(true);
    try { await setTaskState(client,taskId,next); await refresh(); }
    catch (error) { setTaskError(error?.message || 'Task update failed'); }
    finally { setTaskBusy(false); }
  }
  return <section className="panel" style={{marginTop:24}}>
    <div className="line-title"><h2>Internal task workspace</h2><button className="text-button" type="button" onClick={refresh}>Refresh</button></div>
    <p className="help">Only active internal accounts can view tasks. Assignment and ownership are enforced by Neon user IDs—not editable names.</p>
    {taskError && <p className="notice" role="alert">{taskError}</p>}
    <form className="task-create-form" onSubmit={addTask} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:12,alignItems:'end'}}>
      <label>Task title<input value={taskTitle} required maxLength={180} onChange={e=>setTaskTitle(e.target.value)}/></label>
      <label>Assigned user ID<input value={assignee} required onChange={e=>setAssignee(e.target.value)} /></label>
      <button className="primary" disabled={taskBusy}>Add task</button>
    </form>
    <div aria-label="Assigned tasks" style={{display:'grid',gap:12,marginTop:22}}>
      {!tasks.length && <p className="help">No tasks assigned to you yet.</p>}
      {tasks.map((task) => <div key={task.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'12px 0',borderTop:'1px solid #253a4b'}}>
        <div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{task.data?.title || task.id}</strong><small style={{display:'block',marginTop:4,color:'#9cb0bf'}}>Assigned to {shortId(task.assignee_user_id)} · {dateText(task.updated_at)}</small></div>
        <select aria-label={'Status for '+(task.data?.title || task.id)} disabled={taskBusy} value={task.state} onChange={e=>changeStatus(task.id,e.target.value)} style={{background:'#132636',color:'#eaf2f0',border:'1px solid #34546b',borderRadius:8,padding:9}}>
          {TASK_STATE_OPTIONS.map(state=><option value={state} key={state}>{state.replace('_',' ')}</option>)}
        </select>
      </div>)}
    </div>
  </section>;
}

const NOTIFICATION_ADMINS = new Set(['superadmin', 'admin']);

function NotificationInbox({client, access}) {
  const [items,setItems] = useState([]);
  const [recipient,setRecipient] = useState('');
  const [title,setTitle] = useState('');
  const [body,setBody] = useState('');
  const [kind,setKind] = useState('general');
  const [error,setError] = useState('');
  const [feedback,setFeedback] = useState('');
  const [busy,setBusy] = useState(false);
  const canSend = NOTIFICATION_ADMINS.has(access.role);
  const refresh = useCallback(async () => {
    try { setItems(await listMyNotifications(client)); setError(''); }
    catch(e) { setError(e?.message || 'Inbox unavailable'); }
  },[client]);
  useEffect(()=>{
    refresh();
    const poll=setInterval(()=>refresh(),15000);
    return ()=>clearInterval(poll);
  },[refresh]);
  const unread = items.filter(item=>!item.read_at).length;
  async function markRead(item) {
    if(busy || item.read_at) return;
    setBusy(true); setFeedback('');
    try { await acknowledgeNotification(client,item.id); await refresh(); }
    catch(e){setError(e?.message || 'Could not acknowledge notification');}
    finally{setBusy(false);}
  }
  async function send(e) {
    e.preventDefault(); if(busy || !canSend) return;
    setBusy(true); setFeedback('');
    try {
      await sendMemberNotification(client,{recipientId:recipient,title,body,kind});
      setTitle(''); setBody(''); setRecipient('');setKind('general');
      setFeedback('Notification sent. Only the recipient can open it.');
    }catch(e){setError(e?.message || 'Send failed');}
    finally{setBusy(false);}
  }
  return <section className="panel" style={{marginTop:24}}>
    <div className="line-title"><h2>Private notifications · {unread} unread</h2><button type="button" className="text-button" onClick={refresh}>Refresh</button></div>
    <p className="help">Server-scoped inbox. You can only view and acknowledge notifications addressed to your account.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {feedback && <p className="help" role="status">{feedback}</p>}
    <div aria-label="Private notifications" style={{display:'grid',gap:8}}>
      {!items.length && <p className="help">No notifications for this account.</p>}
      {items.map(n=><div key={n.id} className="notification-row">
        <div><strong>{n.title}</strong><span className="eyebrow" style={{marginLeft:10}}>{n.kind}</span>
          <p style={{margin:'8px 0',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{n.body}</p>
          <small className="help">{dateText(n.created_at)} · {n.read_at ? 'Read' : 'Unread'}</small>
        </div>
        {!n.read_at && <button type="button" disabled={busy} className="secondary" onClick={()=>markRead(n)}>Mark read</button>}
      </div>)}
    </div>
    {canSend && <form onSubmit={send} className="notif-send-form">
      <h3>Send a test notification</h3>
      <p className="help">Admin-only: target an existing staging account UUID. Sending does not grant access to that user's private inbox.</p>
      <label>Recipient UUID<input required value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Recipient user ID"/></label>
      <label>Category<select value={kind} onChange={e=>setKind(e.target.value)}><option value="general">General</option><option value="task">Task</option><option value="announcement">Announcement</option></select></label>
      <label>Title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label>Message<textarea required maxLength={2500} rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label>
      <button className="primary" disabled={busy} type="submit">Send notification</button>
    </form>}
  </section>;
}

const MANAGED_ROLES = ['client','staff','intern','accountant','partner','district_head','state_head','admin','superadmin'];

function RoleManagement({client,user}) {
  const [targetId,setTargetId]=useState('');
  const [role,setRole]=useState('client');
  const [status,setStatus]=useState('active');
  const [result,setResult]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function changeRole(e) {
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');setResult('');
    try {
      const next=await manageMemberRole(client,{targetId,role,status});
      setResult('Permissions updated for '+shortId(next.user_id)+'. Changes are recorded in the private security audit.');
      setTargetId('');
    }catch(e){setError(e?.message||'Permission change rejected');}
    finally{setBusy(false);}
  }
  return <section className="panel" style={{marginTop:24}}>
    <h2>Superadmin · Role administration</h2>
    <p className="help">Restricted to an active verified company superadmin. You cannot alter your own role or any unknown account. Every change is recorded by the database.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {result && <p className="help" role="status">{result}</p>}
    <form className="role-manage-form" onSubmit={changeRole}>
      <label>Existing staging member UUID<input required placeholder="Existing member UUID" value={targetId} onChange={e=>setTargetId(e.target.value)} /></label>
      <label>Role<select value={role} onChange={e=>setRole(e.target.value)}>{MANAGED_ROLES.map(r=><option value={r} key={r}>{r.replace('_',' ')}</option>)}</select></label>
      <label>Account status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option></select></label>
      <button type="submit" disabled={busy || targetId.trim().toLowerCase()===user.id} className="primary">Apply role change</button>
    </form>
  </section>;
}

export function NeonPilot() {
  const client = clientOrError.client;
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
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
    setSelected((prev) => reconcileSelectedConversation(prev, rows));
    return rows;
  }, [client]);

  const loadSignedIn = useCallback(async () => {
    if (!client) return;
    try {
      const next = await currentUser(client);
      setUser(next);
      setAccess(null);
      const verifiedAccess = await getMyMemberAccess(client);
      setAccess(verifiedAccess);
      if (verifiedAccess.status !== 'active') {
        setConversations([]); setSelected(null); setMessages([]);
        setNotice('This account is not active. Contact an AllBee administrator.');
        return;
      }
      const profile = await getOwnProfile(client);
      setName(profile?.display_name || next.name || "");
      setBio(profile?.bio || "");
      await refreshConversations();
      setNotice("");
      return next;
    } catch (error) {
      if (/Sign in is required/.test(error?.message || "")) setUser(null);
      else report(error);
    } finally {
      setLoading(false);
    }
  }, [client, refreshConversations]);

  useEffect(() => { loadSignedIn(); }, [loadSignedIn]);

  // A recipient's acceptance must update an already-selected invitation, not
  // leave the sender's conversation permanently showing the pending screen.
  useEffect(() => {
    if (!client || !user || access?.status !== 'active') return;
    const interval = setInterval(() => refreshConversations().catch(report), 5000);
    return () => clearInterval(interval);
  }, [client, user?.id, access?.status, refreshConversations]);

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
      const verifiedUser = await loadSignedIn();
      if (signup) setNotice(verifiedUser
        ? "Test account created and signed in."
        : "Registration submitted. Verify your email if requested, then sign in.");
    } catch (error) { report(error); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!client || busy) return;
    setBusy(true);
    try {
      unwrap(await client.auth.signOut(), "Could not sign out.");
      setUser(null); setAccess(null); setMessages([]); setSelected(null); setConversations([]); setNotice("");
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
              <div><span className="eyebrow">PERMISSION</span><strong>{access?.role || "Unverified"}</strong><span>{access?.status || "Locked until verified"} · No role self-assignment</span></div>
              <div><span className="eyebrow">DATA</span><strong>Neon staging</strong><span>RLS enforced server-side</span></div>
            </div>
            {access?.status !== 'active'
              ? <section className="panel"><h2>Account access restricted</h2><p className="help">Permissions could not be verified or this account was suspended. Profile and chat operations are unavailable.</p></section>
              : <div className="work-grid">
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
            </div>}
            {access?.status === 'active' && access.role === 'superadmin' && <RoleManagement client={client} user={user} />}
            {access?.status === 'active' && <NotificationInbox client={client} access={access} />}
            {access?.status === 'active' && INTERNAL_TEST_ROLES.has(access?.role) && <TaskWorkspace client={client} user={user} />}
          </>}
    </div>
    <footer>ALLBEE SYSTEMS · PRIVATE STAGING PILOT · NOT PRODUCTION</footer>
  </div>;
}
