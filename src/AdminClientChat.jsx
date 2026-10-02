import React,{useCallback,useEffect,useRef,useState} from "react";
import ChatProfileCard from "./ui/ChatProfileCard.jsx";
import {ChatIdentityButton,ChatMessage,ChatComposer} from "./ui/ChatPrimitives.jsx";
import {normalizeChatPerson,resolveChatPerson,uniqueChatMessages} from "./identity/chatIdentity.js";

export default function AdminClientChat({me,people=[],runtime}){
 const {supabase,Avatar,fmtDateTime,MessageCircle,RefreshCw,ArrowLeft,MessageSquare,X,Search}=runtime;
 const [rows,setRows]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[threadLoading,setThreadLoading]=useState(false),[directoryError,setDirectoryError]=useState(""),[err,setErr]=useState(""),[profile,setProfile]=useState(null),[query,setQuery]=useState(""),[unreadOnly,setUnreadOnly]=useState(false),[newMessages,setNewMessages]=useState(false);
 const scrollRef=useRef(null),selectedRef=useRef(null),requestRef=useRef(0),directoryRef=useRef(0),alive=useRef(true),sendingRef=useRef(false),nearBottom=useRef(true),drafts=useRef({});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;requestRef.current++;directoryRef.current++}},[]);
 const load=useCallback(async(quiet=false)=>{
  const request=++directoryRef.current;if(!quiet)setLoading(true);
  try{const {data,error}=await supabase.rpc("client_list_support_conversations");if(error)throw error;
    if(!alive.current||request!==directoryRef.current)return;
    setRows(Array.isArray(data)?data:[]);setDirectoryError("");
  }catch(error){if(alive.current&&request===directoryRef.current)setDirectoryError(error?.message||"Could not load client conversations. Please retry.")}
  finally{if(alive.current&&request===directoryRef.current)setLoading(false)}
 },[supabase]);
 const loadMessages=useCallback(async(id,{opening=false,forceScroll=false}={})=>{
  const request=++requestRef.current;if(opening){setMessages([]);setThreadLoading(true);setNewMessages(false);nearBottom.current=true}
  try{const {data,error}=await supabase.rpc("apn_list_messages",{p_conversation_id:id});if(error)throw error;
   if(!alive.current||selectedRef.current?.conversation_id!==id||request!==requestRef.current)return;
   const list=uniqueChatMessages(data);setMessages(list);setErr("");
   if(nearBottom.current||forceScroll)requestAnimationFrame(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight});
   else setNewMessages(true);
   if(list.length){const receipt=await supabase.rpc("apn_mark_read",{p_conversation_id:id,p_message_id:list.at(-1).id});if(receipt.error)throw receipt.error;
    if(alive.current&&selectedRef.current?.conversation_id===id){setRows(old=>old.map(r=>r.conversation_id===id?{...r,unread_count:0}:r))}}
  }catch(error){if(alive.current&&selectedRef.current?.conversation_id===id&&request===requestRef.current)setErr(error?.message||"Could not load messages. Please retry.")}
  finally{if(alive.current&&request===requestRef.current)setThreadLoading(false)}
 },[supabase]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{
  let timer=null;const refresh=()=>{if(timer)return;timer=setTimeout(()=>{timer=null;load(true);const current=selectedRef.current;if(current)loadMessages(current.conversation_id)},100)};
  const ch=supabase.channel(`admin-client-chat:${me.id}`).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_messages"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_reactions"},refresh).on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},()=>load(true)).subscribe();
  return()=>{if(timer)clearTimeout(timer);supabase.removeChannel(ch)}
 },[supabase,load,loadMessages,me.id]);
 const open=row=>{if(selectedRef.current?.conversation_id===row.conversation_id)return;selectedRef.current=row;setSelected(row);setText(drafts.current[row.conversation_id]||"");setErr("");loadMessages(row.conversation_id,{opening:true})};
 const back=()=>{selectedRef.current=null;requestRef.current++;setSelected(null);setMessages([]);setErr("");setThreadLoading(false)};
 const send=async()=>{
  const body=text.trim(),conversation=selectedRef.current;if(!body||!conversation||sendingRef.current)return;
  sendingRef.current=true;setBusy(true);setErr("");
  try{const {error}=await supabase.rpc("apn_send_message_v3",{p_conversation_id:conversation.conversation_id,p_body:body,p_reply_to_id:null,p_mentions:[]});if(error)throw error;
   if(drafts.current[conversation.conversation_id]?.trim()===body)drafts.current[conversation.conversation_id]="";
   if(selectedRef.current?.conversation_id===conversation.conversation_id){setText(current=>current.trim()===body?"":current);await loadMessages(conversation.conversation_id,{forceScroll:true})}
   await load(true);
  }catch(error){if(alive.current&&selectedRef.current?.conversation_id===conversation.conversation_id)setErr(error?.message||"Message could not be sent. Your draft is saved.")}
  finally{sendingRef.current=false;if(alive.current)setBusy(false)}
 };
 const active=rows.find(r=>r.conversation_id===selected?.conversation_id)||selected;
 const person=active?normalizeChatPerson({...active,id:active.client_id,name:active.client_name,photo_url:active.client_photo_url,bio:active.client_bio,role_label:"Client"}):null;
 const identities=[...people,me,...rows.map(r=>normalizeChatPerson({...r,id:r.client_id,name:r.client_name,photo_url:r.client_photo_url,bio:r.client_bio,role_label:"Client"}))];
 const visible=rows.filter(r=>`${r.client_name||""} ${r.last_message||""}`.toLowerCase().includes(query.trim().toLowerCase())&&(!unreadOnly||Number(r.unread_count)>0));
 const shortTime=value=>{const d=new Date(value);if(!Number.isFinite(d.getTime()))return "";return d.toDateString()===new Date().toDateString()?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString([],{day:"numeric",month:"short"})};
 return <div className="content admin-client-chat-page apn-teamchat">
  <div className="page-head"><div className="tc-brand"><div className="tc-brand-icon"><MessageCircle size={23}/></div><div><span className="tc-eyebrow">ALLBEE CONNECT</span><h3>Client chat</h3></div></div><span className="spacer"/><button className="btn sm" aria-label="Refresh client chats" onClick={()=>{load();if(selectedRef.current)loadMessages(selectedRef.current.conversation_id)}} disabled={loading}><RefreshCw size={14}/>Refresh</button></div>
  {directoryError&&<div className="auth-msg err client-chat-error" role="alert">{directoryError}<button className="btn sm" onClick={()=>load()}>Try again</button></div>}
  <div className={`apn-tc-shell apn-admin-chat-shell client-chat-shell${selected?" has-selection":""}`}>
   <aside className="apn-tc-sidebar client-chat-sidebar" aria-label="Client conversations">
    <div className="tc-inbox-heading"><div><div className="apn-tc-sidebar-title">Conversations</div><div className="apn-tc-sidebar-subtitle">Your clients. One connected workspace.</div></div></div>
    <div className="apn-tc-search">{Search&&<Search size={17}/>}<input aria-label="Search client chats" placeholder="Search clients or messages…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="tc-inbox-filters"><button type="button" aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>All chats</button><button type="button" aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Unread</button></div>
    {loading&&!rows.length?<div className="client-chat-state" role="status"><RefreshCw size={20} className="spin"/>Loading client chats…</div>:!visible.length?<div className="client-chat-state"><MessageCircle size={24}/><b>{rows.length?"No matching conversations":"No client conversations yet"}</b><span>{rows.length?"Try another search or switch to All chats.":"Client conversations appear here after a client starts a chat."}</span></div>:<div className="client-chat-list">{visible.map(r=><button type="button" key={r.conversation_id} aria-current={selected?.conversation_id===r.conversation_id?"true":undefined} className={`apn-tc-recent-row${selected?.conversation_id===r.conversation_id?" active":""}`} onClick={()=>open(r)}><Avatar name={r.client_name} url={r.client_photo_url} size={42}/><div className="apn-tc-recent-copy"><b>{r.client_name}</b><span>{r.last_message||"No messages yet"}</span></div><div className="client-chat-row-tail"><time dateTime={r.last_at} title={r.last_at?fmtDateTime(r.last_at):""}>{shortTime(r.last_at)}</time>{Number(r.unread_count)>0&&<span className="apn-tc-unread" aria-label={`${r.unread_count} unread messages`}>{r.unread_count>99?"99+":r.unread_count}</span>}</div></button>)}</div>}
   </aside>
   {selected?<main className="apn-tc-chat client-chat-main">
    <div className="apn-tc-chathead"><button type="button" className="linkbtn client-chat-back" onClick={back} aria-label="Back to client chats"><ArrowLeft size={18}/></button><ChatIdentityButton person={person} Avatar={Avatar} onClick={()=>setProfile(person)} subtitle="Client conversation"/></div>
    {err&&<div className="auth-msg err tc-thread-error" role="alert">{err}<button className="btn sm" onClick={()=>loadMessages(selectedRef.current.conversation_id)}>Try again</button></div>}
    <div className="apn-tc-messages" role="log" aria-label={`Conversation with ${person.name}`} aria-live="polite" ref={scrollRef} onScroll={()=>{const el=scrollRef.current;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;if(nearBottom.current)setNewMessages(false)}}>
     {threadLoading?<div className="chat-thread-state" role="status">Loading conversation…</div>:messages.map(m=><ChatMessage key={m.id} message={m} mine={String(m.sender_id)===String(me.id)} person={resolveChatPerson(identities,{id:m.sender_id,name:m.sender_name})} Avatar={Avatar} supabase={supabase} onChanged={()=>loadMessages(selectedRef.current.conversation_id)} onError={setErr} fmtDateTime={fmtDateTime} onProfile={setProfile}/>)}
     {!threadLoading&&!messages.length&&!err&&<div className="chat-thread-state"><MessageSquare size={28}/><b>Start a conversation</b><span>Send the first message to {person.name}.</span></div>}
    </div>
    {newMessages&&<button type="button" className="tc-new-messages" onClick={()=>{const el=scrollRef.current;if(el)el.scrollTop=el.scrollHeight;nearBottom.current=true;setNewMessages(false)}}>New messages ↓</button>}
    <ChatComposer text={text} setText={value=>{setText(value);drafts.current[selected.conversation_id]=value}} busy={busy||threadLoading} onSend={send} placeholder={`Message ${person.name}…`}/>
   </main>:<div className="apn-tc-main apn-tc-main-empty client-chat-empty"><div className="tc-welcome"><div className="tc-welcome-art" aria-hidden="true"><MessageCircle size={48}/><span>Clear updates. Happy clients.</span><i>Let’s work together.</i></div><span className="tc-eyebrow">YOUR CLIENTS. YOUR WORKSPACE.</span><h3>Good work starts with<br/>a conversation.</h3><p>Select a client to share an update or move the next step forward.</p></div></div>}
  </div>
  {profile&&<ChatProfileCard person={resolveChatPerson(identities,profile)} Avatar={Avatar} X={X} onClose={()=>setProfile(null)}/>}
 </div>;
}
