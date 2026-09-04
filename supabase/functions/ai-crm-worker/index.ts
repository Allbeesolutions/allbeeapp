import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool } from "jsr:@db/postgres@^0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-allbee-worker-key"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const adminClient=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const pool=new Pool(Deno.env.get("SUPABASE_DB_URL")!,1,true);
async function workerSecret(){const c=await pool.connect();try{const r=await c.queryObject<{decrypted_secret:string}>`select decrypted_secret from vault.decrypted_secrets where name='allbee_crm_worker_secret' limit 1`;return r.rows[0]?.decrypted_secret||"";}finally{c.release();}}
async function deliver(a:any){
 const admin=adminClient(); const provider=a.action_type==="send_email"?"resend":a.action_type==="send_whatsapp"?"whatsapp":"internal";
 let messageId="",response:any=null,error="";
 try{
  if(provider==="resend"){
   const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("RESEND_FROM_EMAIL"); if(!key||!from) throw new Error("Email provider is not configured.");
   const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[String(a.payload?.to||"")],subject:String(a.payload?.subject||"Follow-up from ALLBEE"),text:String(a.payload?.body||""),headers:{"X-ALLBEE-Action-ID":a.id}})});
   response=await r.json().catch(()=>({status:r.status})); if(!r.ok) throw new Error(`Resend returned ${r.status}.`); messageId=String(response?.id||"");
  } else if(provider==="whatsapp"){
   const token=Deno.env.get("WHATSAPP_ACCESS_TOKEN"),phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"); if(!token||!phoneId) throw new Error("WhatsApp provider is not configured.");
   const to=String(a.payload?.to||"").replace(/\D/g,""); if(!to) throw new Error("WhatsApp recipient is invalid.");
   const r=await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to,type:"text",text:{body:String(a.payload?.body||"")}})});
   response=await r.json().catch(()=>({status:r.status})); if(!r.ok) throw new Error(`WhatsApp returned ${r.status}.`); messageId=String(response?.messages?.[0]?.id||"");
  } else throw new Error("Unsupported provider action.");
 }catch(e){error=e instanceof Error?e.message:"Provider delivery failed.";}
 await admin.rpc("ai_crm_worker_result",{p_action_id:a.id,p_ok:!error,p_error:error||null,p_provider:provider,p_message_id:messageId||null,p_response:response||{}});
 await admin.from("ai_crm_action_attempts").upsert({action_id:a.id,attempt_no:a.attempt_count,provider,status:error?"failed":"delivered",provider_message_id:messageId||null,response:response||{},error_message:error||null,finished_at:new Date().toISOString()},{onConflict:"action_id,attempt_no"});
 return {id:a.id,provider,ok:!error,error:error||null};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const secret=await workerSecret();
  if(!secret||req.headers.get("x-allbee-worker-key")!==secret) return json({error:"Worker authentication required."},401);
  const admin=adminClient(),results=[];
  for(let i=0;i<10;i++){
   const {data,error}=await admin.rpc("ai_crm_worker_claim",{p_limit:10}); if(error) throw new Error(error.message);
   if(!Array.isArray(data)||!data.length) break;
   for(const action of data) results.push(await deliver(action));
   if(data.length<10) break;
  }
  return json({ok:true,processed:results.length,results});
 }catch(e){return json({error:e instanceof Error?e.message:"AI CRM worker failed."},500)}
});
