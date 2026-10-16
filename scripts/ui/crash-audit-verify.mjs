import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
const root = resolve(new URL("../..", import.meta.url).pathname);
const out = resolve(root, ".ai/crash-audit-20261016");
mkdirSync(out, { recursive: true });
const server = await createServer({root, server:{host:"127.0.0.1",port:0}, define:{
 "import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),
 "import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")
},plugins:[{name:"isolated-crash-audit",enforce:"pre",resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return resolve(root,"scripts/ui/crashAuditMock.js");}}]});
await server.listen();
const port=server.httpServer.address().port;
const browser=await chromium.launch();
const results=[];
const smoke=process.argv.includes("--smoke");
const widths=smoke?[390]:[320,390,768,1440];
function finish(name,pass,error=""){results.push({name,pass,error});console.log(JSON.stringify(results.at(-1)));}
async function probe(name,{role,route,fault,width},run){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
 const page=await context.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>{const u=new URL(r.request().url());return ["127.0.0.1","localhost"].includes(u.hostname)||["data:","blob:"].includes(u.protocol)?r.continue():r.abort()});
 try {
  await page.goto(`http://127.0.0.1:${port}/?role=${role}&fault=${fault?"malformed":"none"}&case=${Date.now()}#/${route}`,{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForTimeout(1300);
  await run?.(page);
  await page.waitForTimeout(250);
  const state=await page.evaluate(()=>({
    excerpt:document.body.innerText.slice(0,700),
    bad:document.body.innerText.includes("ALLBEE could not render")||document.body.innerText.includes("This page could not load"),
    overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  if(errors.length||state.bad||state.overflow)throw Error(JSON.stringify({errors,...state}));
  finish(name,true);
 } catch(e) {finish(name,false,String(e.message).slice(0,1400));}
 finally {await context.close();}
}
try{
 for(const width of widths){
  await probe(`superadmin AI Center ${width}`,{role:"superadmin",route:"ai-center",width},async(page)=>{
   await page.getByRole("heading",{name:"AI Intelligence Center"}).waitFor();
   for(const tab of ["Lead AI","Partner AI","Employee AI","Finance AI","Observability","AI Delivery","AI Memory","AI Executive","V6 Operations","Automation","Reports","Settings"]) {
    await page.locator(".seg").first().getByRole("button",{name:tab,exact:true}).click();
    await page.waitForTimeout(90);
   }
  });
  await probe(`admin AI Assistant ${width}`,{role:"admin",route:"assistant",width},async(page)=>{
   await page.locator(".assistant-page").first().waitFor();
   const text=page.getByLabel("Message ALLBEE AI");
   if(await text.count()){await text.fill("What is my next step?");await page.getByRole("button",{name:"Send message"}).click();await page.getByText("What is my next step?").waitFor();}
  });
  await probe(`APN AI ${width}`,{role:"partner",route:"apn/ai",width},async(page)=>{
   await page.locator('[data-apn-page="ai"]').waitFor();
  });
  await probe(`client AI ${width}`,{role:"client",route:"client/ai",width},async(page)=>{
   await page.locator(".assistant-page").first().waitFor();
  });
 }
 for(const width of smoke?[390]:[390,1440])await probe(`malformed AI payload ${width}`,{role:"superadmin",route:"ai-center",fault:true,width},async(page)=>{
  await page.getByRole("heading",{name:"AI Intelligence Center"}).waitFor();
  for(const tab of ["Lead AI","Partner AI","Finance AI","Observability","AI Delivery","AI Memory","AI Executive","V6 Operations","Automation"]){
   await page.locator(".seg").first().getByRole("button",{name:tab,exact:true}).click();await page.waitForTimeout(80);
  }
 });
} finally {writeFileSync(resolve(out,"crash-audit-results.json"),JSON.stringify({mocked:true,checkedAt:new Date().toISOString(),results},null,2));await browser.close();await server.close();}
console.log(JSON.stringify({checks:results.length,failures:results.filter(x=>!x.pass)},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
