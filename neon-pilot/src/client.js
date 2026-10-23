import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function requireUuid(value) {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error("A valid user or conversation ID is required.");
  }
  return value.toLowerCase();
}

function validNeonEndpoint(value, suffix) {
  if (typeof value !== "string" || !value || value.includes("YOUR-")) {
    throw new Error("Staging Neon endpoints are not configured.");
  }
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid Neon endpoint URL."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" ||
      !(host.endsWith(".neon.build") || host.endsWith(".neon.tech")) ||
      url.username || url.password || url.port || url.search || url.hash ||
      !url.pathname.endsWith(suffix)) {
    throw new Error("Only public HTTPS Neon staging endpoints are allowed.");
  }
  return url.href.replace(/\/$/, "");
}

export function createPilotClient(env, factory = createClient) {
  if (env?.VITE_NEON_STAGING_ONLY !== "true") {
    throw new Error("Neon pilot is disabled; production AllBee must remain separate.");
  }
  const authUrl = validNeonEndpoint(env.VITE_NEON_AUTH_URL, "/auth");
  const dataApiUrl = validNeonEndpoint(env.VITE_NEON_DATA_API_URL, "/rest/v1");
  return factory({
    auth: { adapter: SupabaseAuthAdapter(), url: authUrl },
    dataApi: { url: dataApiUrl },
  });
}

export function unwrap(result, message = "Request failed") {
  if (result?.error) {
    const error = new Error(result.error.message || message);
    error.status = result.error.status || 0;
    throw error;
  }
  return result?.data ?? null;
}

export async function currentUser(client) {
  const data = unwrap(await client.auth.getSession(), "Session unavailable");
  const user = data?.session?.user || data?.user || null;
  if (!user?.id) throw new Error("Sign in is required.");
  return { ...user, id: requireUuid(user.id) };
}

export function conversationParticipants(a, b) {
  const first = requireUuid(a), second = requireUuid(b);
  if (first === second) throw new Error("You cannot message yourself.");
  return [first, second].sort();
}

const ALLBEE_ROLES = new Set(['superadmin','admin','accountant','staff','intern','client','partner','district_head','state_head']);

export async function getMyMemberAccess(client) {
  await currentUser(client);
  const access = unwrap(await client.rpc('my_member_access'), 'Cannot verify account permissions.');
  if (!access || !ALLBEE_ROLES.has(access.role) ||
      !['active','suspended','terminated'].includes(access.status)) {
    throw new Error('Invalid access response: account is locked until its role is verified.');
  }
  return Object.freeze({ role: access.role, status: access.status });
}

export async function getOwnProfile(client) {
  const user = await currentUser(client);
  return unwrap(await client.from("member_profiles")
    .select("user_id,display_name,bio,avatar_key,created_at")
    .eq("user_id", user.id).maybeSingle());
}

export async function saveOwnProfile(client, displayName, bio = "") {
  const user = await currentUser(client);
  const name = String(displayName || "").trim();
  if (name.length < 1 || name.length > 100) throw new Error("Name must be 1–100 characters.");
  const about = String(bio || "").slice(0, 2000);
  const old = await getOwnProfile(client);
  const data = old
    ? unwrap(await client.from("member_profiles")
        .update({ display_name: name, bio: about }).eq("user_id", user.id)
        .select("user_id,display_name,bio").single())
    : unwrap(await client.from("member_profiles")
        .insert({ user_id: user.id, display_name: name, bio: about })
        .select("user_id,display_name,bio").single());
  return data;
}

export function reconcileSelectedConversation(previous, rows) {
  if (!previous) return null;
  if (!Array.isArray(rows)) return previous;
  return rows.find((chat) => chat.id === previous.id) || null;
}

export async function listConversations(client) {
  await currentUser(client);
  return unwrap(await client.from("direct_conversations")
    .select("id,participant_one_id,participant_two_id,created_by,created_at,accepted_at")
    .order("created_at", { ascending: false })) || [];
}

export async function inviteUser(client, peerId) {
  const user = await currentUser(client);
  const [participant_one_id, participant_two_id] = conversationParticipants(user.id, peerId);
  return unwrap(await client.from("direct_conversations")
    .insert({ participant_one_id, participant_two_id, created_by: user.id })
    .select("id,participant_one_id,participant_two_id,created_by,accepted_at")
    .single());
}

export async function acceptConversation(client, id) {
  await currentUser(client);
  return unwrap(await client.from("direct_conversations")
    .update({ accepted_at: new Date().toISOString() }).eq("id", requireUuid(id))
    .select("id,accepted_at").single());
}

export async function listMessages(client, conversationId) {
  await currentUser(client);
  return unwrap(await client.from("direct_messages")
    .select("id,conversation_id,sender_user_id,body,created_at,edited_at,deleted_at")
    .eq("conversation_id", requireUuid(conversationId))
    .order("created_at", { ascending: true }).limit(150)) || [];
}

export async function sendMessage(client, conversationId, body) {
  const user = await currentUser(client);
  const message = String(body || "").trim();
  if (!message || message.length > 8000) throw new Error("Message must be 1–8,000 characters.");
  return unwrap(await client.from("direct_messages")
    .insert({ conversation_id: requireUuid(conversationId),
      sender_user_id: user.id, body: message })
    .select("id,body,created_at").single());
}

