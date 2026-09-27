// Injected ONLY by the local verification server. No production data or requests.
const params = new URLSearchParams(location.search);
const role = params.get("role") || "superadmin";
const profile = {id:"ui-user",name:"Alex Morgan",email:"alex@example.test",role:["partner","district_head","state_head"].includes(role)?"partner":role,active:true,approved:true,status:"active",mobile:"9000000000",dob:"1990-01-01",perms:{modules:["projects","inhouse","leads","clients","quotations","invoices","portal-posts","courses","marketing","concepts","testing","sheets","prompts"]},tnc_version:0};
const now=new Date().toISOString().slice(0,10), populated=params.get("data")!=="empty";
const blob = (id,data)=>({id,data:{id,createdAt:Date.now(),...data}});
const rows={
 profiles:[profile],app_config:[{key:"ai",value:JSON.stringify({enabled:true})}],
 apn_users:[blob(profile.id,{name:profile.name,role,status:"active",district:"Chennai",state:"Tamil Nadu",zone:"north",apn_id:"APN-TN-0007"})],
 planned:populated?[blob("rent",{title:"Office rent",amount:2000,category:"Rent",recurrence:"Monthly",status:"Approved"})]:[],
 transactions:populated?[blob("income",{kind:"income",amount:3000,date:now,client:"Northwind Studio",project:"Website launch",category:"Project",hajiPct:50,alimPct:50})]:[],
 tasks:populated?[blob("task",{title:"Review the client website handoff",status:"Pending",priority:"High",assignedTo:profile.name,assignee:profile.name,createdBy:profile.name,dueDate:now,description:"Review the design and launch checklist."})]:[],
 clients:populated?[blob("client",{name:"Northwind Studio",company:"Northwind Studio",email:"client@example.test",phone:"9000000001",ownerId:profile.id})]:[],
 projects:populated?[blob("project",{name:"Website launch",client:"Northwind Studio",status:"In progress",budget:3000})]:[],
 portal_posts:populated?[blob("post",{clientId:profile.id,title:"Your website is ready for review",body:"Review the content and share your feedback.",status:"Review"})]:[]
};
window.__uiMock={reads:[],writes:[],rpcs:[],failAI:false};
const result=data=>Promise.resolve({data,error:null});
const from=table=>{
 let write=false; const b={};
 for(const key of ["select","order","eq","neq","in","limit","range","abortSignal","filter","gte","lte","lt","gt","is","or","match","ilike"]) b[key]=()=>b;
 for(const key of ["update","upsert","insert","delete"]) b[key]=value=>{write=true;window.__uiMock.writes.push({table,kind:key,value});return b};
 b.maybeSingle=b.single=()=>result((rows[table]||[])[0]||null);
 b.then=(yes,no)=>{window.__uiMock.reads.push(table);return result(write?null:rows[table]||[]).then(yes,no)};
 return b;
};
export const SUPABASE_URL="https://ui-test.invalid";
export const supabase={
 from,channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),removeChannel:()=>result(null),
 auth:{getSession:()=>result({session:role==="anonymous"?null:{user:{id:profile.id,email:profile.email,user_metadata:{name:profile.name}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),refreshSession:()=>result({}),signOut:()=>result({}),signInWithPassword:()=>result({}),updateUser:()=>result({})},
 rpc:async(name,args)=>{
  window.__uiMock.rpcs.push({name,args});
  if(name==="apn_agreement_status")return {data:{required:false,requiredList:[],requiredCount:0},error:null};
  if(name==="ai_get_dashboard")return {data:{health:{},lead_scores:[],partner_scores:[],employee_scores:[],forecasts:[],insights:[],recommendations:[],settings:{}},error:null};
  if(name==="knowledge_get_pricing")return {data:{base:15000,baseLabel:"Website starter",options:[],lineItems:[{label:"Website starter",amount:15000,isBase:true}],deliveryMin:10,deliveryMax:15,features:[],limits:[],paymentTerms:{description:"50% advance, 50% on delivery."}},error:null};
  if(name==="business_automation_history")return {data:[],error:null};
  if(name==="business_automation_simulate")return {data:{matched:true,simulation:true},error:null};
  if(["business_automation_upsert_rule","business_automation_delete_rule","business_automation_dlq_recover","business_automation_approve","business_automation_reject"].includes(name))return {data:{ok:true},error:null};
  if(["finance_v5_dashboard","crm_v5_dashboard","apn_partner_financial_snapshot"].includes(name))return {data:null,error:null};
  if(name.includes("available"))return {data:true,error:null};
  return {data:[],error:null};
 },
 functions:{invoke:async(name)=>{
  if(name.includes("ai-chat")&&window.__uiMock.failAI)return {data:null,error:{message:"Gateway request failed (503)"}};
  if(name.includes("ai-chat"))return {data:{text:"Here is your checklist:\n1. Review the client requirements.\n2. Confirm pricing before sending the proposal."},error:null};
  if(name==="founder-lockdown")return {data:{locked:false},error:null};
  return {data:{rows:[]},error:null};
 }},
 storage:{from:()=>({upload:()=>result({path:"mock"}),remove:()=>result({}),getPublicUrl:()=>({data:{publicUrl:""}})})}
};
