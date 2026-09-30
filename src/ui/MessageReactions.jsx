import React,{useState} from "react";
import { isTouchDoubleTap } from "./doubleTap";
export const CHAT_REACTIONS=["👍","❤️","😂","😮","😢","🎉"];
export default function MessageReactions({message,supabase,onChanged,children,mine=false}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const deleted=message?.body==="This message was deleted";
 const toggle=async emoji=>{if(deleted||busy)return;setBusy(true);try{await supabase.rpc("apn_toggle_reaction",{p_message_id:message.id,p_emoji:emoji});await onChanged?.()}finally{setBusy(false);setOpen(false)}};
 const del=async()=>{if(!mine||deleted||busy)return;setBusy(true);try{const {error}=await supabase.rpc("apn_delete_message",{p_message_id:message.id});if(error)throw error;await onChanged?.()}finally{setBusy(false);setOpen(false)}};
 const canDelete=mine&&!deleted&&message?.created_at&&(Date.now()-new Date(message.created_at).getTime()<=3600000);
 return <div className="msg-react-shell" onDoubleClick={e=>{e.stopPropagation();toggle("❤️")}} onPointerUp={e=>{if(isTouchDoubleTap(message?.id,e)){e.preventDefault();e.stopPropagation();toggle("❤️")}}}>{children}{!deleted&&<button className="msg-react-trigger" aria-label="React to message" onClick={e=>{e.stopPropagation();setOpen(v=>!v)}}>☺</button>}{open&&<div className="msg-react-picker">{CHAT_REACTIONS.map(x=><button key={x} onClick={()=>toggle(x)}>{x}</button>)}{canDelete&&<button className="danger" onClick={del}>Delete</button>}</div>}{Array.isArray(message?.reactions)&&message.reactions.length>0&&<div className="msg-react-summary">{message.reactions.map(r=><button key={r.emoji} className={r.mine?"mine":""} onClick={()=>toggle(r.emoji)}>{r.emoji} {r.count}</button>)}</div>}</div>;
}
