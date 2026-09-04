import { supabase } from "./supabaseClient";
const b64ToBytes=(base64)=>Uint8Array.from(atob(base64.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
export async function enableAllBeePush(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('This browser does not support Web Push.');
 const key=import.meta.env.VITE_VAPID_PUBLIC_KEY;if(!key)throw new Error('Web Push is not configured: VITE_VAPID_PUBLIC_KEY is missing.');
 const reg=await navigator.serviceWorker.register('/sw.js');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Browser notification permission was not granted.');
 let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(key)});
 const {error}=await supabase.rpc('notification_push_save',{p_subscription:sub.toJSON()});if(error)throw error;return sub;
}
export async function disableAllBeePush(){const reg=await navigator.serviceWorker.getRegistration('/sw.js');const sub=await reg?.pushManager.getSubscription();if(!sub)return;await supabase.rpc('notification_push_remove',{p_endpoint:sub.endpoint});await sub.unsubscribe();}
