import React from "react";
import {afterEach,describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,cleanup,act} from "@testing-library/react";
import AdminClientChat from "./AdminClientChat.jsx";
import ClientSupportChat from "./ClientSupportChat.jsx";
import ChatProfileCard from "./ui/ChatProfileCard.jsx";
import MessageReactions from "./ui/MessageReactions.jsx";
import {resolveChatPerson,normalizeChatPerson,conversationPerson} from "./identity/chatIdentity.js";
import {resolvePersonAvatar} from "./identity/avatarResolver.js";
import {participantFromSlug,hydrateConversationPeople} from "./identity/conversationIdentity.js";
afterEach(cleanup);
const Icon=()=>null;
const Avatar=({name,url})=>url?<img src={url} alt={name}/>:<span>{name?.[0]}</span>;
const me={id:"admin",name:"Administrator",photo_url:"admin.jpg",role:"admin"};
const rows=[{conversation_id:"a",client_id:"client-a",client_name:"Client A",client_photo_url:"client.jpg",client_bio:"Design partner",unread_count:2},{conversation_id:"b",client_id:"client-b",client_name:"Client B"}];
const message={id:"m1",sender_id:"client-a",sender_name:"Old name",body:"Hello",created_at:new Date().toISOString(),reactions:[]};
function fixture(overrides={}){
 const events=[];
 const rpc=vi.fn(async(name,args)=>{
  if(overrides[name])return overrides[name](args);
  if(name==="client_list_support_conversations")return {data:rows,error:null};
  if(name==="apn_list_messages")return {data:[message,message],error:null};
  if(name==="client_support_directory")return {data:[{id:"support",name:"Haji",photo_url:"support.jpg",bio:"Support bio"}],error:null};
  if(name==="apn_get_or_create_admin_conversation")return {data:[{conversation_id:"support-chat"}],error:null};
  return {data:[],error:null};
 });
 const supabase={rpc,channel:()=>({on(_type,_filter,cb){events.push(cb);return this},subscribe(){return this}}),removeChannel:vi.fn()};
 const runtime={supabase,Avatar,fmtDateTime:()=> "10:20",MessageCircle:Icon,RefreshCw:Icon,ArrowLeft:Icon,MessageSquare:Icon,X:Icon,Search:Icon};
 return {supabase,runtime,rpc,events};
}
async function inbox(f){render(<AdminClientChat me={me} people={[me]} runtime={f.runtime}/>);await screen.findByText("Client A");}
async function openA(){fireEvent.click(screen.getByText("Client A"));await screen.findByText("Hello");}
describe("chat canonical identities",()=>{
 it("prioritizes IDs globally and never guesses between duplicated names",()=>{
  const people=[{id:"wrong",name:"Same",photo_url:"wrong.jpg"},{id:"right",name:"Same",photo_url:"right.jpg"}];
  expect(resolveChatPerson(people,{id:"right",name:"Same"}).photo_url).toBe("right.jpg");
  expect(resolvePersonAvatar({people}, {id:"right",name:"Same"})).toBe("right.jpg");
  expect(resolvePersonAvatar({people}, {name:"Same"})).toBe("");
  expect(conversationPerson(people,{subject:"Same"})).toBeNull();
  expect(conversationPerson(people,{participant_id:"right",subject:"Wrong"}).id).toBe("right");
 });
 it("respects removed photos and empty biographies and tolerates null identities",()=>{
  expect(resolveChatPerson([{id:"a",photo_url:null,bio:""}],{id:"a",photo_url:"old.jpg",bio:"old"})).toMatchObject({photo_url:null,bio:""});
  expect(resolvePersonAvatar({people:[{id:"a",photo_url:null,profilePicture:"old.jpg"}]},{id:"a"},"snapshot.jpg")).toBe("");
  expect(normalizeChatPerson(null).name).toBe("ALLBEE member");
 });
 it("resolves only two-person slugs that contain the current user",()=>{
  expect(participantFromSlug("admin:admin:partner","partner")).toBe("admin");
  expect(participantFromSlug("person:a:b","a")).toBe("b");
  for(const slug of ["person:a:b","person:a:a","district:a:b","person:a:b:c","admin::b"])expect(participantFromSlug(slug,"outsider")).toBeNull();
 });
 it("bounds identity reads to conversation IDs already authorized by the RPC",async()=>{
  const inIds=vi.fn().mockResolvedValue({data:[{id:"a",slug:"admin:admin:partner"}],error:null});
  const select=vi.fn(()=>({in:inIds})),from=vi.fn(()=>({select}));
  expect(await hydrateConversationPeople({from},[{conversation_id:"a",conv_type:"person"},{conversation_id:"room",conv_type:"district"}],"admin")).toEqual([{conversation_id:"a",conv_type:"person",participant_id:"partner"},{conversation_id:"room",conv_type:"district",participant_id:null}]);
  expect(select).toHaveBeenCalledWith("id,slug");expect(inIds).toHaveBeenCalledWith("id",["a"]);
 });
});
describe("populated admin client conversations",()=>{
 it("deduplicates messages, uses live sender identity, clears unread and opens profile/photo",async()=>{
  const f=fixture();await inbox(f);await openA();
  expect(screen.getAllByText("Hello")).toHaveLength(1);
  expect(screen.queryByText("Old name")).toBeNull();
  await waitFor(()=>expect(screen.queryByLabelText("2 unread messages")).toBeNull());
  expect(f.rpc).toHaveBeenCalledWith("apn_mark_read",{p_conversation_id:"a",p_message_id:"m1"});
  fireEvent.click(screen.getAllByRole("button",{name:"View Client A profile"})[0]);
  expect(await screen.findByRole("dialog",{name:"Client A profile"})).toBeTruthy();
  expect(screen.getByText("Design partner")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"View Client A photo"}));
  expect(screen.getByRole("dialog",{name:"Client A photo"})).toBeTruthy();
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.getByRole("dialog",{name:"Client A profile"})).toBeTruthy();
  fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("dialog")).toBeNull();
 });
 it("ignores a stale thread response after another conversation opens",async()=>{
  let finishA;
  const f=fixture({apn_list_messages:args=>args.p_conversation_id==="a"?new Promise(r=>finishA=r):Promise.resolve({data:[{...message,id:"b1",sender_id:"client-b",body:"Thread B"}],error:null})});
  await inbox(f);fireEvent.click(screen.getByText("Client A"));fireEvent.click(screen.getByText("Client B"));
  await screen.findByText("Thread B");
  await act(async()=>finishA({data:[message],error:null}));
  expect(screen.queryByText("Hello")).toBeNull();expect(screen.getByText("Thread B")).toBeTruthy();
 });
 it("keeps the draft on thrown send failure and guards rapid retries",async()=>{
  let finish;let failure=true;
  const f=fixture({apn_send_message_v3:()=>failure?Promise.reject(new Error("Network unavailable")):new Promise(r=>finish=r)});
  await inbox(f);await openA();fireEvent.change(screen.getByLabelText("Message"),{target:{value:"Keep my draft"}});
  fireEvent.click(screen.getByRole("button",{name:"Send",exact:true}));
  await screen.findByText("Network unavailable");expect(screen.getByLabelText("Message").value).toBe("Keep my draft");
  failure=false;fireEvent.keyDown(screen.getByLabelText("Message"),{key:"Enter"});fireEvent.keyDown(screen.getByLabelText("Message"),{key:"Enter"});
  expect(f.rpc.mock.calls.filter(([name])=>name==="apn_send_message_v3")).toHaveLength(2);
  await act(async()=>finish({data:[{message_id:"sent"}],error:null}));
  await waitFor(()=>expect(screen.getByLabelText("Message").value).toBe(""));
 });
 it("renders fetch errors with an actual retry, then updates through realtime",async()=>{
  let failure=true;
  const f=fixture({client_list_support_conversations:()=>Promise.resolve(failure?{data:null,error:{message:"Directory unavailable"}}:{data:rows,error:null})});
  render(<AdminClientChat me={me} runtime={f.runtime}/>);
  await screen.findByText("Directory unavailable");failure=false;fireEvent.click(screen.getByRole("button",{name:"Try again"}));await screen.findByText("Client A");
  await openA();const before=f.rpc.mock.calls.length;
  await act(async()=>{f.events[0]();await new Promise(r=>setTimeout(r,130))});
  expect(f.rpc.mock.calls.length).toBeGreaterThan(before);
 });
});
describe("shared client and profile interactions",()=>{
 it("client support preserves failed-send drafts and opens the canonical support profile",async()=>{
  const f=fixture({apn_list_messages:()=>Promise.resolve({data:[],error:null}),apn_send_message_v3:()=>Promise.resolve({error:{message:"Try sending again"}})});
  render(<ClientSupportChat profile={{id:"client",name:"Client"}} runtime={f.runtime}/>);
  fireEvent.click(await screen.findByText("Haji"));await screen.findByLabelText("Message");
  fireEvent.click(screen.getByRole("button",{name:"View Haji profile"}));expect(screen.getByText("Support bio")).toBeTruthy();fireEvent.keyDown(document,{key:"Escape"});
  fireEvent.change(screen.getByLabelText("Message"),{target:{value:"Please help"}});fireEvent.click(screen.getByRole("button",{name:"Send",exact:true}));await screen.findByText("Try sending again");expect(screen.getByLabelText("Message").value).toBe("Please help");
 });
 it("traps modal focus, restores the trigger, and disables absent photos",()=>{
  const close=vi.fn();render(<ChatProfileCard person={{id:"a",name:"Member"}} Avatar={Avatar} X={Icon} onClose={close}/>);
  const button=screen.getByRole("button",{name:"Close profile"});expect(document.activeElement).toBe(button);
  expect(screen.getByRole("button",{name:"View Member photo"}).disabled).toBe(true);
  fireEvent.keyDown(document,{key:"Tab"});expect(document.activeElement).toBe(button);
  fireEvent.keyDown(document,{key:"Escape"});expect(close).toHaveBeenCalledTimes(1);
 });
 it("reports reaction failure and permits retry without firing reactions from profile controls",async()=>{
  let fail=true;
  const rpc=vi.fn(async()=>({error:fail?{message:"Reaction unavailable"}:null})),changed=vi.fn();
  render(<MessageReactions message={message} supabase={{rpc}} onChanged={changed}><button>Profile</button><p>Message</p></MessageReactions>);
  fireEvent.doubleClick(screen.getByText("Profile"));expect(rpc).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"React to message"}));fireEvent.click(screen.getByRole("button",{name:"React 👍"}));
  await screen.findByText("Reaction unavailable");expect(changed).not.toHaveBeenCalled();
  fail=false;fireEvent.click(screen.getByRole("button",{name:"React 👍"}));await waitFor(()=>expect(changed).toHaveBeenCalledTimes(1));
 });
});
