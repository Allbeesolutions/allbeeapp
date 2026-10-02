// Local browser fixture only. Never bundled into a production build.
import {supabase as base,SUPABASE_URL} from "./mockSupabase.js";
export {SUPABASE_URL};
const portrait=(initial,color)=>"data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="32" fill="${color}"/><circle cx="80" cy="58" r="27" fill="#f2ceb7"/><path d="M25 150 Q20 90 80 90 Q140 90 135 150" fill="#243556"/><text x="80" y="146" text-anchor="middle" font-size="24" fill="white">${initial}</text></svg>`);
const people=[{id:"ui-user",name:"Alex Morgan",role:"superadmin",photo_url:portrait("AM","#b9dde4"),bio:"Working together, one project at a time."},{id:"client-a",name:"Northwind Studio",role:"client",photo_url:portrait("NS","#c8d7f5"),bio:"A design studio building thoughtful digital experiences."},{id:"client-b",name:"Jordan Lee",role:"client",photo_url:portrait("JL","#d2e4cd"),bio:"Independent business owner."},{id:"support",name:"Haji",role:"superadmin",photo_url:portrait("H","#d8d3f3"),bio:"Here to help the ALLBEE team."},{id:"maya",name:"Maya Patel",role:"partner",photo_url:portrait("MP","#f3d8cb"),bio:"APN partner in Chennai."}];
const now=Date.now();
const rows=[{conversation_id:"client-chat-a",client_id:"client-a",client_name:people[1].name,client_photo_url:people[1].photo_url,client_bio:people[1].bio,last_message:"Perfect. Let’s share the proposal today.",last_at:new Date(now).toISOString(),unread_count:2},{conversation_id:"client-chat-b",client_id:"client-b",client_name:people[2].name,client_photo_url:people[2].photo_url,client_bio:people[2].bio,last_message:"Thanks for the update!",last_at:new Date(now-86400000).toISOString(),unread_count:0}];
const messages=Array.from({length:24},(_,i)=>({id:"client-msg-"+i,sender_id:i%3===0?"ui-user":"client-a",sender_name:i%3===0?"Old Admin":"Old Client Name",body:i===23?"Perfect. Let’s share the proposal today.":i===22?"The updated quotation is ready. I’ve included the agreed scope and next steps.":i===21?"Excellent — thank you!":i===20?"https://example.test/"+("long-unbroken-path-".repeat(18)):["Good morning! How is the website review going?","We’ve reviewed the draft. The new direction looks great!","Let’s keep the handoff simple. I’ll share the checklist after our call."][i%3],created_at:new Date(now-(24-i)*60000).toISOString(),read_at:i%3===0?new Date(now).toISOString():null,reactions:i===21?[{emoji:"❤️",count:2,mine:true}]:i===23?[{emoji:"👍",count:1,mine:false}]:[]}));
const supportMessages=messages.map(m=>({...m,sender_id:m.sender_id==="client-a"?"support":"ui-user",sender_name:"Historical name"}));
const apnRows=[{conversation_id:"apn-chat",conv_type:"person",subject:"Alex Morgan",last_message:"The proposal is ready.",unread_count:2}];
let callbacks=[];
window.__chatRepair={messages,failSend:false,failMessages:false,failReaction:false,failDirectory:false,emit:()=>callbacks.forEach(cb=>cb({}))};
const result=data=>Promise.resolve({data,error:null});
export const supabase={...base,
 from(table){
  if(table==="profiles"||table==="apn_chat_conversations"){
   const original=base.from(table);let ids=null;
   original.in=(_key,value)=>{ids=value;return original};
   original.then=(yes,no)=>{window.__uiMock.reads.push(table);return result(table==="profiles"?people.filter(p=>!ids||ids.includes(p.id)):[{id:"apn-chat",slug:"admin:ui-user:maya"}]).then(yes,no)};
   return original;
  }
  if(table==="chat") {const b=base.from(table);b.then=(yes,no)=>result([{id:"internal-1",data:{id:"internal-1",userId:"support",userName:"Stale Support Name",text:"Internal team update",createdAt:now}}]).then(yes,no);return b;}
  return base.from(table);
 },
 channel(){return {on(type,filter,cb){if(["apn_chat_messages","apn_chat_reactions"].includes(filter.table))callbacks.push(cb);return this},subscribe(){return this}}},
 removeChannel(){callbacks=[];return result(null)},
 async rpc(name,args){
  const managed=["client_list_support_conversations","client_support_directory","apn_get_or_create_admin_conversation","apn_list_messages","apn_send_message_v3","apn_admin_send_message","apn_list_conversations","apn_list_chat_contacts","apn_toggle_reaction","apn_delete_message"];
  if(!managed.includes(name))return base.rpc(name,args);
  window.__uiMock.rpcs.push({name,args});
  const state=window.__chatRepair;
  if(name==="client_list_support_conversations")return state.failDirectory?{data:null,error:{message:"Could not load client chats. Try again."}}:result(rows);
  if(name==="client_support_directory")return result([people[3]]);
  if(name==="apn_list_conversations")return result(apnRows);
  if(name==="apn_list_chat_contacts")return result([{...people[4],contact_id:"maya",contact_type:"partner",apn_id:"APN-TN-0042",relationship:"friend",district:"Chennai"}]);
  if(name==="apn_get_or_create_admin_conversation")return result([{conversation_id:"support-chat",subject:"Wrong historical title"}]);
  if(name==="apn_list_messages"){
   await new Promise(r=>setTimeout(r,80));
   if(state.failMessages)return {data:null,error:{message:"Could not load messages. Try again."}};
   return result(args.p_conversation_id==="client-chat-b"?[{...messages[0],id:"jordan-msg",sender_id:"client-b",body:"Thanks for the update!"}]:args.p_conversation_id==="support-chat"?supportMessages:args.p_conversation_id==="apn-chat"?messages.map(m=>({...m,sender_id:m.sender_id==="client-a"?"maya":m.sender_id})):messages);
  }
  if(name==="apn_send_message_v3"||name==="apn_admin_send_message"){
   await new Promise(r=>setTimeout(r,150));if(state.failSend)return {data:null,error:{message:"Message could not be sent. Your draft is saved."}};
   const msg={id:"sent-"+Date.now(),sender_id:"ui-user",sender_name:"Alex Morgan",body:args.p_body,created_at:new Date().toISOString(),reactions:[]};messages.push(msg);supportMessages.push(msg);return result([{message_id:msg.id}]);
  }
  if(name==="apn_toggle_reaction"){
   if(state.failReaction)return {data:null,error:{message:"Reaction unavailable. Try again."}};
   const m=[...messages,...supportMessages].find(m=>m.id===args.p_message_id);if(m)m.reactions=[{emoji:args.p_emoji,count:1,mine:true}];return result([]);
  }
  if(name==="apn_delete_message"){const m=messages.find(m=>m.id===args.p_message_id);if(m)m.body="This message was deleted";return result([]);}
  return result([]);
 }
};
