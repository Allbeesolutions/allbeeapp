import { createServer } from "vite";
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { navAllowed } from "../../src/app/permissions.js";
const root=resolve(new URL("../..",import.meta.url).pathname);
const out=process.env.UI_EVIDENCE_DIR||"/tmp/allbee-ui-evidence";
mkdirSync(out,{recursive:true});
const full=process.argv.includes("--full");
const capture=process.argv.includes("--capture");
const interactions=process.argv.includes("--interactions");
const roleList=["superadmin","admin","accountant","staff","intern","client","partner","district_head","state_head","anonymous"];
const nav=[...readFileSync(resolve(root,"src/app/navigation.js"),"utf8").matchAll(/\["([^"]+)",\s*"([^"]+)",\s*\w+,\s*"([^"]+)"\]/g)].map(m=>({route:m[1],label:m[2],tag:m[3]}));
const partnerTabs=["home","leads","wallet","network","chat","learn","targets","quotations","documents","agreements","ai","support","notifications","achievements","leaderboard","profile","withdrawals"];
const cases=[];
for(const role of roleList){
 const base=["partner","district_head","state_head"].includes(role)?"apn/home":"dashboard";
 for(const width of [320,360,375,390,430,768,1024,1366,1440,1920]) cases.push({role,route:base,width});
 if(full){
  const routes=["partner","district_head","state_head"].includes(role)?[...partnerTabs.map(t=>"apn/"+t),...(role==="partner"?[]:["apn/district"])]:["client","anonymous"].includes(role)?[]:nav.filter(n=>navAllowed(n.tag,role,{modules:["projects","inhouse","leads","clients","quotations","invoices","portal-posts","courses","marketing","concepts","testing","sheets","prompts"]})).map(n=>n.route);
  for(const route of routes)for(const width of [320,1440]) if(route!==base)cases.push({role,route,width});
 }
}
const onlyRole=process.argv.find(a=>a.startsWith("--role="))?.slice(7);
const onlyRoute=process.argv.find(a=>a.startsWith("--route="))?.slice(8);
const selected=(interactions?[]:full?cases:cases.filter(c=>c.width===390||c.width===1440)).filter(c=>(!onlyRole||c.role===onlyRole)&&(!onlyRoute||c.route===onlyRoute));
const server=await createServer({root,server:{host:"127.0.0.1",port:5188,strictPort:true},define:{"import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),"import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")},plugins:[{name:"isolated-ui-mock",enforce:"pre",resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return "\0allbee-ui-mock"},load(id){if(id==="\0allbee-ui-mock")return readFileSync(resolve(root,"scripts/ui/mockSupabase.js"),"utf8")}}]});
await server.listen();
const browser=await chromium.launch();
const page=await browser.newPage();
const results=[];let errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/*",route=>{const url=new URL(route.request().url());return ["127.0.0.1","localhost"].includes(url.hostname)||["data:","blob:"].includes(url.protocol)?route.continue():route.abort()});
try{
 if(interactions){ const {verifyInteractions}=await import("./interactions.mjs"); await verifyInteractions(page,out,writeFileSync,resolve); }
 for(const c of selected){
  errors=[];
  await page.setViewportSize({width:c.width,height:c.width<768?844:1000});
  let failure="";
  try{
   await page.goto("http://127.0.0.1:5188/?role="+c.role+"#/"+c.route,{waitUntil:"domcontentloaded",timeout:15000});
   await page.waitForFunction(()=>document.querySelector(".apn-nav-shell,.layout,.lock-card,.topbar")||/could not render|Something went wrong/.test(document.body.innerText),{timeout:12000});
   await page.waitForFunction(()=>!document.querySelector(".prism-wrap,.loading-screen")&&(document.body.innerText.length>100||/could not render|Something went wrong/.test(document.body.innerText)),{timeout:10000});
   await page.waitForTimeout(200);
   await page.locator('[aria-busy="true"]').first().waitFor({state:"hidden",timeout:2500}).catch(()=>{});
  }catch(e){failure=e.message.split("\n")[0]}
  const metrics=await page.evaluate(()=>{
   const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&r.right>0&&r.left<innerWidth};
   const buttons=[...document.querySelectorAll("button")].filter(visible);
   const unnamed=buttons.filter(e=>!(e.innerText.trim()||e.getAttribute("aria-label")||e.getAttribute("title")||e.getAttribute("aria-labelledby"))).map(e=>e.outerHTML.slice(0,200));
   const clipped=[...document.querySelectorAll(".content button,.content input,.content select,.content textarea,.apn-body button")].filter(visible).filter(e=>{const r=e.getBoundingClientRect();if(r.right<=innerWidth+2&&r.left>=-2)return false;for(let p=e.parentElement;p;p=p.parentElement){if(["auto","scroll"].includes(getComputedStyle(p).overflowX))return false;}return true}).map(e=>e.outerHTML.slice(0,160));
   return {bodyExcerpt:document.body.innerText.slice(0,700),overflow:document.documentElement.scrollWidth>innerWidth+1,unnamed,clipped,heading:document.querySelector(".page-head h3,.apn-section-h,.topbar h2")?.textContent||"",crash:/ALLBEE could not render|Something went wrong|is not defined|Cannot read properties/.test(document.body.innerText)};
  });
  const r={...c,...metrics,errors:[...errors],failure};results.push(r);
  writeFileSync(resolve(out,"coverage-progress.json"),JSON.stringify(results));
  if(r.crash||r.failure||r.errors.length)console.log(JSON.stringify({role:c.role,route:c.route,width:c.width,body:metrics.bodyExcerpt,errors}));
  if(metrics.crash)await page.goto("about:blank");
  if(capture&&[390,1440].includes(c.width)&&["superadmin","partner","client","anonymous"].includes(c.role)&&["dashboard","apn/home"].includes(c.route))await page.screenshot({path:resolve(out,c.role+"-"+c.width+".png"),fullPage:false});
 }
 if(!interactions)writeFileSync(resolve(out,onlyRole?"coverage-targeted.json":full?"coverage-full.json":"coverage-baseline.json"),JSON.stringify({mocked:true,cases:results},null,2));
 const failures=results.filter(r=>r.failure||r.errors.length||r.overflow||r.crash||r.clipped.length);
 console.log(JSON.stringify({cases:results.length,failures:failures.map(r=>({role:r.role,route:r.route,width:r.width,failure:r.failure,errors:r.errors,clipped:r.clipped,overflow:r.overflow,crash:r.crash})),unnamed:results.filter(r=>r.unnamed.length).map(r=>({role:r.role,route:r.route,width:r.width,count:r.unnamed.length,examples:r.unnamed.slice(0,2)})),out},null,2));
 if(failures.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
