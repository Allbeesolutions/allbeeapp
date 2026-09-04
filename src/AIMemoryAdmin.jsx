import React,{useCallback,useEffect,useState} from "react";
import {supabase} from "./supabaseClient";
import {Trash2,CheckCircle2,RefreshCw,Search,ShieldAlert} from "./icons.jsx";
export default function AIMemoryAdmin({fmtDateTime,emitToast}){
 const [rows,setRows]=useState([]),[health,setHealth]=useState({}),[q,setQ]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{setBusy(true);setError("");try{const [r,h]=await Promise.all([supabase.rpc("ai_memory_admin_explorer",{p_query:q||null,p_limit:100}),supabase.rpc("ai_memory_health")]);if(r.error)throw new Error(r.error.message);if(h.error)throw new Error(h.error.message);setRows(r.data||[]);setHealth(h.data||{});}catch(e){setError(e.message);}finally{setBusy(false);}},[q]);
 useEffect(()=>{load();},[load]);
 const resolve=async(id,resolution)=>{setBusy(true);try{const {error:e}=await supabase.rpc("ai_memory_resolve_conflict",{p_id:id,p_resolution:resolution});if(e)throw new Error(e.message);emitToast?.(resolution==="archive"?"Memory archived.":"Memory conflict resolved.","success");await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="cards-grid" style={{gridTemplateColumns:"1fr"}}>{error&&<div className="auth-msg err">{error}</div>}
  <div className="cards-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))"}}>
   <div className="card stat"><div className="lbl">Total memory</div><div className="num mono">{health.total||0}</div></div><div className="card stat"><div className="lbl"><CheckCircle2 size={14}/>Embedded</div><div className="num mono">{health.embedded||0}</div></div><div className="card stat"><div className="lbl">Pending embeddings</div><div className="num mono">{health.pending||0}</div></div><div className="card stat"><div className="lbl"><ShieldAlert size={14}/>Conflicts</div><div className="num mono">{health.conflicts||0}</div></div>
  </div>
  <div className="card"><div className="item-row"><div className="search-wrap"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search memory explorer…"/></div><button className="btn sm" onClick={load} disabled={busy}><RefreshCw size={13}/>Refresh</button></div>
   {rows.map(r=><div className="item-row" key={r.id}><div className="item-main"><div className="item-title">{r.title||"Untitled"} <span className={`badge ${r.embedded?"pos":"accent"}`}>{r.embedded?"embedded":"pending"}</span>{r.conflict_state!=="clean"&&<span className="badge neg">{r.conflict_state}</span>}</div><div className="item-meta">{r.source_type} · v{r.version_no} · updated {fmtDateTime(r.updated_at)} · {String(r.content_hash).slice(0,10)}</div></div><div className="row-actions">{r.conflict_state!=="clean"&&r.active&&<button className="btn sm" disabled={busy} onClick={()=>resolve(r.id,"accept")}>Resolve</button>}{r.active&&<button className="btn sm" disabled={busy} onClick={()=>resolve(r.id,"archive")}><Trash2 size={13}/>Archive</button>}</div></div>)}
   {!rows.length&&<div className="hint-line">No memory documents match the current filter.</div>}
  </div>
 </div>;
}
