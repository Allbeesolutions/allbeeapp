import { describe, it, expect, vi } from "vitest";
vi.mock("@neondatabase/neon-js", () => ({
  createClient: vi.fn(() => ({})),
  SupabaseAuthAdapter: () => ({ type: "auth-adapter" }),
}));
import {
  requireUuid, createPilotClient, unwrap, currentUser,
  conversationParticipants, inviteUser, sendMessage, softDeleteMessage
} from "../src/client.js";

const idA = "00000000-0000-4000-8000-000000000001";
const idB = "00000000-0000-4000-8000-000000000002";
const config = {
  VITE_NEON_STAGING_ONLY: "true",
  VITE_NEON_AUTH_URL: "https://example.neon.build/allbee/auth",
  VITE_NEON_DATA_API_URL: "https://example.neon.tech/allbee/rest/v1",
};

describe("isolated Neon pilot configuration", () => {
  it("refuses production or unspecified staging mode", () => {
    expect(() => createPilotClient({ ...config, VITE_NEON_STAGING_ONLY: "false" })).toThrow(/disabled/);
    expect(() => createPilotClient({ ...config, VITE_NEON_STAGING_ONLY: "" })).toThrow(/disabled/);
  });
  it("builds an auth+Data-API client with public endpoints only", () => {
    const factory = vi.fn((args) => args);
    const c = createPilotClient(config, factory);
    expect(c.auth.url).toBe(config.VITE_NEON_AUTH_URL);
    expect(c.dataApi.url).toBe(config.VITE_NEON_DATA_API_URL);
    expect(c.auth.adapter).toBeTruthy();
    expect(factory).toHaveBeenCalledOnce();
    expect(JSON.stringify(c)).not.toMatch(/password|service_role|database_url/i);
  });
  it.each([
    "http://example.neon.build/allbee/auth",
    "https://evil.example.com/allbee/auth",
    "https://neon.tech.attacker.example/allbee/auth",
    "https://u:p@example.neon.build/allbee/auth",
    "https://example.neon.build/allbee/auth?secret=foo",
    "postgresql://user:password@example.neon.build/allbee/auth",
    "https://example.neon.build/not-auth",
  ])("rejects unsafe auth endpoint %s", (url) => {
    expect(() => createPilotClient({ ...config, VITE_NEON_AUTH_URL: url })).toThrow();
  });
  it("rejects empty or placeholder URLs", () => {
    expect(() => createPilotClient({ ...config, VITE_NEON_AUTH_URL: "" })).toThrow();
    expect(() => createPilotClient({ ...config, VITE_NEON_DATA_API_URL: "https://YOUR-HOST.neon.build/allbee/rest/v1" })).toThrow();
  });
  it("validates UUIDs and deterministic conversation ordering", () => {
    expect(requireUuid(idA)).toBe(idA);
    expect(() => requireUuid("malformed-id")).toThrow();
    expect(conversationParticipants(idB, idA)).toEqual([idA, idB]);
    expect(() => conversationParticipants(idA, idA)).toThrow(/yourself/);
  });
  it("surfaces errors without hiding backend permission denials", () => {
    expect(() => unwrap({error:{message:"RLS rejected",status:403}})).toThrow(/RLS rejected/);
  });
});

function mockNeon(responseData = {}) {
  const calls = [];
  const q = {
    select(...x) { calls.push(["select", ...x]); return q; },
    insert(...x) { calls.push(["insert", ...x]); return q; },
    update(...x) { calls.push(["update", ...x]); return q; },
    eq(...x) { calls.push(["eq", ...x]); return q; },
    single() { calls.push(["single"]); return Promise.resolve({ data: responseData, error: null }); },
  };
  const client = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: {id: idA, email:"a@example.test"} } }, error: null }) },
    from: (table) => { calls.push(["from", table]); return q; },
  };
  return { client, calls };
}

describe("pilot data operations", () => {
  it("uses session identity, not user-supplied role metadata", async () => {
    const { client } = mockNeon();
    expect((await currentUser(client)).id).toBe(idA);
  });
  it("does not allow unauthenticated profile operations", async () => {
    const c = {auth:{getSession:async()=>({data:{session:null}})}};
    await expect(currentUser(c)).rejects.toThrow(/Sign in/);
  });
  it("creates an invitation without self-approval or role assignment", async () => {
    const { client, calls } = mockNeon({id:"123"});
    await inviteUser(client, idB);
    expect(calls).toContainEqual(["from","direct_conversations"]);
    const insertion=calls.find(x=>x[0]==="insert")[1];
    expect(insertion).toEqual({participant_one_id:idA,participant_two_id:idB,created_by:idA});
    expect(insertion).not.toHaveProperty("accepted_at");
    expect(insertion).not.toHaveProperty("role");
  });
  it("only submits allowed message fields and validates input", async () => {
    const {client,calls}=mockNeon({id:"msg"});
    await expect(sendMessage(client,idB,"")).rejects.toThrow(/Message/);
    await sendMessage(client,idB,"Hello");
    const insert=calls.find(x=>x[0]==="insert")[1];
    expect(insert).toEqual({conversation_id:idB,sender_user_id:idA,body:"Hello"});
    expect(insert).not.toHaveProperty("created_at");
  });
  it("soft-deletes only, with no unrestricted DELETE", async () => {
    const {client,calls}=mockNeon();
    await softDeleteMessage(client,idB);
    expect(calls).toContainEqual(["from","direct_messages"]);
    expect(calls.some(x=>x[0]==="update"&&!!x[1].deleted_at)).toBe(true);
    expect(calls.some(x=>x[0]==="delete")).toBe(false);
  });
});
