import React,{useRef,useState} from "react";
import { isTouchDoubleTap } from "./doubleTap";
export const CHAT_REACTIONS=["👍","❤️","😂","😮","😢","🎉"];
export default function MessageReactions({message,supabase,onChanged,onError,children,mine=false,className=""}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const busyRef=useRef(false);
 const deleted=message?.body==="This message was deleted";
 const act=async(name,args)=>{if(deleted||busyRef.current)return;busyRef.current=true;setBusy(true);setError("");try{const {error:rpcError}=await supabase.rpc(name,args);if(rpcError)throw rpcError;await onChanged?.();setOpen(false)}catch(e){const msg=e?.message||"Could not update this message. Try again.";setError(msg);onError?.(msg)}finally{busyRef.current=false;setBusy(false)}};
 const toggle=emoji=>act("apn_toggle_reaction",{p_message_id:message.id,p_emoji:emoji});
 const del=()=>mine&&act("apn_delete_message",{p_message_id:message.id});
 const canDelete=mine&&!deleted&&message?.created_at&&(Date.now()-new Date(message.created_at).getTime()<=3600000);
 const fromControl=e=>e.target.closest?.("button,a,input,textarea");
 return <div className={`msg-react-shell ${className}`.trim()} onDoubleClick={e=>{if(fromControl(e))return;e.stopPropagation();toggle("❤️")}} onPointerUp={e=>{if(!fromControl(e)&&isTouchDoubleTap(message?.id,e)){e.preventDefault();e.stopPropagation();toggle("❤️")}}}>
   {children}
   {!deleted&&<button type="button" className="msg-react-trigger" aria-label="React to message" aria-expanded={open} disabled={busy} onClick={e=>{e.stopPropagation();setOpen(v=>!v)}}>☺</button>}
   {open&&<div className="msg-react-picker" role="group" aria-label="Message reactions">{CHAT_REACTIONS.map(x=><button type="button" key={x} aria-label={`React ${x}`} disabled={busy} onClick={()=>toggle(x)}>{x}</button>)}{canDelete&&<button type="button" className="danger" disabled={busy} onClick={del}>Delete</button>}</div>}
   {Array.isArray(message?.reactions)&&message.reactions.length>0&&<div className="msg-react-summary">{message.reactions.map(r=><button type="button" key={r.emoji} aria-label={`${r.emoji}: ${r.count ?? r.reaction_count ?? 0} reactions`} aria-pressed={!!r.mine} disabled={busy} className={r.mine?"mine":""} onClick={()=>toggle(r.emoji)}>{r.emoji} {r.count ?? r.reaction_count ?? 0}</button>)}</div>}
   {error&&!onError&&<div className="hint-line" role="alert">{error}</div>}
 </div>;
}
