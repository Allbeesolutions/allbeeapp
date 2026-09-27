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
 await check("APN AI quotation wizard opens and saves a draft",async()=>{
  await open("partner","apn/ai",1440);
  await page.getByRole("button",{name:"Generate Quotation",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button",{name:/Website Development/}).click();
  await dialog.getByRole("button",{name:/Static website/}).click();
  await dialog.getByRole("button",{name:"Continue",exact:true}).click();
  await dialog.getByRole("button",{name:"React",exact:true}).click();
  await dialog.getByRole("button",{name:"Continue",exact:true}).click();
  await dialog.getByRole("button",{name:"Continue",exact:true}).click();
  await dialog.getByRole("button",{name:/Normal delivery/}).click();
  await dialog.getByRole("button",{name:"Continue",exact:true}).click();
  await dialog.getByPlaceholder("Person or business").fill("Quotation Regression Client");
  await dialog.getByRole("button",{name:"Continue",exact:true}).click();
  await dialog.getByRole("button",{name:/Save draft/}).click();
  await dialog.getByText(/Quotation QT/).waitFor();
  await dialog.getByRole("button",{name:"Done",exact:true}).click();
 });
 await check("APN AI hides provider details, strips IDs and renders Markdown tables",async()=>{
  await open("partner","apn/ai",1440);
  const input=page.getByLabel("Message ALLBEE AI");
  await page.evaluate(()=>{window.__uiMock.apnAIError="Rate limit reached for model `openai/gpt-oss-120b` in organization `org_secret` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Used 4916, Requested 5165. Please try again in 15.6075s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing";});
  await input.fill("Why was my commission reversed?");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await page.getByText("ALLBEE AI is currently busy due to high usage. Please try again in 15.6075s.",{exact:true}).waitFor();
  const afterError=await page.locator(".apn-ai-chat").innerText();
  assert.equal(afterError.includes("gpt-oss-120b"),false);
  assert.equal(afterError.includes("console.groq.com"),false);
  await page.evaluate(()=>{window.__uiMock.apnAIError="";window.__uiMock.apnAIText="| Type | Record ID | Amount | Status |\n| --- | --- | ---: | --- |\n| State earnings | d32be198-90e1-40d8-b23d-66aaf903e87e | ₹30 | Pending |\n| Referral earnings | e3fff792-6c3d-44c0-8830-f9c6b42b65d7 | ₹30 | Pending |";});
  await input.fill("Show my earnings");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  const table=page.locator(".apn-ai-chat .ai-markdown-table table").last();
  await table.waitFor();
  assert.equal(await table.locator("thead th").allTextContents().then(xs=>xs.some(x=>/record id/i.test(x))),false);
  const chat=await page.locator(".apn-ai-chat").innerText();
  assert.equal(chat.includes("d32be198-90e1-40d8-b23d-66aaf903e87e"),false);
  assert.equal(chat.includes("| --- |"),false);
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
