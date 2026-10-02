import {createServer} from "vite";
import {chromium} from "playwright";
import {resolve} from "node:path";
import {mkdirSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
const root=resolve(new URL("../..",import.meta.url).pathname),out=resolve(root,".ai/chat-repair-evidence");
mkdirSync(out,{recursive:true});
const server=await createServer({root,server:{host:"127.0.0.1",port:5193,strictPort:true},define:{"import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),"import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")},plugins:[{name:"isolated-chat-repair-fixture",enforce:"pre",resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return resolve(root,"scripts/ui/chatRepairMock.js")}}]});
await server.listen();const browser=await chromium.launch(),page=await browser.newPage();page.setDefaultTimeout(6000);
await page.route("**/*",route=>{const u=new URL(route.request().url());return ["127.0.0.1","localhost"].includes(u.hostname)||["data:","blob:"].includes(u.protocol)?route.continue():route.abort()});
const results=[];let errors=[];page.on("pageerror",e=>errors.push(e.message));
function save(){writeFileSync(resolve(out,"results.json"),JSON.stringify({mocked:true,checkedAt:new Date().toISOString(),results},null,2));}
async function record(name,fn){errors=[];try{await fn();assert.deepEqual(errors,[]);results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message});await page.screenshot({path:resolve(out,"failure-"+results.length+".png")});}save();console.log(JSON.stringify(results.at(-1)));}
async function layout(){
 const m=await page.evaluate(()=>{
 const composer=document.querySelector(".apn-tc-compose"),r=composer?.getBoundingClientRect(),nav=document.querySelector(".apn-bottomnav")?.getBoundingClientRect();
 return {overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,height:innerHeight,limit:nav?.height?nav.top:innerHeight,composer:r?{left:r.left,right:r.right,bottom:r.bottom}:null,crash:/Something went wrong|could not render/.test(document.body.innerText),mascot:!!document.querySelector(".allbee-assistant-launcher")};
 });
 assert.equal(m.overflow,false,"Horizontal overflow");assert.equal(m.crash,false,"Render crash");
 if(m.composer){assert.ok(m.composer.left>=-1&&m.composer.right<=m.width+1,"Composer clipped horizontally");assert.ok(m.composer.bottom<=m.limit+1,"Composer below navigation/viewport");}
}
async function admin(width,theme="light"){
 await page.setViewportSize({width,height:900});
 await page.goto("http://127.0.0.1:5193/?role=superadmin&case="+Date.now()+"#/chat");
 await page.evaluate(t=>localStorage.setItem("allbee_theme",t),theme);await page.reload();
 await page.getByRole("button",{name:"Client",exact:true}).click();await page.locator(".client-chat-list .apn-tc-recent-row").first().waitFor();
}
try{
 for(const theme of ["light","dark"])for(const width of [320,390,768,1440])await record("Admin client "+theme+" "+width+"px inbox, conversation, profile and photo",async()=>{
  await admin(width,theme);await layout();await page.screenshot({path:resolve(out,"admin-inbox-"+theme+"-"+width+".png")});
  await page.locator(".client-chat-list .apn-tc-recent-row").first().click();await page.getByText("Perfect. Let’s share the proposal today.",{exact:true}).last().waitFor();await layout();
  const mine=await page.locator(".shared-chat-message.is-mine").last().boundingBox(),theirs=await page.locator(".shared-chat-message.is-theirs").last().boundingBox(),area=await page.locator(".apn-tc-messages").boundingBox();
  assert.ok(mine.x+mine.width>area.x+area.width*.8,"Outgoing bubble is not right-aligned");assert.ok(theirs.x<area.x+area.width*.3,"Incoming bubble is not left-aligned");
  assert.equal(await page.getByText("Old Client Name",{exact:true}).count(),0);
  await page.screenshot({path:resolve(out,"admin-thread-"+theme+"-"+width+".png")});
  await page.getByRole("button",{name:"View Northwind Studio profile"}).first().click();await page.getByRole("dialog",{name:"Northwind Studio profile"}).waitFor();await layout();
  await page.screenshot({path:resolve(out,"admin-profile-"+theme+"-"+width+".png")});assert.equal(await page.getByText("A design studio building thoughtful digital experiences.",{exact:true}).count(),1);
  await page.getByRole("button",{name:"View Northwind Studio photo"}).click();await page.getByRole("dialog",{name:"Northwind Studio photo"}).waitFor();await page.screenshot({path:resolve(out,"admin-photo-"+theme+"-"+width+".png")});
  await page.keyboard.press("Escape");await page.keyboard.press("Escape");assert.equal(await page.getByRole("dialog").count(),0);
  if(width<=760){await page.getByRole("button",{name:"Back to client chats"}).click();assert.ok(await page.getByLabel("Search client chats").isVisible());}
 });
 await record("Admin search, unread, failed-send retry, duplicate submit, reaction, realtime and scroll",async()=>{
  await admin(390);await page.getByLabel("Search client chats").fill("Jordan");assert.equal(await page.locator(".client-chat-list .apn-tc-recent-row").count(),1);
  await page.getByLabel("Search client chats").fill("");await page.getByRole("button",{name:"Unread",exact:true}).click();assert.equal(await page.locator(".client-chat-list .apn-tc-recent-row").count(),1);
  await page.locator(".client-chat-list .apn-tc-recent-row").first().click();await page.getByLabel("Message",{exact:true}).waitFor();
  await page.evaluate(()=>window.__chatRepair.failSend=true);await page.getByLabel("Message",{exact:true}).fill("Please send the proposal.");await page.getByRole("button",{name:"Send",exact:true}).click();await page.waitForFunction(()=>window.__uiMock.rpcs.some(r=>r.name==="apn_send_message_v3"));await page.waitForTimeout(250);
  await page.getByRole("alert").filter({hasText:"Message could not be sent. Your draft is saved."}).waitFor();assert.equal(await page.getByLabel("Message",{exact:true}).inputValue(),"Please send the proposal.");
  await page.evaluate(()=>window.__chatRepair.failSend=false);await page.getByLabel("Message",{exact:true}).press("Enter");await page.getByLabel("Message",{exact:true}).press("Enter");await page.getByText("Please send the proposal.",{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__uiMock.rpcs.filter(r=>r.name==="apn_send_message_v3").length),2);
  await page.locator(".shared-chat-message").last().getByRole("button",{name:"React to message"}).click();await page.getByRole("button",{name:"React 🎉",exact:true}).click();await page.getByRole("button",{name:"🎉: 1 reactions"}).waitFor();
  await page.evaluate(()=>{const el=document.querySelector(".apn-tc-messages");el.scrollTop=0;el.dispatchEvent(new Event("scroll"));window.__chatRepair.messages.push({id:"remote-1",sender_id:"client-a",body:"Realtime update",created_at:new Date().toISOString()});window.__chatRepair.emit()});
  await page.getByText("Realtime update",{exact:true}).waitFor();assert.equal(await page.locator(".apn-tc-messages").evaluate(el=>el.scrollTop),0);
  await page.getByRole("button",{name:"New messages"}).click();assert.ok(await page.locator(".apn-tc-messages").evaluate(el=>el.scrollTop>0));await layout();
 });
 for(const width of [320,390,768,1440])await record("Client support "+width+"px thread, identity and back",async()=>{
  await page.setViewportSize({width,height:900});await page.goto("http://127.0.0.1:5193/?role=client&case="+Date.now()+"#/client/chat");await page.locator(".client-support-list button").first().click();
  await page.getByLabel("Message",{exact:true}).waitFor();await page.getByText("Perfect. Let’s share the proposal today.",{exact:true}).waitFor();await layout();await page.screenshot({path:resolve(out,"client-support-"+width+".png")});
  await page.getByRole("button",{name:"View Haji profile"}).first().click();await page.getByText("Here to help the ALLBEE team.",{exact:true}).waitFor();await page.keyboard.press("Escape");await page.getByRole("button",{name:"Back to support contacts"}).click();await page.locator(".client-support-list button").first().waitFor();
 });
 for(const width of [320,390,768,1440])await record("Admin APN "+width+"px canonical participant and layout",async()=>{
  await page.setViewportSize({width,height:900});await page.goto("http://127.0.0.1:5193/?role=superadmin&case="+Date.now()+"#/chat");await page.getByRole("button",{name:"APN",exact:true}).click();
  await page.locator(".apn-tc-recent-row").first().waitFor();assert.equal(await page.locator(".apn-tc-recent-row b").first().innerText(),"Maya Patel");
  await page.locator(".apn-tc-recent-row").first().click();await page.getByLabel("Message",{exact:true}).waitFor();await page.getByText("Perfect. Let’s share the proposal today.",{exact:true}).waitFor();await layout();await page.screenshot({path:resolve(out,"admin-apn-"+width+".png")});
 });
 await record("Internal team identity uses live profile rather than message snapshot",async()=>{
  await page.setViewportSize({width:390,height:900});await page.goto("http://127.0.0.1:5193/?role=superadmin&case="+Date.now()+"#/chat");await page.getByText("Internal team update",{exact:true}).waitFor();
  assert.equal(await page.getByText("Stale Support Name",{exact:true}).count(),0);await page.getByRole("button",{name:"View Haji profile"}).click();await page.getByText("Here to help the ALLBEE team.",{exact:true}).waitFor();await page.screenshot({path:resolve(out,"internal-profile.png")});await layout();
 });
 console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>!r.pass),out},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();await server.close();}
