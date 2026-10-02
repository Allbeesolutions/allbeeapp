import React from "react";
import MessageReactions from "./MessageReactions.jsx";
import {Send} from "../icons.jsx";
import "./team-chat.css";
import "./chat-workspace.css";
export function ChatIdentityButton({person,Avatar,onClick,subtitle}) {
  return <button type="button" className="tc-profile-trigger" aria-label={`View ${person.name} profile`} onClick={onClick}>
    <Avatar name={person.name} url={person.photo_url} size={40}/>
    <div className="tc-thread-title">{person.name}<div className="apn-tc-presence">{subtitle || String(person.role_label || "").replaceAll("_"," ")}</div></div>
  </button>;
}
export function ChatMessage({message,mine,person,Avatar,supabase,onChanged,onError,fmtDateTime,onProfile}) {
  return <MessageReactions message={message} supabase={supabase} mine={mine} onChanged={onChanged} onError={onError} className={`shared-chat-message ${mine?"is-mine":"is-theirs"}`}>
    <div className={`apn-tc-msg ${mine?"mine":"theirs"}`}>
      {!mine && <button type="button" className="chat-avatar-profile-trigger" aria-label={`View ${person.name} profile`} onClick={()=>onProfile?.(person)}><Avatar name={person.name} url={person.photo_url} size={28}/></button>}
      <div className="apn-tc-bubble-wrap"><div className={`apn-tc-bubble${message.body==="This message was deleted"?" deleted":""}`}>
        {!mine && <div className="tc-sender">{person.name}</div>}
        <div className="apn-tc-text">{message.body}</div>
        <div className="apn-tc-time"><time dateTime={message.created_at}>{message.created_at?fmtDateTime(message.created_at):""}</time>{mine && (message.read_at || message.delivered_at) && <span>{message.read_at?"Seen":"Delivered"}</span>}</div>
      </div></div>
    </div>
  </MessageReactions>;
}
export function ChatComposer({text,setText,busy,onSend,placeholder="Type a message…"}) {
 return <div className="apn-tc-compose shared-chat-compose"><div className="tc-composer-row">
   <textarea className="textarea" aria-label="Message" value={text} onChange={e=>setText(e.target.value)} maxLength={2000} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent?.isComposing){e.preventDefault();onSend();}}} placeholder={placeholder} rows={1}/>
   <button type="button" className="btn primary" onClick={onSend} disabled={busy||!text.trim()} aria-label={busy?"Sending message":"Send"}><Send size={18}/><span>{busy?"Sending…":"Send"}</span></button>
 </div><div className="tc-composer-hint">Enter to send · Shift + Enter for a new line</div></div>;
}
