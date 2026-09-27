import {createServer} from "vite";
import {chromium} from "playwright";
import {resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
const root=resolve(new URL("../..",import.meta.url).pathname);
const out=resolve(root,".ai/chat-evidence");mkdirSync(out,{recursive:true});
const server=await createServer({root,server:{host:"127.0.0.1",port:5189,strictPort:true},define:{"import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),"import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")},plugins:[{name:"isolated-chat-fixture",enforce:"pre",resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return resolve(root,"scripts/ui/chatMock.js")}}]});
await server.listen();const browser=await chromium.launch();const page=await browser.newPage();page.setDefaultTimeout(10000);
await page.route("**/*",route=>{const url=new URL(route.request().url());return ["127.0.0.1","localhost"].includes(url.hostname)||["data:","blob:"].includes(url.protocol)?route.continue():route.abort()});
const results=[];let errors=[];page.on("pageerror",e=>errors.push(e.message));
async function record(name,fn){errors=[];try{await fn();assert.equal(errors.length,0,errors.join("\n"));results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message});await page.screenshot({path:resolve(out,"failure-"+results.length+".png")});}}
async function layout(){const m=await page.evaluate(()=>{
 const composer=document.querySelector(".apn-tc-compose"),r=composer?.getBoundingClientRect(),nav=document.querySelector(".apn-bottomnav")?.getBoundingClientRect();
 return {bottomLimit:nav?.height ? nav.top : innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,composer:r?{left:r.left,right:r.right,bottom:r.bottom}:null,crash:/Something went wrong|could not render/.test(document.body.innerText)};
 });assert.equal(m.overflow,false,"Document overflow");assert.equal(m.crash,false,"Render crash");
 if(m.composer){assert.ok(m.composer.left>=-1&&m.composer.right<=await page.evaluate(()=>innerWidth)+1,"Composer clipped");assert.ok(m.composer.bottom<=m.bottomLimit+1,"Composer beneath mobile navigation or viewport");}
}
try{
 for(const role of ["partner","district_head","state_head"])for(const width of [320,360,375,390,430,768,1024,1366,1440,1920]){
  await record(role+" "+width+"px inbox and thread",async()=>{
   await page.setViewportSize({width,height:900});
   await page.goto("http://127.0.0.1:5189/?role="+role+"&viewport="+width+"#/apn/chat");
   await page.locator(".apn-tc-recent-row").first().waitFor();await layout();
   if(role==="partner"&&[390,1440].includes(width))await page.screenshot({path:resolve(out,"inbox-"+width+".png")});
   await page.locator(".apn-tc-recent-row").first().click();
   await page.getByLabel("Message",{exact:true}).waitFor();await page.getByText("Perfect. Let’s share the proposal today.",{exact:true}).last().waitFor();
   await layout();
   if(role==="partner"&&[390,1440].includes(width))await page.screenshot({path:resolve(out,"conversation-"+width+".png")});
   await page.getByRole("button",{name:"Back to chats",exact:true}).click();
   await page.getByLabel("Search chats or people").fill("Project team 12");
   assert.equal(await page.locator(".apn-tc-recent-row").count(),1);
  });
 }
 await record("Unread, reply, search, failed send, retry and group rooms",async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://127.0.0.1:5189/?role=state_head&case=interaction#/apn/chat");
  await page.locator(".apn-tc-recent-row").first().waitFor();
  await page.getByRole("button",{name:"Unread",exact:true}).click();
  assert.equal(await page.locator(".apn-tc-recent-row").count(),1);
  await page.locator(".apn-tc-recent-row").first().click();
  await page.getByRole("button",{name:"Actions for message from Maya Patel"}).last().click();
  await page.getByRole("button",{name:"Reply",exact:true}).click();
  await page.getByLabel("Message",{exact:true}).fill("Thanks, Maya!");
  await page.evaluate(()=>window.__chatMock.failSend=true);
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await page.locator(".tc-thread-error").waitFor();
  assert.equal(await page.getByLabel("Message",{exact:true}).inputValue(),"Thanks, Maya!");
  await page.evaluate(()=>window.__chatMock.failSend=false);
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await page.getByText("Thanks, Maya!",{exact:true}).waitFor();
  const sends=await page.evaluate(()=>window.__uiMock.rpcs.filter(r=>r.name==="apn_send_message_v3"));
  assert.equal(sends.length,2);assert.equal(sends[1].args.p_reply_to_id,"msg-21");
  await page.getByRole("button",{name:"Search this conversation"}).click();
  await page.getByLabel("Search messages",{exact:true}).fill("Thanks, Maya!");
  await page.waitForFunction(()=>document.querySelectorAll(".apn-tc-msg").length===1);
  await page.getByRole("button",{name:"District",exact:true}).click();
  await page.getByText("Chennai district",{exact:true}).waitFor();await layout();
  await page.getByRole("button",{name:"State",exact:true}).click();
  await page.getByText("Tamil Nadu state",{exact:true}).waitFor();await layout();
 });
 for(const width of [390,1440])await record("Dark and reduced motion "+width+"px",async()=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>localStorage.setItem("allbee_theme","dark"));await page.reload();
  await page.locator(".apn-tc-recent-row").first().waitFor();await page.locator(".apn-tc-recent-row").first().click();
  await page.getByLabel("Message",{exact:true}).waitFor();await layout();
  await page.screenshot({path:resolve(out,"dark-"+width+".png")});
 });
 writeFileSync(resolve(out,"results.json"),JSON.stringify({mocked:true,checkedAt:new Date().toISOString(),results},null,2));
 console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>!r.pass),out},null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();await server.close();}
