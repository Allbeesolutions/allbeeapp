import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool } from "jsr:@db/postgres@^0";
import webpush from "npm:web-push@3.6.7";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const pool=new Pool(Deno.env.get("SUPABASE_DB_URL")!,1,true);
async function workerSecret(){const c=await pool.connect();try{const r=await c.queryObject<{decrypted_secret:string}>`select decrypted_secret from vault.decrypted_secrets where name='allbee_notification_push_worker_secret' limit 1`;return r.rows[0]?.decrypted_secret||"";}finally{c.release();}}

// Push delivery is deliberately batched. A worker run can claim many
// notifications and each notification can target many subscriptions; sending
// every message serially made delivery latency grow linearly with audience size.
type PushSub={id:string;user_id:string;subscription:Record<string,unknown>};
type Profile={id:string;role:string;active:boolean;status:string|null};
type Pref={user_id:string;enabled:boolean;urgent_enabled:boolean;important_enabled:boolean;general_enabled:boolean};
const DELIVERY_CONCURRENCY=10;
async function inBatches<T>(items:T[],size:number,fn:(item:T)=>Promise<void>){for(let i=0;i<items.length;i+=size)await Promise.allSettled(items.slice(i,i+size).map(fn));}

Deno.serve(async(req)=>{try{
 const workerKey=req.headers.get("x-notification-push-worker-key")||"";if(!workerKey||workerKey!==(await workerSecret()))return json({error:"Worker authentication required."},401);
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(url,key);const vapidPrivate=Deno.env.get("VAPID_PRIVATE_KEY")||"",vapidPublic=Deno.env.get("VAPID_PUBLIC_KEY")||"";
 if(!vapidPrivate||!vapidPublic)return json({error:"VAPID provider keys are not configured."},503);webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")||"mailto:admin@allbeesolutions.com",vapidPublic,vapidPrivate);
 const {data:claims,error:ce}=await admin.rpc("notification_push_claim",{p_limit:50});if(ce)throw ce;
 const {data:subsRaw,error:se}=await admin.from("notification_push_subscriptions").select("id,user_id,subscription");if(se)throw se;const subs=(subsRaw||[]) as PushSub[];
 const userIds=[...new Set((subs||[]).map(s=>s.user_id))];
 const [{data:profiles,error:pe},{data:prefs,error:pre}]=await Promise.all([
  userIds.length?admin.from("profiles").select("id,role,active,status").in("id",userIds):Promise.resolve({data:[] as Profile[],error:null}),
  userIds.length?admin.from("notification_preferences").select("user_id,enabled,urgent_enabled,important_enabled,general_enabled").in("user_id",userIds):Promise.resolve({data:[] as Pref[],error:null})
 ]);if(pe)throw pe;if(pre)throw pre;
 const profileMap=new Map(((profiles||[]) as Profile[]).map((p)=>[p.id,p]));const prefMap=new Map(((prefs||[]) as Pref[]).map((p)=>[p.user_id,p]));
 const eligible=(item:any)=>{const aud=String(item.data?.audience||"all"),level=String(item.data?.level||item.data?.priority||"General");return (subs||[]).filter(s=>{const p=profileMap.get(s.user_id);if(!p?.active||String(p.status||"").toLowerCase()!=="active")return false;let match=aud==="all";if(aud.startsWith("user:"))match=s.user_id===aud.slice(5);else if(["staff","intern","accountant","admin","partner","district_head","state_head"].includes(aud))match=p.role===aud;if(!match)return false;const pref=prefMap.get(s.user_id);if(pref&&!pref.enabled)return false;if(pref&&level==="Urgent"&&!pref.urgent_enabled)return false;if(pref&&level==="Important"&&!pref.important_enabled)return false;if(pref&&level!=="Urgent"&&level!=="Important"&&!pref.general_enabled)return false;return true;});};
 let sent=0,failed=0,skipped=0;
 for(const item of claims||[]){let itemFailed=false;const users=eligible(item);if(!users.length)skipped++;
  await inBatches(users,DELIVERY_CONCURRENCY,async(s)=>{try{const info=await webpush.sendNotification(s.subscription,JSON.stringify({title:item.data?.title||"ALLBEE",body:item.data?.body||item.data?.message||"",tag:item.data?.group_key||item.data?.groupKey||item.notification_id,deep_link:item.data?.deep_link||null}));await admin.from("notification_delivery_audit").insert({notification_id:item.notification_id,user_id:s.user_id,channel:"push",status:"delivered",provider_message_id:info.headers?.['x-message-id']||null,attempted_at:new Date().toISOString(),delivered_at:new Date().toISOString()});sent++;}catch(e){itemFailed=true;failed++;const statusCode=(e as any)?.statusCode;if(statusCode===404||statusCode===410)await admin.from("notification_push_subscriptions").delete().eq("id",s.id);await admin.from("notification_delivery_audit").insert({notification_id:item.notification_id,user_id:s.user_id,channel:"push",status:"failed",error_message:String(e).slice(0,1000),attempted_at:new Date().toISOString()});}});
  await admin.rpc("notification_push_result",{p_id:item.id,p_status:itemFailed?"failed":"sent",p_error:itemFailed?"One or more push recipients failed.":null});
 }
 return json({ok:true,claimed:(claims||[]).length,sent,failed,skipped,subscription_scan_count:subs?.length||0,delivery_concurrency:DELIVERY_CONCURRENCY});
}catch(e){return json({error:e instanceof Error?e.message:"Push worker failed."},500)}});
