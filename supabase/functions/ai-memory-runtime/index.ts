import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const embed=async (apiKey:string,input:string|string[])=>{ const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",input})}); if(!r.ok) throw new Error(`Embedding provider returned ${r.status}.`); const d=await r.json(); return d.data.map((x:{embedding:number[]})=>x.embedding); };
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers: cors});
  try{
    const auth=req.headers.get("Authorization")||""; if(!auth) return json({error:"Authentication required."},401);
    const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const admin=createClient(url,service);
    const {data:u,error:ue}=await client.auth.getUser(); if(ue||!u.user) return json({error:"Authentication required."},401);
    const body=await req.json().catch(()=>({})); const mode=String(body.mode||"query"); const key=Deno.env.get("OPENAI_API_KEY"); if(!key) return json({error:"Embedding provider is not configured. Set OPENAI_API_KEY in the Supabase function secrets."},503);
    if(mode==="query"){
      const q=String(body.query||"").trim(); if(!q) return json({rows:[]});
      const [vector]=await embed(key,q); const {data,error}=await client.rpc("ai_memory_hybrid_search",{p_query:q,p_embedding:vector,p_limit:Math.min(Math.max(Number(body.limit||8),1),12)}); if(error) return json({error:error.message},400); return json({rows:data||[],method:"hybrid"});
    }
    if(mode==="index"){
      const {error:syncError}=await client.rpc("ai_memory_sync_knowledge"); if(syncError) return json({error:syncError.message},400); const {error:businessSyncError}=await client.rpc("ai_memory_sync_business"); if(businessSyncError) return json({error:businessSyncError.message},400);
      const {data:docs,error:readError}=await admin.from("ai_memory_documents").select("id,title,content,metadata,content_hash").eq("active",true).is("embedding",null).limit(100);
      if(readError) return json({error:readError.message},500); if(!docs?.length) return json({ok:true,indexed:0,pending:0});
      const vectors=await embed(key,docs.map((d)=>`${d.title}\n${d.content}`)); let indexed=0;
      for(let i=0;i<docs.length;i++){ const {error}=await admin.from("ai_memory_documents").update({embedding:vectors[i]}).eq("id",docs[i].id).eq("content_hash",docs[i].content_hash); if(!error) indexed++; }
      const {count}=await admin.from("ai_memory_documents").select("id",{count:"exact",head:true}).eq("active",true).is("embedding",null); return json({ok:true,indexed,pending:count||0});
    }
    return json({error:"Unsupported memory mode."},400);
  }catch(e){return json({error:e instanceof Error?e.message:"AI memory runtime failed."},500)}
});