const TASK_STATES = new Set(['open','in_progress','blocked','done','cancelled']);
const INTERNAL_ROLES = new Set(['superadmin','admin','accountant','staff','intern']);

async function assertCanUseTasks(client) {
  const [user, access] = await Promise.all([currentUser(client), getMyMemberAccess(client)]);
  if (access.status !== 'active' || !INTERNAL_ROLES.has(access.role)) {
    throw new Error('Task access requires an active internal AllBee account.');
  }
  return user;
}

export async function listTasks(client) {
  await assertCanUseTasks(client);
  return unwrap(await client.from('tasks')
    .select('id,data,owner_user_id,assignee_user_id,state,created_at,updated_at')
    .order('updated_at', {ascending:false}).limit(150)) || [];
}

export async function createTask(client, { title, assigneeUserId }) {
  const user = await assertCanUseTasks(client);
  const taskTitle = String(title || '').trim();
  if (!taskTitle || taskTitle.length > 180) throw new Error('Task title must be 1–180 characters.');
  const assigneeId = requireUuid(assigneeUserId);
  const taskId = 't_' + crypto.randomUUID();
  return unwrap(await client.from('tasks').insert({
    id: taskId,
    data: {title: taskTitle},
    owner_user_id: user.id,
    assignee_user_id: assigneeId,
    state: 'open',
  }).select('id,data,owner_user_id,assignee_user_id,state,updated_at').single());
}

export async function setTaskState(client, taskId, state) {
  await assertCanUseTasks(client);
  if (typeof taskId !== 'string' || !/^t_[a-f0-9-]{36}$/i.test(taskId)) throw new Error('Invalid task identifier.');
  if (!TASK_STATES.has(state)) throw new Error('Invalid task state.');
  return unwrap(await client.from('tasks')
    .update({state}).eq('id',taskId)
    .select('id,state,updated_at').single());
}

const NOTIFICATION_KINDS = new Set(['general','task','announcement']);
const NOTIFICATION_ADMINS = new Set(['superadmin','admin']);

export async function listMyNotifications(client) {
  const [user, access] = await Promise.all([currentUser(client), getMyMemberAccess(client)]);
  if (access.status !== 'active') throw new Error('Account must be active to read notifications.');
  return unwrap(await client.from('member_notifications')
    .select('id,recipient_user_id,sender_user_id,kind,title,body,created_at,read_at')
    .eq('recipient_user_id',user.id)
    .order('created_at',{ascending:false}).limit(100)) || [];
}

export async function acknowledgeNotification(client, notificationId) {
  const [user, access] = await Promise.all([currentUser(client), getMyMemberAccess(client)]);
  if (access.status !== 'active') throw new Error('Account must be active to acknowledge notifications.');
  return unwrap(await client.from('member_notifications')
    .update({read_at:new Date().toISOString()})
    .eq('recipient_user_id',user.id).eq('id',requireUuid(notificationId))
    .select('id,read_at').single());
}

export async function sendMemberNotification(client,{recipientId,title,body,kind='general'}) {
  const [user, access] = await Promise.all([currentUser(client), getMyMemberAccess(client)]);
  if(access.status !== 'active' || !NOTIFICATION_ADMINS.has(access.role)) {
    throw new Error('Only an active AllBee administrator can send notifications.');
  }
  const recipient_user_id=requireUuid(recipientId);
  const cleanTitle=String(title||'').trim();
  const cleanBody=String(body||'').trim();
  if(!cleanTitle || cleanTitle.length>120) throw new Error('Notification title must be 1–120 characters.');
  if(!cleanBody || cleanBody.length>2500) throw new Error('Notification body must be 1–2,500 characters.');
  if(!NOTIFICATION_KINDS.has(kind)) throw new Error('Invalid notification category.');
  const result=await client.from('member_notifications').insert({
    recipient_user_id,sender_user_id:user.id,title:cleanTitle,body:cleanBody,kind,
  });
  unwrap(result,'Could not send notification.');
  // The sender cannot SELECT recipient-owned alerts; a successful 201/204 is
  // the entire permitted acknowledgement. Never add .select() here.
  return true;
}

export async function manageMemberRole(client,{targetId,role,status='active'}) {
  const [user, access]=await Promise.all([currentUser(client),getMyMemberAccess(client)]);
  if(access.role !== 'superadmin' || access.status !== 'active') {
    throw new Error('Only the active company superadmin can change member roles.');
  }
  const target=requireUuid(targetId);
  if(target===user.id) throw new Error('Cannot alter your own superadmin access.');
  if(!ALLBEE_ROLES.has(role)) throw new Error('Unknown member role.');
  if(!['active','suspended','terminated'].includes(status)) throw new Error('Unknown member status.');
  return unwrap(await client.rpc('manage_member_role',{
    p_target_user_id:target,p_role:role,p_status:status,
  }),'Role management failed.');
}

export async function softDeleteMessage(client, messageId) {
  await currentUser(client);
  return unwrap(await client.from("direct_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", requireUuid(messageId)).select("id,deleted_at").single());
}
