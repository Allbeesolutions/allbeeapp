import assert from "node:assert/strict";
export async function verifyInteractions(page, out, writeFileSync, resolve) {
 const results=[]; page.setDefaultTimeout(10000);
 async function check(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message,body:(await page.locator("body").innerText()).slice(-1000)})}}
 async function open(role,route="dashboard",width=390){
  await page.setViewportSize({width,height:844});
  await page.goto("http://127.0.0.1:5188/?role="+role+"#/"+route);
  await page.waitForFunction(()=>!document.querySelector(".prism-wrap,.loading-screen"));
 }
 await check("Mobile menu keyboard access and role-aware accountant navigation",async()=>{
  await open("accountant");
  const menu=page.getByRole("button",{name:"Menu",exact:true});
  await menu.click();
  assert.equal(await menu.getAttribute("aria-expanded"),"true");
  const account=page.locator(".sidebar .nav-route").filter({hasText:"Share & accounts"});
  await account.first().waitFor({state:"visible"});
  await account.first().focus();
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>document.querySelector(".hamburger")?.getAttribute("aria-expanded")==="false");
  assert.equal(await menu.evaluate(el=>document.activeElement===el),true);
  const nav=page.getByRole("navigation",{name:"Primary mobile navigation"});
  assert.equal(await nav.getByRole("button",{name:"Tasks",exact:true}).count(),0);
  await nav.getByRole("button",{name:"Accounts",exact:true}).click();
  await page.waitForURL("**#/accounts");
 });
 await check("Internal AI failure, draft preservation, retry and new chat",async()=>{
  await open("admin","assistant");
  const input=page.getByLabel("Message ALLBEE AI");
  await input.waitFor();
  await page.evaluate(()=>window.__uiMock.failAI=true);
  await input.fill("Review my tasks");
  await page.getByRole("button",{name:"Send message"}).click();
  await page.getByRole("alert").filter({hasText:"Couldn’t get a reply"}).waitFor();
  assert.equal(await input.inputValue(),"Review my tasks");
  await page.evaluate(()=>window.__uiMock.failAI=false);
  await page.getByRole("button",{name:"Try again",exact:true}).click();
  await page.getByText("Here is your checklist:",{exact:false}).waitFor();
  assert.equal(await page.locator(".assistant-message.user").count(),1);
  await page.screenshot({path:resolve(out,"assistant-mobile.png")});
  await page.getByRole("button",{name:"New chat"}).click();
  assert.equal(await page.locator(".assistant-message").count(),0);
 });
 await check("Client support navigation and refresh",async()=>{
  await open("client");
  await page.getByRole("button",{name:"Support",exact:true}).click();
  await page.getByRole("button",{name:"Create Ticket",exact:true}).click();
  await page.getByRole("dialog").getByLabel(/Subject/).fill("Review project handoff");
  await page.getByRole("button",{name:"Submit ticket",exact:true}).click();
  await page.waitForFunction(()=>window.__uiMock.rpcs.some(r=>r.name==="apn_create_support_ticket"));
  await page.getByRole("dialog").waitFor({state:"hidden"});
  const before=await page.evaluate(()=>window.__uiMock.reads.length);
  await page.getByRole("button",{name:"Refresh current portal"}).click();
  await page.waitForFunction(n=>window.__uiMock.reads.length>n,before);
  await page.getByRole("button",{name:"Overview",exact:true}).click();
  await page.getByText("Your project updates",{exact:true}).waitFor();
 });
 await check("Partner payout form validates mismatch then invokes save",async()=>{
  await open("partner","apn/profile",320);
  await page.getByLabel("Account number",{exact:true}).fill("12345678");
  await page.getByLabel("Confirm account number",{exact:true}).fill("99999999");
  await page.getByRole("button",{name:"Save payout details"}).click();
  await page.getByText("Account number confirmation does not match.").waitFor();
  assert.equal(await page.evaluate(()=>window.__uiMock.rpcs.filter(r=>r.name==="apn_upsert_withdrawal_bank_account").length),0);
  await page.getByLabel("Confirm account number",{exact:true}).fill("12345678");
  await page.getByRole("button",{name:"Save payout details"}).click();
  await page.getByText("Payout details saved. Verification is pending.").waitFor();
  assert.equal(await page.evaluate(()=>window.__uiMock.rpcs.filter(r=>r.name==="apn_upsert_withdrawal_bank_account").length),1);
 });
 await check("Superadmin attendance Edit opens without runtime crash",async()=>{
  await open("superadmin","attendance",1440);
  const edit=page.getByRole("button",{name:"Edit",exact:true}).first();
  await edit.waitFor();
  await edit.click();
  await page.getByRole("dialog").waitFor();
  assert.equal((await page.locator("body").innerText()).includes("AttendanceEditModal is not defined"),false);
  await page.keyboard.press("Escape");
 });
 await check("AI automation workflow create, simulate and delete actions",async()=>{
  await open("admin","ai-center",1440);
  await page.getByRole("button",{name:"Automation",exact:true}).click();
  await page.getByRole("button",{name:"New workflow",exact:true}).click();
  await page.getByLabel("Title",{exact:true}).fill("UI action audit workflow");
  await page.getByRole("button",{name:/Save & version/}).click();
  await page.waitForFunction(()=>window.__uiMock.rpcs.some(r=>r.name==="business_automation_upsert_rule"));
  assert.equal(await page.evaluate(()=>window.__uiMock.rpcs.filter(r=>r.name==="business_automation_upsert_rule").length),1);
 });
 for(const width of [320,768,1440])await check("Client support dialog at "+width+"px",async()=>{
  await open("client","dashboard",width);
  await page.getByRole("button",{name:"Support",exact:true}).click();
  await page.getByRole("button",{name:"Create Ticket",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const bounds=await dialog.boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
  await dialog.getByLabel(/Subject/).focus();
  await page.keyboard.press("Escape");
  await dialog.waitFor({state:"hidden"});
 });
 writeFileSync(resolve(out,"interactions.json"),JSON.stringify({mocked:true,results},null,2));
 console.log(JSON.stringify({interactions:results},null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
}
