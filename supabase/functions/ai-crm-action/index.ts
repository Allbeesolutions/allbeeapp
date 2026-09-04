import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||""; if(!auth) return json({error:"Authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const admin=createClient(url,service);
  const {data:u,error:ue}=await client.auth.getUser(); if(ue||!u.user) return json({error:"Authentication required."},401);
  const body=await req.json().catch(()=>({})); const actionId=String(body.actionId||""); if(!actionId) return json({error:"Action id is required."},400);
  const {data:claimed,error:claimError}=await client.rpc("ai_crm_action_claim",{p_action_id:actionId});
  if(claimError) return json({error:claimError.message},409);
  const action=claimed as {id:string;actionType:string;payload:Record<string,unknown>;leadId:string};
  const provider=action.actionType==="send_email"?"resend":action.actionType==="send_whatsapp"?"whatsapp":"internal";
  const attemptNo=Number((await admin.from("ai_crm_action_attempts").select("attempt_no",{count:"exact",head:true}).eq("action_id",actionId)).count||0)+1;
  const started=new Date().toISOString();
  await admin.from("ai_crm_action_attempts").insert({action_id:actionId,attempt_no:attemptNo,provider,status:"executing",started_at:started});
  await admin.from("ai_crm_actions").update({attempt_count:attemptNo,last_attempt_at:started}).eq("id",actionId);
  let providerError="",providerMessageId="",providerResponse:unknown=null;
  try{
   if(action.actionType==="send_email"){
    const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("RESEND_FROM_EMAIL"); if(!key||!from) throw new Error("Email provider is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[String(action.payload.to)],subject:String(action.payload.subject||"Follow-up from ALLBEE"),text:String(action.payload.body||""),headers:{"X-ALLBEE-Action-ID":actionId}})});
    providerResponse=await r.json().catch(()=>({status:r.status})); if(!r.ok) throw new Error(`Email provider returned ${r.status}.`); providerMessageId=String((providerResponse as Record<string,unknown>)?.id||"");
   }else if(action.actionType==="send_whatsapp"){
    const token=Deno.env.get("WHATSAPP_ACCESS_TOKEN"),phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"); if(!token||!phoneId) throw new Error("WhatsApp provider is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
    const to=String(action.payload.to||"").replace(/\D/g,""); if(!to) throw new Error("WhatsApp recipient is invalid.");
    const r=await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:String(action.payload.body||"")}})});
    providerResponse=await r.json().catch(()=>({status:r.status})); if(!r.ok) throw new Error(`WhatsApp provider returned ${r.status}.`); providerMessageId=String((((providerResponse as Record<string,unknown>)?.messages as Array<Record<string,unknown>>|undefined)?.[0]?.id)||"");
   }else throw new Error("Unsupported provider action.");
  }catch(e){providerError=e instanceof Error?e.message:"Provider execution failed.";}
  const finished=new Date().toISOString();
  await admin.from("ai_crm_action_attempts").update({status:providerError?"failed":"delivered",provider_message_id:providerMessageId||null,response:providerResponse,error_message:providerError||null,finished_at:finished}).eq("action_id",actionId).eq("attempt_no",attemptNo);
  const {data:completed,error:completeError}=await admin.rpc("ai_crm_action_complete",{p_action_id:actionId,p_ok:!providerError,p_failure_reason:providerError||null});
  if(completeError) return json({error:completeError.message},500);
  await admin.from("ai_crm_actions").update({provider_message_id:providerMessageId||null,provider_status:providerError?"failed":"accepted",provider_response:providerResponse}).eq("id",actionId);
  if(providerError && attemptNo<5) await admin.from("ai_crm_actions").update({next_retry_at:new Date(Date.now()+Math.min(3600000,30000*Math.pow(2,attemptNo-1))).toISOString()}).eq("id",actionId);
  if(providerError){ await sleep(0); return json({error:providerError,action:completed,attempt:attemptNo,retry_available:attemptNo<5},502); }
  return json({ok:true,action:completed,delivery:{provider,providerMessageId,status:"accepted",attempt:attemptNo}});
 }catch(e){return json({error:e instanceof Error?e.message:"AI CRM action failed."},500);}
});
