import React,{useState,useEffect,useCallback,useRef} from "react";
import {supabase} from "./supabaseClient";
import ChatProfileCard from "./ui/ChatProfileCard.jsx";
import {ChatIdentityButton,ChatMessage,ChatComposer} from "./ui/ChatPrimitives.jsx";
import {conversationPerson,normalizeChatPerson,resolveChatPerson,uniqueChatMessages} from "./identity/chatIdentity.js";
import {hydrateConversationPeople} from "./identity/conversationIdentity.js";

export default function AdminAPNChatImpl({me,onUnreadChange,runtime}) {
 const {Avatar,Empty,fmtDateTime,ExpandableChatButton,MessageCircle,RefreshCw,Search,ArrowLeft,MessageSquare,X}=runtime;
 const [conversations,setConversations]=useState([]),[contacts,setContacts]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState(""),[filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[loading,setLoading]=useState(true),[threadLoading,setThreadLoading]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[expanded,setExpanded]=useState(false),[contactProfile,setContactProfile]=useState(null);
 const mounted=useRef(true),scrollRef=useRef(null),requestRef=useRef(0),directoryRef=useRef(0),selectedRef=useRef(null),sendingRef=useRef(false),nearBottom=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestRef.current++;directoryRef.current++}},[]);
 const load=useCallback(async(quiet=false)=>{
  const request=++directoryRef.current;if(!quiet)setLoading(true);
  try{
   const [convRes,contactsRes]=await Promise.all([supabase.rpc("apn_list_conversations"),supabase.rpc("apn_list_chat_contacts")]);
   if(convRes.error)throw convRes.error;if(contactsRes.error)throw contactsRes.error;
   const rows=await hydrateConversationPeople(supabase,convRes.data,me.id);
   if(!mounted.current||request!==directoryRef.current)return;
   // Contact RPC is authoritative for identity; overlay bounded live profile fields.
   let people=Array.isArray(contactsRes.data)?contactsRes.data:[];const profiles=new Map();
   const ids=people.map(p=>p.contact_id).filter(Boolean);
   for(let i=0;i<ids.length;i+=100){const res=await supabase.from("profiles").select("id,name,photo_url,bio").in("id",ids.slice(i,i+100));if(res.error)throw res.error;for(const p of res.data || [])profiles.set(String(p.id),p);}
   if(!mounted.current||request!==directoryRef.current)return;
   people=people.map(p=>normalizeChatPerson({...p,...(profiles.get(String(p.contact_id))||{})}));
   setContacts(people);setConversations(rows);setErr("");onUnreadChange?.(rows.reduce((n,c)=>n+Number(c.unread_count||0),0));
  }catch(e){if(mounted.current&&request===directoryRef.current)setErr(e.message||"Could not load APN chats.")}
  finally{if(mounted.current&&request===directoryRef.current)setLoading(false)}
 },[me.id,onUnreadChange]);
 const loadMessages=useCallback(async(conv,{opening=false,forceScroll=false}={})=>{
  const id=conv.conversation_id || conv.id,request=++requestRef.current;
  if(opening){setMessages([]);setThreadLoading(true);nearBottom.current=true}
  try{const {data,error}=await supabase.rpc("apn_list_messages",{p_conversation_id:id});if(error)throw error;
   if(!mounted.current||request!==requestRef.current||(selectedRef.current?.conversation_id || selectedRef.current?.id)!==id)return;
   const rows=uniqueChatMessages(data);setMessages(rows);setErr("");
   if(nearBottom.current||forceScroll)requestAnimationFrame(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight});
   if(rows.length){const receipt=await supabase.rpc("apn_admin_mark_read",{p_conversation_id:id,p_message_id:rows.at(-1).id});if(receipt.error)throw receipt.error;await load(true)}
  }catch(e){if(mounted.current&&request===requestRef.current)setErr(e.message||"Could not load messages.")}
  finally{if(mounted.current&&request===requestRef.current)setThreadLoading(false)}
 },[load]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{
  let timer;const refresh=()=>{if(timer)return;timer=setTimeout(()=>{timer=null;load(true);if(selectedRef.current)loadMessages(selectedRef.current)},100)};
  const ch=supabase.channel(`admin-apn-team-chat:${me.id}`).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_messages"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_reactions"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"apn_friend_requests"},()=>load(true)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},()=>load(true)).subscribe();
  return()=>{clearTimeout(timer);supabase.removeChannel(ch)}
 },[me.id,load,loadMessages]);
 const open=conv=>{selectedRef.current=conv;setSelected(conv);setText("");setErr("");loadMessages(conv,{opening:true})};
 const back=()=>{selectedRef.current=null;requestRef.current++;setSelected(null);setMessages([]);setThreadLoading(false);setErr("")};
 const send=async()=>{
  const body=text.trim(),conv=selectedRef.current;if(!body||!conv||sendingRef.current)return;sendingRef.current=true;setBusy(true);setErr("");
  try{const {error}=await supabase.rpc("apn_admin_send_message",{p_conversation_id:conv.conversation_id || conv.id,p_body:body});if(error)throw error;
   if(selectedRef.current===conv){setText(current=>current.trim()===body?"":current);await loadMessages(conv,{forceScroll:true})}
  }catch(e){if(mounted.current)setErr(e.message||"Message could not be sent. Your draft is saved.")}
  finally{sendingRef.current=false;if(mounted.current)setBusy(false)}
 };
 const startPartnerChat=async contact=>{
  if(!contact.apn_id||busy)return;setBusy(true);setErr("");
  try{const {data,error}=await supabase.rpc("apn_admin_open_partner_chat",{p_partner_apn_id:contact.apn_id});if(error)throw error;if(!data?.[0])throw new Error("Chat unavailable.");
   open({conversation_id:data[0].conversation_id,conv_type:"person",subject:contact.name,participant_id:contact.contact_id,participant_apn_id:contact.apn_id});
  }catch(e){setErr(e.message||"Could not open partner chat.")}finally{setBusy(false)}
 };
 const conversationContact=c=>c?.conv_type==="person"?conversationPerson(contacts,c):null;
 const title=c=>conversationContact(c)?.name || c.subject || "APN chat";
 const filtered=conversations.filter(c=>filter==="all"||c.conv_type===filter).filter(c=>`${title(c)} ${c.last_message||""}`.toLowerCase().includes(search.trim().toLowerCase()));
 const partners=contacts.filter(c=>c.contact_type==="partner"&&`${c.name} ${c.apn_id} ${c.district||""}`.toLowerCase().includes(search.trim().toLowerCase()));
 const identities=[...contacts,normalizeChatPerson(me)];
 return <div className={`content apn-teamchat admin-client-chat-page chat-surface-expandable${expanded?" chat-expanded":""}`}>
  <div className="chat-expand-corner"><ExpandableChatButton expanded={expanded} onToggle={()=>setExpanded(v=>!v)}/></div>
  <div className="page-head"><div className="tc-brand"><span className="tc-brand-icon"><MessageCircle size={22}/></span><div><span className="tc-eyebrow">ALLBEE CONNECT</span><h3>APN chat</h3></div></div><span className="spacer"/><button className="btn sm" onClick={()=>load()} disabled={loading}><RefreshCw size={14}/>Refresh</button></div>
  {err&&<div className="auth-msg err tc-thread-error" role="alert">{err}<button className="btn sm" onClick={()=>selected?loadMessages(selected):load()}>Try again</button></div>}
  <div className={`apn-tc-shell apn-admin-chat-shell${selected?" has-selection":""}`}>
   <aside className="apn-tc-sidebar admin-apn-sidebar">
    <div className="apn-tc-sidebar-title">Conversations</div>
    <div className="seg apn-admin-filters">{[["all","All"],["person","Partners"],["district","District"],["state","State"]].map(([k,l])=><button key={k} className={filter===k?"on":""} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}</button>)}</div>
    <div className="apn-tc-search"><Search size={17}/><input aria-label="Search APN chats or partners" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats or partners…"/></div>
    {loading&&!conversations.length&&<p role="status">Loading APN chats…</p>}
    {filtered.map(c=><button key={c.conversation_id} className={`apn-tc-recent-row${selected?.conversation_id===c.conversation_id?" active":""}`} aria-current={selected?.conversation_id===c.conversation_id?"true":undefined} onClick={()=>open(c)}>
     <Avatar name={title(c)} url={conversationContact(c)?.photo_url} size={42}/><div className="apn-tc-recent-copy"><b>{title(c)}</b><span>{c.last_message||"No messages yet"}</span></div>{Number(c.unread_count)>0&&<span className="apn-tc-unread">{c.unread_count}</span>}
    </button>)}
    {!loading&&!filtered.length&&<p className="tc-list-empty">No APN conversations found.</p>}
    <div className="apn-tc-card"><div className="apn-tc-card-title">Start partner chat</div>
     {partners.slice(0,12).map(c=><div key={c.id} className="apn-tc-partner-row"><button className="chat-avatar-profile-trigger" aria-label={`View ${c.name} profile`} onClick={()=>setContactProfile(c)}><Avatar name={c.name} url={c.photo_url} size={32}/></button><div className="apn-tc-partner-meta"><b>{c.name}</b><div className="apn-tc-partner-location">{c.apn_id||"APN partner"}{c.district?` · ${c.district}`:""}</div></div><button className="btn sm" disabled={busy} onClick={()=>startPartnerChat(c)}>Chat</button></div>)}
    </div>
   </aside>
   {selected?<main className="apn-tc-chat client-chat-main">
    <div className="apn-tc-chathead"><button className="linkbtn client-chat-back" aria-label="Back to APN chats" onClick={back}><ArrowLeft size={18}/></button>
     {conversationContact(selected)?<ChatIdentityButton person={conversationContact(selected)} Avatar={Avatar} onClick={()=>setContactProfile(conversationContact(selected))} subtitle="Partner conversation"/>:<div className="tc-thread-title">{title(selected)}<div className="apn-tc-presence">Group conversation</div></div>}
    </div>
    <div className="apn-tc-messages" ref={scrollRef} role="log" aria-label={`Conversation: ${title(selected)}`} onScroll={()=>{const el=scrollRef.current;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70}}>
     {threadLoading?<div className="chat-thread-state" role="status">Loading conversation…</div>:messages.map(m=><ChatMessage key={m.id} message={m} mine={String(m.sender_id)===String(me.id)} person={resolveChatPerson(identities,{id:m.sender_id,name:m.sender_name})} Avatar={Avatar} supabase={supabase} fmtDateTime={fmtDateTime} onChanged={()=>loadMessages(selectedRef.current)} onError={setErr} onProfile={setContactProfile}/>)}
     {!threadLoading&&!messages.length&&!err&&<Empty icon={<MessageSquare size={20}/>} title="No messages yet" text="Send the first message."/>}
    </div>
    <ChatComposer text={text} setText={setText} busy={busy||threadLoading} onSend={send} placeholder="Message the APN partner…"/>
   </main>:<div className="apn-tc-main-empty"><div className="tc-welcome"><div className="tc-welcome-art" aria-hidden="true"><MessageCircle size={48}/></div><span className="tc-eyebrow">YOUR PARTNER WORKSPACE</span><h3>Good work starts with<br/>a conversation.</h3><p>Select a partner conversation, district chat, or state chat.</p></div></div>}
  </div>
  {contactProfile&&<ChatProfileCard person={resolveChatPerson(identities,contactProfile)} Avatar={Avatar} X={X} onClose={()=>setContactProfile(null)}/>}
 </div>;
}
