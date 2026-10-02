import React,{useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ChevronRight,MessageCircle,X} from "./icons.jsx";
import ChatProfileCard from "./ui/ChatProfileCard.jsx";
import {ChatIdentityButton,ChatMessage,ChatComposer} from "./ui/ChatPrimitives.jsx";
import {normalizeChatPerson,resolveChatPerson,uniqueChatMessages} from "./identity/chatIdentity.js";

const SUPPORT_ORDER=["saranya","haji","mohamed backer alim"];
const labelFor=(n="")=>/mohamed\s+backer\s+alim/i.test(n)?"Chat with AllBee Founder and CEO":/^haji$/i.test(n.trim())?"Chat with AllBee Co-founder and CFO":"Chat with AllBee Admins";
export default function ClientSupportChat({profile,runtime}){
 const {supabase,Avatar,fmtDateTime,emitToast}=runtime;
 const [contacts,setContacts]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState(""),[busy,setBusy]=useState(false),[opening,setOpening]=useState(false),[loading,setLoading]=useState(true),[err,setErr]=useState(""),[contactProfile,setContactProfile]=useState(null);
 const selectedRef=useRef(null),requestRef=useRef(0),openRef=useRef(0),alive=useRef(true),sendRef=useRef(false),scrollRef=useRef(null),nearBottom=useRef(true),drafts=useRef({});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;requestRef.current++;openRef.current++}},[]);
 const loadContacts=useCallback(async()=>{
  setLoading(true);
  try{const {data,error}=await supabase.rpc("client_support_directory");if(error)throw error;if(!alive.current)return;
   const rows=(Array.isArray(data)?data:[]).filter(x=>SUPPORT_ORDER.includes(String(x.name||"").trim().toLowerCase())).sort((a,b)=>SUPPORT_ORDER.indexOf(a.name.trim().toLowerCase())-SUPPORT_ORDER.indexOf(b.name.trim().toLowerCase()));
   setContacts(rows.map(normalizeChatPerson));setErr("");
  }catch(e){if(alive.current)setErr(e.message||"Could not load support contacts.")}
  finally{if(alive.current)setLoading(false)}
 },[supabase]);
 const loadMessages=useCallback(async(conv,{forceScroll=false}={})=>{
  const request=++requestRef.current;
  try{const {data,error}=await supabase.rpc("apn_list_messages",{p_conversation_id:conv.id});if(error)throw error;
   if(!alive.current||request!==requestRef.current||selectedRef.current?.id!==conv.id)return;
   const rows=uniqueChatMessages(data);setMessages(rows);setErr("");
   if(nearBottom.current||forceScroll)requestAnimationFrame(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight});
   if(rows.length){const receipt=await supabase.rpc("apn_mark_read",{p_conversation_id:conv.id,p_message_id:rows.at(-1).id});if(receipt.error)throw receipt.error;}
  }catch(e){if(alive.current&&request===requestRef.current&&selectedRef.current?.id===conv.id)setErr(e.message||"Could not load messages.")}
 },[supabase]);
 useEffect(()=>{loadContacts()},[loadContacts]);
 useEffect(()=>{
  let timer;const refresh=()=>{if(timer)return;timer=setTimeout(()=>{timer=null;if(selectedRef.current)loadMessages(selectedRef.current)},100)};
  const ch=supabase.channel(`client-support:${profile.id}`).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_messages"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"apn_chat_reactions"},refresh).on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},loadContacts).subscribe();
  return()=>{clearTimeout(timer);supabase.removeChannel(ch)}
 },[profile.id,supabase,loadMessages,loadContacts]);
 const open=async(c)=>{
  const request=++openRef.current;setOpening(true);setErr("");
  try{const {data,error}=await supabase.rpc("apn_get_or_create_admin_conversation",{p_admin_id:c.id});if(error)throw error;
   if(!alive.current||request!==openRef.current)return;
   const row=data?.[0];if(!row)throw new Error("Chat unavailable.");
   const conv={id:row.conversation_id,subject:c.name,contact:c};selectedRef.current=conv;setSelected(conv);setMessages([]);nearBottom.current=true;setText(drafts.current[conv.id]||"");await loadMessages(conv,{forceScroll:true});
  }catch(e){if(alive.current&&request===openRef.current)setErr(e.message||"Could not open this chat.")}
  finally{if(alive.current&&request===openRef.current)setOpening(false)}
 };
 const back=()=>{selectedRef.current=null;requestRef.current++;openRef.current++;setSelected(null);setOpening(false);setErr("")};
 const send=async()=>{
  const body=text.trim(),conv=selectedRef.current;if(!body||!conv||sendRef.current)return;
  sendRef.current=true;setBusy(true);setErr("");
  try{const {error}=await supabase.rpc("apn_send_message_v3",{p_conversation_id:conv.id,p_body:body,p_reply_to_id:null,p_mentions:[]});if(error)throw error;
   if(drafts.current[conv.id]?.trim()===body)drafts.current[conv.id]="";
   if(alive.current&&selectedRef.current?.id===conv.id){setText(current=>current.trim()===body?"":current);await loadMessages(conv,{forceScroll:true})}
  }catch(e){if(alive.current&&selectedRef.current?.id===conv.id){setErr(e.message||"Could not send message. Your draft is saved.");emitToast?.(e.message||"Could not send message.","error")}}
  finally{sendRef.current=false;if(alive.current)setBusy(false)}
 };
 const contact=selected?(contacts.find(c=>c.id===selected.contact.id)||selected.contact):null;
 const people=[...contacts,normalizeChatPerson(profile)];
 if(selected)return <section className="client-support-thread apn-teamchat">
  <div className="apn-tc-chathead"><button type="button" className="linkbtn" onClick={back} aria-label="Back to support contacts"><ArrowLeft size={18}/></button><ChatIdentityButton person={contact} Avatar={Avatar} onClick={()=>setContactProfile(contact)} subtitle={labelFor(contact.name)}/></div>
  {err&&<div className="auth-msg err tc-thread-error" role="alert">{err}<button className="btn sm" onClick={()=>loadMessages(selectedRef.current)}>Try again</button></div>}
  <div className="apn-tc-messages" ref={scrollRef} role="log" aria-label={`Conversation with ${contact.name}`} aria-live="polite" onScroll={()=>{const el=scrollRef.current;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70}}>
   {opening?<div className="chat-thread-state" role="status">Loading conversation…</div>:messages.map(m=><ChatMessage key={m.id} message={m} supabase={supabase} mine={String(m.sender_id)===String(profile.id)} person={resolveChatPerson(people,{id:m.sender_id,name:m.sender_name})} Avatar={Avatar} fmtDateTime={fmtDateTime} onChanged={()=>loadMessages(selectedRef.current)} onError={setErr} onProfile={setContactProfile}/>)}
   {!opening&&!messages.length&&!err&&<div className="chat-thread-state"><MessageCircle size={34}/><b>Start a conversation</b><span>Send a message to {contact.name}. Your conversation stays here.</span></div>}
  </div>
  <ChatComposer text={text} setText={value=>{drafts.current[selected.id]=value;setText(value)}} busy={busy||opening} onSend={send} placeholder={`Message ${contact.name}…`}/>
  {contactProfile&&<ChatProfileCard person={resolveChatPerson(people,contactProfile)} Avatar={Avatar} X={X} onClose={()=>setContactProfile(null)}/>}
 </section>;
 return <section className="client-support-chat"><div className="client-chat-title"><span>ALLBEE SUPPORT</span><h2>Chat with our team</h2><p>Choose who you'd like to speak with. These are your dedicated ALLBEE support contacts.</p></div>
  {err&&<div className="auth-msg err" role="alert">{err}<button className="btn sm" onClick={loadContacts}>Try again</button></div>}
  {loading&&<p role="status">Loading support contacts…</p>}
  {!loading&&!contacts.length&&!err&&<div className="chat-thread-state"><b>No support contacts available</b><span>Refresh to check again, or use My Tickets to contact the team.</span></div>}
  <div className="client-support-list">{contacts.map(c=><button key={c.id} onClick={()=>open(c)} disabled={opening}><Avatar name={c.name} url={c.photo_url} size={58}/><div><b>{c.name}</b><span>{labelFor(c.name)}</span></div><i>Support</i><ChevronRight size={22}/></button>)}</div>
 </section>;
}
