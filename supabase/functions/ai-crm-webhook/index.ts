import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature, x-provider"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const sb=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hmacValid(secret:string,message:string,signature:string){const key=secret.replace(/^whsec_/,'');const cryptoKey=await crypto.subtle.importKey("raw",bytes(key),{name:"HMAC",hash:"SHA-256"},false,["verify"]);return crypto.subtle.verify("HMAC",cryptoKey,bytes(signature),new TextEncoder().encode(message));}
async function verifyResend(raw:string,req:Request){const secret=Deno.env.get("RESEND_WEBHOOK_SIGNING_SECRET")||"";const id=req.headers.get("svix-id")||"",ts=req.headers.get("svix-timestamp")||"",sig=req.headers.get("svix-signature")||"";if(!secret||!id||!ts||!sig) return false;const age=Math.abs(Date.now()-Number(ts)*1000);if(!Number.isFinite(age)||age>5*60*1000)return false;for(const part of sig.split(" ")){const [v,b64]=part.split(",");if(v==="v1"&&b64&&await hmacValid(secret,`${id}.${ts}.${raw}`,b64))return true;}return false;}
async function verifyMeta(raw:string,req:Request){const secret=Deno.env.get("WHATSAPP_APP_SECRET")||"";const given=(req.headers.get("x-hub-signature-256")||"").replace(/^sha256=/,'');if(!secret||!given)return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const expected=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw));const hex=Array.from(new Uint8Array(expected)).map(x=>x.toString(16).padStart(2,"0")).join("");return hex===given;}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method==="GET"){const u=new URL(req.url);if(u.searchParams.get("hub.mode")==="subscribe"&&u.searchParams.get("hub.verify_token")===Deno.env.get("WHATSAPP_VERIFY_TOKEN"))return new Response(u.searchParams.get("hub.challenge")||"",{status:200});return json({error:"Webhook verification failed."},403);}
 try{
  const raw=await req.text();const provider=String(req.headers.get("x-provider")||"").toLowerCase();
  const valid=provider==="resend"?await verifyResend(raw,req):provider==="whatsapp"?await verifyMeta(raw,req):false;
  if(!valid)return json({error:"Provider webhook signature invalid or not configured."},401);
  const body=JSON.parse(raw);const admin=sb();const events:any[]=[];
  if(provider==="resend"){
   const eventId=String(req.headers.get("svix-id")||body.id||body.data?.email_id||"");const emailId=String(body.data?.email_id||body.data?.id||"");const status=String(body.type||"").replace("email.","");
   if(emailId){const {data:action}=await admin.from("ai_crm_actions").select("id").eq("provider_message_id",emailId).maybeSingle();if(action)events.push({actionId:action.id,eventType:`provider_${status}`,provider,status,payload:{event_id:eventId,email_id:emailId}});}
  }else{
   for(const entry of body.entry||[])for(const change of entry.changes||[])for(const s of change.value?.statuses||[]){const id=String(s.id||"");const status=String(s.status||"");const {data:action}=await admin.from("ai_crm_actions").select("id").eq("provider_message_id",id).maybeSingle();if(action)events.push({actionId:action.id,eventType:`provider_${status}`,provider,status,payload:{event_id:id}});}
  }
  for(const e of events)await admin.rpc("ai_crm_record_delivery",{p_action_id:e.actionId,p_event_type:e.eventType,p_provider:e.provider,p_status:e.status,p_payload:e.payload});
  return json({ok:true,recorded:events.length});
 }catch(e){return json({error:e instanceof Error?e.message:"Webhook processing failed."},500)}
});
