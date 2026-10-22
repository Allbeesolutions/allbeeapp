import React,{useEffect,useState} from "react";
import {supabase} from "./supabaseClient";
const LazyCustomerUsageAnalytics = React.lazy(() => import("./CustomerUsageAnalytics.jsx"));
import {RefreshCw,ShieldAlert,Activity,Search,Wallet,Users,Bell,MessageCircle} from "./icons.jsx";
export default function PlatformV6Operations({money}){
 const [d,setD]=useState(null),[tab,setTab]=useState("automation"),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setErr("");try{const {data,error}=await supabase.rpc("platform_v6_ops_snapshot");if(error)throw error;setD(data||{});}catch(e){setErr(e.message||"Unable to load operations snapshot.");}finally{setBusy(false);}};
 useEffect(()=>{load();},[]);
 const cards={automation:[["Rules",d?.automation?.rules], ["Queued",d?.automation?.queued],["Failed",d?.automation?.failed],["DLQ",d?.automation?.dlq]],notifications:[["Notifications",d?.notifications?.total],["Delivery events",d?.notifications?.delivery_events]],chat:[["Messages",d?.chat?.messages]],search:[["History",d?.search?.history],["Saved",d?.search?.saved],["Analytics",d?.search?.analytics]],apn:[["Partners",d?.apn?.partners],["Wallet entries",d?.apn?.wallet_entries],["Withdrawals",d?.apn?.withdrawals]],finance:[["Transactions",d?.finance?.transactions],["Income",money?.(d?.finance?.income)],["Expenses",money?.(d?.finance?.expenses)]],security:[["Active sessions",d?.security?.sessions],["Sensitive events",d?.security?.sensitive_events],["Permission rows",d?.security?.permission_rows]]};
 const meta={automation:[Activity,"Automation", "Event/retry/DLQ operational state"],notifications:[Bell,"Notifications","Delivery and grouping readiness"],chat:[MessageCircle,"Team Chat","Realtime message activity"],search:[Search,"Global Search","History, saved searches and analytics"],apn:[Users,"APN Network","Partner and wallet operational state"],finance:[Wallet,"Finance","Live transaction totals"],security:[ShieldAlert,"Security","Sessions, permissions and sensitive events"],usage:[Activity,"Customer activity","Opted-in customer screen visits and usage trends"]};

 return <div className="cards-grid" style={{gridTemplateColumns:"1fr",alignItems:"start"}}>{err&&<div className="auth-msg err">{err}</div>}
  <div className="seg" style={{overflowX:"auto"}}>{Object.keys(meta).map(k=>{const I=meta[k][0];return <button key={k} className={tab===k?"on":""} onClick={()=>setTab(k)}><I size={13}/> {meta[k][1]}</button>})}</div>
  {tab === "usage" ? <React.Suspense fallback={<div role="status" className="card">Loading customer activity…</div>}><LazyCustomerUsageAnalytics /></React.Suspense> : <div className="card"><div className="item-row"><div className="item-main"><div className="item-title">{meta[tab][1]} operations</div><div className="item-meta">{meta[tab][2]}. This view is backed by protected admin RPCs and current production records.</div></div><button className="btn sm" onClick={load} disabled={busy}><RefreshCw size={13}/>Refresh</button></div>
   {!d ? <p role="status" className="hint-line">{busy ? "Loading operations snapshot…" : "Operations snapshot unavailable. The customer activity tab can still be viewed separately."}</p> :
   <div className="ai-health-grid">{(cards[tab]||[]).map(([label,value])=><div className="card stat" key={label}><div className="lbl">{label}</div><div className="num mono">{value??0}</div></div>)}</div>}
  </div>}
 </div>;
}
