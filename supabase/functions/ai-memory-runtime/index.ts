import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool } from "jsr:@db/postgres@^0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ai-memory-worker-key"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const embed=async(apiKey:string,input:string|string[])=>{const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",input})});if(!r.ok)throw new Error(`Embedding provider returned ${r.status}.`);const d=await r.json();return d.data.map((x:{embedding:number[]})=>x.embedding);};
const pool=new Pool(Deno.env.get("SUPABASE_DB_URL")!,1,true);
async function workerSecret(){const c=await pool.connect();try{const r=await c.queryObject<{decrypted_secret:string}>`select decrypted_secret from vault.decrypted_secrets where name='allbee_ai_memory_worker_secret' limit 1`;return r.rows[0]?.decrypted_secret||"";}finally{c.release();}}
async function workerTick(admin:any,key:string){
 const sync1=await admin.rpc("ai_memory_sync_knowledge");if(sync1.error)throw new Error(sync1.error.message);
 const sync2=await admin.rpc("ai_memory_sync_business");if(sync2.error)throw new Error(sync2.error.message);
 const {data:claimed,error}=await admin.rpc("ai_memory_worker_claim",{p_limit:100});if(error)throw new Error(error.message);
 let indexed=0,failed=0;
 for(const q of claimed||[]){try{const {data:docs,error:e}=await admin.from("ai_memory_documents").select("id,title,content,content_hash").eq("source_type",q.source_type).eq("source_id",q.source_id).eq("active",true).limit(1);if(e)throw new Error(e.message);if(!docs?.length){await admin.rpc("ai_memory_worker_complete",{p_id:q.id,p_error:null});continue;}
  const [vector]=await embed(key,`${docs[0].title}\n${docs[0].content}`);const {error:u}=await admin.from("ai_memory_documents").update({embedding:vector}).eq("id",docs[0].id).eq("content_hash",docs[0].content_hash);if(u)throw new Error(u.message);const done=await admin.rpc("ai_memory_worker_complete",{p_id:q.id,p_error:null});if(done.error)throw new Error(done.error.message);indexed++;
 }catch(e){failed++;await admin.rpc("ai_memory_worker_complete",{p_id:q.id,p_error:e instanceof Error?e.message:String(e)});}}
 const {count}=await admin.from("ai_memory_documents").select("id",{count:"exact",head:true}).eq("active",true).is("embedding",null);
 return {ok:failed===0,indexed,pending:count||0,claimed:(claimed||[]).length,failed};
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";const workerKey=req.headers.get("x-ai-memory-worker-key")||"";const secret=await workerSecret();
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);let client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const isWorker=Boolean(workerKey&&secret&&workerKey===secret);if(isWorker)client=admin;
  else {if(!auth)return json({error:"Authentication required."},401);const {data:u,error:ue}=await client.auth.getUser();if(ue||!u.user)return json({error:"Authentication required."},401);}
  const body=await req.json().catch(()=>({}));const mode=String(body.mode||"query");
  if(mode==="index" && !isWorker) return json({error:"Worker authorization required for indexing."},403);
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)return json({error:"Embedding provider is not configured. Set OPENAI_API_KEY in the Supabase function secrets."},503);
  if(mode==="index") {
    if(!isWorker)return json({error:"Memory indexing is restricted to the background worker."},403);
    return json(await workerTick(admin,key));
  }
  if(mode==="query"){const q=String(body.query||"").trim();if(!q)return json({rows:[]});const [vector]=await embed(key,q);const {data,error}=await client.rpc("ai_memory_hybrid_search",{p_query:q,p_embedding:vector,p_limit:Math.min(Math.max(Number(body.limit||8),1),12)});if(error)return json({error:error.message},400);return json({rows:data||[],method:"hybrid"});}
  return json({error:"Unsupported memory mode."},400);
 }catch(e){return json({error:e instanceof Error?e.message:"AI memory runtime failed."},500)}
});
