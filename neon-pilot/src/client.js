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

export async function softDeleteMessage(client, messageId) {
  await currentUser(client);
  return unwrap(await client.from("direct_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", requireUuid(messageId)).select("id,deleted_at").single());
}
