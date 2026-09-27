import {createServer} from "vite";
import {chromium} from "playwright";
import {resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
const root=resolve(new URL("../..",import.meta.url).pathname),out=resolve(root,".ai/apn-ux-evidence");
mkdirSync(out,{recursive:true});
const routes=["home","leads","wallet","network","chat","targets","quotations","documents","agreements","notifications","learn","withdrawals","ai","support","achievements","leaderboard","district","profile"];
const widths=[320,360,375,390,430,768,1024,1440];
const server=await createServer({root,server:{host:"127.0.0.1",port:5191,strictPort:true},define:{"import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),"import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")},plugins:[{name:"isolated-apn-ux",enforce:"pre",resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return resolve(root,"scripts/ui/apnUXMock.js")}}]});
await server.listen();const browser=await chromium.launch();const page=await browser.newPage();page.setDefaultTimeout(10000);
await page.route("**/*",r=>{const u=new URL(r.request().url());return ["127.0.0.1","localhost"].includes(u.hostname)||["data:","blob:"].includes(u.protocol)?r.continue():r.abort()});
let errors=[];page.on("pageerror",e=>errors.push(e.message));const results=[];
async function check(name,fn){errors=[];try{await fn();assert.deepEqual(errors,[]);results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});await page.screenshot({path:resolve(out,"failure-"+results.length+".png")});}writeFileSync(resolve(out,"progress.json"),JSON.stringify(results));}
let visitIndex=0;
async function visit(route,width,role="partner",data="populated"){
 await page.setViewportSize({width,height:900});
 await page.goto("http://127.0.0.1:5191/?role="+role+"&case="+(++visitIndex)+"&data="+data+"#/apn/"+route,{waitUntil:"domcontentloaded"});
 await page.locator('[data-apn-page="'+route+'"]').waitFor();
 await page.locator(".apn-skeleton").waitFor({state:"hidden"});
 await page.waitForTimeout(90);
}
async function layout(){
 const m=await page.evaluate(()=>{
  const root=document.querySelector("#apn-content");
  const clipped=[...(root?.querySelectorAll("button,input,select,textarea")||[])].filter(el=>{
   const r=el.getBoundingClientRect();if(!r.width||!r.height||r.right<=0||r.left>=innerWidth)return false;
   if(r.left>=-2&&r.right<=innerWidth+2)return false;
   for(let p=el.parentElement;p;p=p.parentElement)if(["auto","scroll"].includes(getComputedStyle(p).overflowX))return false;
   return true;
  }).map(el=>el.outerHTML.slice(0,180));
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,crash:/Something went wrong|could not render|is not defined/.test(document.body.innerText),clipped};
 });
 assert.equal(m.overflow,false,"document overflow");assert.equal(m.crash,false,"render crash");assert.deepEqual(m.clipped,[],"clipped controls");
}
try{
 for(const role of ["partner","district_head","state_head"])for(const route of routes)for(const width of widths){
  if(route==="district"&&role==="partner")continue;
  await check(role+" "+route+" "+width,async()=>{await visit(route,width,role);await layout();
   if(role==="partner"&&[390,1440].includes(width))await page.screenshot({path:resolve(out,route+"-"+width+".png")});
  });
 }
 for(const route of routes.filter(r=>r!=="district"))for(const width of [320,1440])await check("empty "+route+" "+width,async()=>{await visit(route,width,"partner","empty");await layout()});
 await check("mobile drawer: focus, escape, backdrop, navigation",async()=>{
  await visit("home",390);const trigger=page.getByRole("button",{name:"Open menu",exact:true});await trigger.click();
  assert.equal(await page.locator(".apn-main").getAttribute("inert"),"");
  await page.keyboard.press("Escape");assert.equal(await trigger.getAttribute("aria-expanded"),"false");
  assert.ok(await trigger.evaluate(el=>el===document.activeElement));await trigger.click();
  await page.locator(".apn-desktop-sidebar").getByRole("button",{name:"Materials",exact:true}).click();
  await page.locator('[data-apn-page="documents"]').waitFor();await page.reload();await page.locator('[data-apn-page="documents"]').waitFor();
  await page.getByRole("button",{name:"Open menu",exact:true}).click();await page.locator(".apn-drawer-backdrop").click({position:{x:380,y:700}});await layout();
 });
 await check("search, route context and keyboard dismissal",async()=>{
  await visit("home",1440);await page.getByRole("button",{name:"Search",exact:true}).click();
  await page.getByLabel("Search APN records").fill("Northwind");await page.getByRole("dialog").waitFor();await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").count(),0);
 });
 await check("quotation and lead forms on narrow mobile",async()=>{
  await visit("quotations",320);await page.getByRole("button",{name:"New quotation",exact:true}).click();await page.getByRole("dialog").waitFor();
  await page.getByLabel("Client name",{exact:false}).fill("Mobile client");await page.getByLabel("Line description").waitFor();await layout();await page.screenshot({path:resolve(out,"quote-form-320.png")});
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await visit("leads",320);await page.locator(".apn-page-intro").getByRole("button",{name:"Submit a lead"}).click();await page.getByRole("dialog").waitFor();await layout();
  await page.getByRole("button",{name:"Submit lead",exact:true}).click();await page.getByText("Client name is required.",{exact:true}).waitFor();await page.keyboard.press("Escape");
 });
 await check("agreement reader keyboard and full/simple text",async()=>{
  await visit("agreements",390);await page.getByRole("button",{name:"Read",exact:true}).click();await page.getByRole("dialog").waitFor();
  await page.getByRole("button",{name:"Simple English",exact:true}).click();await page.getByText("Review these demonstration terms.",{exact:true}).waitFor();
  await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").count(),0);
 });
 await check("support failed fetch, retry and recovery",async()=>{
  await visit("home",390);await page.evaluate(()=>window.__apnUX.failTickets=true);await page.evaluate(()=>location.hash="#/apn/support");
  await page.getByRole("button",{name:"Try again",exact:true}).waitFor();assert.equal(await page.locator(".apn-skeleton").count(),0);
  await page.evaluate(()=>window.__apnUX.failTickets=false);await page.getByRole("button",{name:"Try again",exact:true}).click();await page.getByText("APN-1042",{exact:true}).waitFor();
 });
 await check("AI failure preserves question for retry",async()=>{
  await visit("ai",390);await page.evaluate(()=>window.__uiMock.apnAIError="Temporarily unavailable");
  await page.getByLabel("Message ALLBEE AI").fill("Explain my earnings");await page.getByRole("button",{name:"Send",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector(".apn-ai-msg.err"));assert.equal(await page.getByLabel("Message ALLBEE AI").inputValue(),"Explain my earnings");
  await page.evaluate(()=>window.__uiMock.apnAIError="");await page.getByRole("button",{name:"Send",exact:true}).click();await page.getByText("Your APN records look normal.",{exact:true}).waitFor();await layout();
 });
 await check("network tabs, detail and retry",async()=>{
  await visit("network",390);await page.getByRole("button",{name:"Referrals",exact:true}).click();
  await page.getByRole("button",{name:"View Maya Patel referral details"}).click();await page.getByRole("dialog").waitFor();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Timeline",exact:true}).click();await page.getByText("No referral activity yet",{exact:true}).waitFor();
  await page.evaluate(()=>window.__apnUX.failNetwork=true);await page.locator(".apn-seg-scroll").first().getByRole("button",{name:"Leaderboard",exact:true}).click();
  await page.getByRole("button",{name:"Monthly",exact:true}).click();await page.getByRole("button",{name:"Try again",exact:true}).waitFor();
  await page.evaluate(()=>window.__apnUX.failNetwork=false);await page.getByRole("button",{name:"Try again",exact:true}).click();await page.getByRole("alert").waitFor({state:"hidden"});
 });
 for(const role of ["district_head","state_head"])await check(role+" command subviews",async()=>{
  await visit("district",320,role);await page.getByRole("button",{name:/Partners \(1\)/}).click();await page.getByLabel("Search partners").fill("Maya");await layout();
  if(role==="state_head"){await page.getByRole("button",{name:/Districts \(/}).click();await layout();}
 });
 for(const gate of ["pending","rejected","suspended","inactive"])await check("account gate "+gate,async()=>{
  await page.setViewportSize({width:320,height:900});await page.goto("http://127.0.0.1:5191/?role=partner&gate="+gate);await page.locator(".gate-card").waitFor();await layout();
 });
 for(const width of [320,390,768,1440])await check("partner login "+width,async()=>{
  await page.setViewportSize({width,height:900});await page.goto("http://127.0.0.1:5191/?role=anonymous");
  await page.getByRole("button",{name:"APN Partner Login",exact:true}).click();await page.getByRole("heading",{name:"Welcome back, partner."}).waitFor();await layout();
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.getByRole("alert").waitFor();
  if([390,1440].includes(width))await page.screenshot({path:resolve(out,"login-"+width+".png")});
 });
 for(const route of routes.filter(r=>r!=="district"))await check("dark reduced motion "+route,async()=>{
  await visit(route,390);await page.evaluate(()=>localStorage.setItem("allbee_theme","dark"));await page.emulateMedia({reducedMotion:"reduce"});await page.reload();await page.locator("[data-apn-page]").waitFor();await page.locator(".apn-skeleton").waitFor({state:"hidden"});await layout();
  if(["home","wallet","profile","ai"].includes(route))await page.screenshot({path:resolve(out,"dark-"+route+".png")});
 });
}finally{
 writeFileSync(resolve(out,"results.json"),JSON.stringify({mocked:true,externalRequestsBlocked:true,checkedAt:new Date().toISOString(),results},null,2));
 console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>!r.pass),out},null,2));await browser.close();await server.close();
 if(results.some(r=>!r.pass))process.exitCode=1;
}
