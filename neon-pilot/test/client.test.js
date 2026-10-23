import { describe, it, expect, vi } from "vitest";
vi.mock("@neondatabase/neon-js", () => ({
  createClient: vi.fn(() => ({})),
  SupabaseAuthAdapter: () => ({ type: "auth-adapter" }),
}));
import {
  requireUuid, createPilotClient, unwrap, currentUser, getMyMemberAccess,
  conversationParticipants, reconcileSelectedConversation, inviteUser, sendMessage, softDeleteMessage, listTasks, createTask, setTaskState
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
    order(...x) { calls.push(["order",...x]); return q; },
    limit(...x) { calls.push(["limit",...x]); return Promise.resolve({data: Array.isArray(responseData) ? responseData : [], error: null}); },
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
  it("reads only backend-enforced own role via parameterless RPC", async () => {
    const { client } = mockNeon();
    const calls=[];
    client.rpc = (name, args) => { calls.push({name,args}); return Promise.resolve({data:{role:'accountant',status:'active'},error:null}); };
    await expect(getMyMemberAccess(client)).resolves.toEqual({role:'accountant',status:'active'});
    expect(calls).toEqual([{name:'my_member_access',args:undefined}]);
  });
  it("fails closed if role is unknown, suspended, or RPC fails", async () => {
    const { client } = mockNeon();
    client.rpc = () => Promise.resolve({data:{role:'root',status:'active'}});
    await expect(getMyMemberAccess(client)).rejects.toThrow(/Invalid access/);
    client.rpc = () => Promise.resolve({data:{role:'client',status:'suspended'}});
    await expect(getMyMemberAccess(client)).resolves.toEqual({role:'client',status:'suspended'});
    client.rpc = () => Promise.resolve({error:{message:'Denied',status:403}});
    await expect(getMyMemberAccess(client)).rejects.toThrow(/Denied/);
  });
  it("does not ask role RPC with an unauthenticated session", async () => {
    const rpc=vi.fn();
    await expect(getMyMemberAccess({auth:{getSession:async()=>({data:{session:null}})},rpc})).rejects.toThrow(/Sign in/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("blocks clients and suspended members from task queries", async () => {
    const {client,calls}=mockNeon();
    client.rpc = () => Promise.resolve({data:{role:'client',status:'active'}});
    await expect(listTasks(client)).rejects.toThrow(/active internal/);
    expect(calls.some(x=>x[0]==='from'&&x[1]==='tasks')).toBe(false);
    client.rpc = () => Promise.resolve({data:{role:'staff',status:'suspended'}});
    await expect(listTasks(client)).rejects.toThrow(/active internal/);
  });
  it("creates task with JWT identity, UUID assignee and no self-set timestamps", async () => {
    const {client,calls}=mockNeon({id:'task-ok'});
    client.rpc = () => Promise.resolve({data:{role:'staff',status:'active'}});
    await createTask(client,{title:'Review client brief',assigneeUserId:idB});
    expect(calls).toContainEqual(['from','tasks']);
    const row=calls.find(x=>x[0]==='insert')[1];
    expect(row.owner_user_id).toBe(idA);
    expect(row.assignee_user_id).toBe(idB);
    expect(row.data).toEqual({title:'Review client brief'});
    expect(row).not.toHaveProperty('updated_at');
    expect(row).not.toHaveProperty('created_at');
    expect(row.id).toMatch(/^t_[a-f0-9-]{36}$/);
  });
  it("validates task state and updates only state, never owner", async () => {
    const {client,calls}=mockNeon({id:'task-ok'});
    client.rpc = () => Promise.resolve({data:{role:'admin',status:'active'}});
    const taskId='t_'+idB;
    await expect(setTaskState(client,taskId,'self_assigned')).rejects.toThrow(/Invalid task state/);
    await setTaskState(client,taskId,'done');
    const update=calls.find(x=>x[0]==='update')[1];
    expect(update).toEqual({state:'done'});
    expect(update).not.toHaveProperty('owner_user_id');
  });
  it("updates an already-open invitation when the recipient accepts", () => {
    const pending = {id:'chat-1', accepted_at:null};
    const active = {id:'chat-1', accepted_at:'2026-10-23T00:00:00Z'};
    expect(reconcileSelectedConversation(pending, [active])).toEqual(active);
    expect(reconcileSelectedConversation(null,[active])).toBeNull();
    expect(reconcileSelectedConversation(pending,[])).toBeNull();
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
