// Local verification fixture only. Loaded by the isolated Vite test server.
import { supabase as base, SUPABASE_URL } from "./chatMock.js";
export { SUPABASE_URL };
const params = new URLSearchParams(location.search), empty = params.get("data") === "empty";
const role = params.get("role") || "partner", now = Date.now(), date = new Date().toISOString().slice(0,10);
const blob = (id, data) => ({id, data:{id, createdAt:now, ...data}});
const partner = {name:"Alex Morgan", role, status:params.get("gate") || "active",district:"Chennai",state:"Tamil Nadu",zone:"north",apnId:"APN-TN-0007",apn_id:"APN-TN-0007",unlocked:{website:true},username:"alex",mobile:"9000000000",dob:"1990-01-01"};
const rows = {
 apn_users:[blob("ui-user",partner),...(!empty?[blob("maya",{...partner,name:"Maya Patel",role:"partner",status:"active",apn_id:"APN-TN-0042"})]:[])],
 apn_referral_codes:[{id:"code",partner_id:"ui-user",code:"ALEX2026",rename_count:0}],
 apn_leads:empty?[]:[blob("lead-1",{partnerId:"ui-user",clientName:"Northwind Studio — website and brand refresh",business:"Northwind",mobile:"9000000001",service:"website",status:"Submitted",leadId:"APN-L-001",budget:45000})],
 apn_quotations:empty?[]:[blob("quote-1",{partnerId:"ui-user",partnerName:"Alex Morgan",clientName:"Northwind Studio",service:"website",status:"Draft",total:15000,items:[{id:"line-1",label:"Website starter",amount:15000}]})],
 apn_targets:empty?[]:[blob("target-1",{partnerId:"ui-user",title:"Meet your next five clients",metric:"leads",goal:5,acknowledged:false,assignedByName:"AllBee",createdAt:now-86400000})],
 apn_documents:empty?[]:[blob("doc-1",{title:"Your client conversation guide",category:"Sales",notes:"A practical guide to explaining AllBee services.",url:"https://example.test/guide.pdf"})],
 apn_notifications:empty?[]:[blob("notice-1",{title:"Welcome to your next chapter",body:"Your new partner workspace is ready. Start with a lead or explore the learning hub.",level:"General",audience:"all",createdAt:now})],
 apn_training:empty?[]:[blob("training-1",{title:"A great first client conversation",category:"website",description:"Learn how to qualify requirements.",url:"https://example.test/lesson",body:"Ask about the business, scope and delivery timeline."})],
 apn_quizzes:empty?[]:[blob("quiz-1",{title:"Website essentials",category:"website",passPct:60,questions:[{q:"What should you confirm first?",options:["Client requirements","A random price"],answer:0}]})],
 apn_agreements:empty?[]:[{id:"agreement-1",code:"PARTNER",title:"Partner terms",status:"published",version:1,category:"Terms",body:"These are mock terms for interface verification.\nNo real acceptance is recorded.",body_simple:"Review these demonstration terms.",mandatory:false,effective_from:date}],
 apn_withdrawal_wallet_summary:[],
};
window.__apnUX = {failTickets:false, failNetwork:false, slowTickets:false};
export const supabase = {...base,
 from(table) {
  if(!(table in rows))return base.from(table);
  let write=false;const b={};for(const k of ["select","order","eq","neq","in","limit","range","abortSignal","filter","gte","lte","lt","gt","is","or","match","ilike"]) b[k]=()=>b;
  for(const k of ["update","upsert","insert","delete"])b[k]=value=>{write=true;window.__uiMock.writes.push({table,kind:k,value});return b};
  b.single=b.maybeSingle=async()=>({data:rows[table][0]||null,error:null});
  b.then=(yes,no)=>{window.__uiMock.reads.push(table);return Promise.resolve({data:write?null:rows[table],error:null}).then(yes,no)};
  return b;
 },
 async rpc(name,args) {
  if(name==="client_ai_status")return {data:params.get("clientAI")==="enabled",error:null};
  if(name==="apn_support_tickets_list") {
   if(window.__apnUX.slowTickets)await new Promise(r=>setTimeout(r,800));
   return window.__apnUX.failTickets?{data:null,error:{message:"Tickets are temporarily unavailable."}}:{data:empty?[]:[{id:"ticket-1",ticket_no:"APN-1042",category:"general",status:"open",question:"When will my next milestone be reviewed?",admin_response:"Your district head will review it this week.",created_at:new Date().toISOString()}],error:null};
  }
  if(name==="apn_referral_network")return window.__apnUX.failNetwork?{data:null,error:{message:"Network unavailable."}}:{data:empty?[]:[{relationship_id:"rel-1",referred_id:"maya",referred_name:"Maya Patel",referred_apn_id:"APN-TN-0042",status:"active",linked_at:new Date().toISOString(),revenue:15000,earnings:150}],error:null};
  return base.rpc(name,args);
 }
};
