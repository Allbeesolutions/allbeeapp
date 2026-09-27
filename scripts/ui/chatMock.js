import {supabase as base, SUPABASE_URL} from "./mockSupabase.js";
export {SUPABASE_URL};
const now=Date.now();
const contacts=[{contact_id:"maya",contact_type:"partner",name:"Maya Patel",apn_id:"APN-TN-0042",district:"Chennai",relationship:"friend",availability:"online"},{contact_id:"jordan",contact_type:"partner",name:"Jordan Lee",apn_id:"APN-TN-0088",district:"Chennai",relationship:"friend",availability:"offline"},{contact_id:"admin",contact_type:"admin",name:"Alex Rivera",availability:"offline"}];
const conversations=Array.from({length:12},(_,i)=>({conversation_id:"chat-"+i,conv_type:"person",subject:i===0?"Maya Patel":i===1?"Jordan Lee":"Project team "+(i+1),last_message:i===0?"Perfect. Let’s share the proposal today.":"The next update is ready to review.",unread_count:i===0?2:0,participant_apn_id:"APN-TN-0042"}));
const messages=Array.from({length:22},(_,i)=>({id:"msg-"+i,sender_id:(i%3===0&&i!==21)?"ui-user":"maya",sender_name:(i%3===0&&i!==21)?"Alex Morgan":"Maya Patel",body:i===21?"Perfect. Let’s share the proposal today.":i===20?"I’ve reviewed the brief. The new direction looks great!":i===19?"https://example.test/"+("long-path-with-no-spaces-".repeat(12)):["Hey team! Ready to make this week a good one?","The client has approved the first draft.\nI’ll share the next steps after our call.","That works for me. Let’s keep the handoff simple."][i%3],created_at:new Date(now-(22-i)*60000).toISOString(),delivered_at:new Date(now).toISOString(),read_at:(i%3===0&&i!==21)?new Date(now).toISOString():null,reactions:i===21?[{emoji:"👍",count:2,mine:false}]:[]}));
window.__chatMock={messages,failSend:false,failUpload:false};
export const supabase={...base,
 rpc:async(name,args)=>{
  if(!/^apn_(list_conversations|list_chat_contacts|list_friend_requests|list_messages|open_person_chat|get_or_create_admin_conversation|get_district_conversation|get_state_conversation|chat_search|send_message_v3|edit_message|delete_message|message_info|toggle_reaction|chat_attach)$/.test(name))return base.rpc(name,args);
  window.__uiMock.rpcs.push({name,args});
  let data=[];
  if(name==="apn_list_conversations")data=conversations;
  if(name==="apn_list_chat_contacts")data=contacts;
  if(name==="apn_list_messages")data=[...messages];
  if(name==="apn_open_person_chat"||name==="apn_get_or_create_admin_conversation")data=[{conversation_id:"chat-0",subject:"Maya Patel",participant_apn_id:"APN-TN-0042"}];
  if(name==="apn_get_district_conversation"||name==="apn_get_state_conversation")data=[{conversation_id:name,subject:name.includes("district")?"Chennai district":"Tamil Nadu state"}];
  if(name==="apn_chat_search")data=messages.filter(m=>m.body.toLowerCase().includes(args.p_query.toLowerCase()));
  if(name==="apn_send_message_v3"){
   await new Promise(r=>setTimeout(r,150));
   if(window.__chatMock.failSend)return {data:null,error:{message:"Message could not be sent. Please try again."}};
   const id="sent-"+Date.now();messages.push({id,sender_id:"ui-user",sender_name:"Alex Morgan",body:args.p_body,reply_to_id:args.p_reply_to_id,created_at:new Date().toISOString()});data=[{message_id:id}];
  }
  if(name==="apn_edit_message"){const m=messages.find(m=>m.id===args.p_message_id);if(m){m.body=args.p_body;m.edited_at=new Date().toISOString();}}
  if(name==="apn_delete_message"){const i=messages.findIndex(m=>m.id===args.p_message_id);if(i>=0)messages.splice(i,1);}
  if(name==="apn_message_info")data=[messages.find(m=>m.id===args.p_message_id)];
  return {data,error:null};
 },
 storage:{from:()=>({upload:async()=>window.__chatMock.failUpload?{data:null,error:{message:"Upload unavailable"}}:{data:{path:"mock"},error:null},createSignedUrl:async()=>({data:{signedUrl:"data:text/plain,Mock attachment"},error:null})})}
};
