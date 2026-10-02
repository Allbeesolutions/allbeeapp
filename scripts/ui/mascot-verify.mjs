import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const evidence = resolve(root, ".ai/mascot-humanise/evidence");
mkdirSync(evidence, { recursive:true });
const chatHidden = readFileSync(resolve(root, "src/AllbeeApp.jsx"), "utf8").includes('sidebarOpen || tab === "chat"');
const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mascot verification</title></head><body style="margin:0;background:#f4f7fb;color:#132d46;font:16px system-ui"><div id="root"></div><script type="module">
import React from "react";import{createRoot}from"react-dom/client";import{AllbeeMascot,AllbeeAIFloatingAssistant}from"/src/ui/AllbeeMascot.jsx";
window.__mascotOpened=0;
const tile=(state)=>React.createElement("div",{style:{padding:20,textAlign:"center"}},React.createElement("p",null,state),React.createElement(AllbeeMascot,{state,size:220}));
createRoot(document.getElementById("root")).render(React.createElement(React.Fragment,null,
React.createElement("h1",{style:{margin:32}},"ALLBEE character rig"),
React.createElement("div",{id:"rig-review",style:{display:"flex",flexWrap:"wrap",padding:20}},tile("idle"),tile("wave"),tile("walking"),tile("thinking")),
new URLSearchParams(location.search).has("blocked")?React.createElement("button",{style:{position:"fixed",right:140,bottom:24,width:80,height:76}},"Protected action"):null,
React.createElement(AllbeeAIFloatingAssistant,{displayName:"Maya Patel",surface:"workspace",greeting:true,onOpen:()=>window.__mascotOpened++})
));
</script></body></html>`;
const harnessPlugin = { name:"mascot-verification-harness", configureServer(server) {
  server.middlewares.use(async (req,res,next) => {
    if (!req.url?.startsWith("/__mascot-preview")) return next();
    try { res.setHeader("Content-Type","text/html"); res.end(await server.transformIndexHtml(req.url,harness)); }
    catch(error) { next(error); }
  });
}};
const server = await createServer({ root, server: { host:"127.0.0.1", port:0 }, define: {
  "import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET": JSON.stringify("true"),
  "import.meta.env.VITE_PAUSE_TEST": JSON.stringify("0")
}, plugins: [harnessPlugin, { name:"isolated-mascot", enforce:"pre", resolveId(id) {
  if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(id)) return resolve(root,"scripts/ui/apnUXMock.js");
} }] });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
const widths = [320,360,375,390,412,430,768,1440];
page.on("pageerror", e => failures.push(e.message));
await page.route("**/*", route => {
  const u = new URL(route.request().url());
  return ["127.0.0.1","localhost"].includes(u.hostname) || ["data:","blob:"].includes(u.protocol) ? route.continue() : route.abort();
});
let checks=0;
const launcher = () => page.getByRole("button", { name:"Ask ALLBEE AI with mascot", includeHidden:true });
const settled = async () => {
  await page.waitForFunction(() => [...document.querySelectorAll(".page-enter")].every(el =>
    el.getAnimations().every(a => a.playState !== "running" || a.effect.getTiming().iterations === Infinity)));
  await launcher().waitFor({state:"visible"});
};
const openAI = async () => { await settled(); await launcher().click(); await page.getByRole("button", { name:"Open ALLBEE AI" }).click(); };

try {
  // APN: responsive placement for partner + head roles.
  for (const role of ["partner","district_head","state_head"]) for (const width of widths) {
    await page.setViewportSize({ width, height:900 });
    await page.goto(`http://127.0.0.1:${port}/?role=${role}#/apn/network`);
    await page.locator('[data-apn-page="network"]').waitFor();
    await launcher().waitFor({ state:"attached" });
    await page.waitForTimeout(450);
    const position = await launcher().evaluate(el => {
      const r = el.getBoundingClientRect();
      const nav = document.querySelector(".apn-bottomnav")?.getBoundingClientRect();
      const img = el.querySelector("img");
      return { left:r.left, right:r.right, bottom:r.bottom, navTop:nav?.top, loaded:img?.naturalWidth||0, src:img?.getAttribute("src")||"", covered:el.closest(".allbee-mascot-launcher")?.classList.contains("is-covered"), visible:getComputedStyle(el).visibility !== "hidden" };
    });
    assert(position.left >= 0 && position.right <= width + 1, `offscreen ${role} ${width}`);
    if (width < 773) assert(position.bottom <= position.navTop, `bottom-nav collision ${role} ${width}`);
    assert(position.loaded > 0, `transparent mascot unavailable ${role} ${width}`);
    assert(/(?:\/src\/assets\/|\/assets\/)allbee-ai-mascot[^/]*\.png(?:\?.*)?$/.test(position.src), `unexpected mascot asset ${position.src}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(position.visible, !position.covered, `collision visibility ${role} ${width}`);
    checks++;
  }

  // APN launcher is shell-level, so it exists on every major APN page, including AI itself.
  await page.setViewportSize({ width:1440, height:900 });
  for (const route of ["home","leads","wallet","withdrawals","network","chat","targets","quotations","documents","agreements","notifications","learn","profile","ai","support"]) {
    await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/${route}`);
    await page.locator(`[data-apn-page="${route}"]`).waitFor();
    assert.equal(await launcher().count(), route === "chat" && chatHidden ? 0 : 1, `APN launcher coverage on ${route}`);
    checks++;
  }
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/network`);
  await page.locator('[data-apn-page="network"]').waitFor();
  await settled();
  await launcher().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name:"Open ALLBEE AI" }).waitFor();
  await page.keyboard.press("Enter");
  await page.locator('[data-apn-page="ai"]').waitFor();
  assert(await page.locator(".apn-ai-welcome .allbee-mascot img").count());
  checks++;

  // Focused editors and modal overlays yield the launcher entirely.
  await page.setViewportSize({ width:390, height:900 });
  const aiComposer = page.getByLabel("Message ALLBEE AI");
  await aiComposer.focus();
  assert.equal(await launcher().count(), 0, "launcher must hide while editing");
  await aiComposer.evaluate(el => el.blur());
  await launcher().waitFor({ state:"attached" });
  checks++;
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/leads`);
  await page.locator('[data-apn-page="leads"]').waitFor();
  await page.locator(".apn-page-intro").getByRole("button", { name:"Submit a lead" }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await launcher().count(), 0, "launcher must hide behind a modal");
  checks++;

  await page.setViewportSize({ width:1440, height:900 });
  // Internal employee workspace: launcher persists and opens the real ALLBEE AI route.
  for (const role of ["staff","intern"]) {
    await page.goto(`http://127.0.0.1:${port}/?role=${role}#/dashboard`);
    await page.locator("main.page-enter").waitFor();
    assert.equal(await launcher().count(), 1, `workspace launcher missing for ${role}`);
    await openAI();
    await page.waitForFunction(() => location.hash.includes("assistant"));
    assert.equal(await launcher().count(), 1, `workspace launcher missing on AI page for ${role}`);
    checks++;
  }

  // Client portal: launcher exists on overview/support and opens a client-scoped AI surface.
  await page.goto(`http://127.0.0.1:${port}/?role=client&clientAI=enabled#/dashboard`);
  await page.getByText("Client portal", { exact:true }).waitFor();
  await launcher().waitFor();
  assert.equal(await launcher().count(), 1);
  await page.getByRole("button", { name:/Support/ }).click();
  assert.equal(await launcher().count(), 1);
  await openAI();
  await page.getByRole("button", { name:"ALLBEE AI", exact:true }).waitFor();
  await page.getByText("Your workspace assistant", { exact:true }).waitFor();
  assert.equal(await launcher().count(), 1);
  checks++;

  // An account without AI entitlement keeps the launcher hidden and cannot open AI.
  await page.goto(`http://127.0.0.1:${port}/?role=client#/client/ai`);
  await page.getByText("ALLBEE AI is not enabled for this account", { exact:true }).waitFor();
  assert.equal(await launcher().count(), 0);
  checks++;

  // Login: the same floating mascot opens the existing safe sign-in helper.
  await page.goto(`http://127.0.0.1:${port}/?role=anonymous`);
  await launcher().waitFor();
  assert(/(?:\/src\/assets\/|\/assets\/)allbee-ai-mascot[^/]*\.png(?:\?.*)?$/.test(await page.locator('.allbee-mascot-launcher--login img').getAttribute('src')));
  await openAI();
  await page.locator('.web-ai-panel').waitFor();
  assert(await page.locator('.web-ai-panel .allbee-mascot img').count());
  checks++;

  // Personality: interaction freezes walking immediately and greets the authenticated user.
  await page.setViewportSize({ width:1440, height:900 });
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/network`);
  await page.locator('[data-apn-page="network"]').waitFor();
  await launcher().waitFor();
  const stableStart = await launcher().boundingBox();
  await launcher().hover();
  const greeting = page.locator(".allbee-mascot-greeting");
  await greeting.waitFor();
  assert.match(await greeting.textContent(), /^Hello, .+! 👋$/);
  const hoverState = await page.locator(".allbee-mascot-launcher .allbee-mascot").getAttribute("class");
  assert(hoverState.includes("allbee-mascot--wave"), "hover should trigger a wave");
  for (let i=0;i<8;i++) {
    await page.waitForTimeout(250);
    const sample = await launcher().boundingBox();
    assert(Math.abs(sample.x-stableStart.x)<0.1 && Math.abs(sample.y-stableStart.y)<0.1, `launcher moved during animation sample ${i}`);
  }
  await page.mouse.move(400,400);
  checks++;

  // Real hit testing at top/middle/bottom of every APN destination.
  // Include both document and nested scrolling containers; navigation stays accessible.
  const apnRoutes = ["home","leads","wallet","withdrawals","network","chat","targets","quotations","documents","agreements","notifications","learn","profile","ai","support","achievements","leaderboard","district"];
  for (const width of widths) for (const route of apnRoutes) {
    await page.setViewportSize({ width, height:900 });
    await page.goto(`http://127.0.0.1:${port}/?role=state_head#/apn/${route}`);
    await page.locator(`[data-apn-page="${route}"]`).waitFor();
    await page.locator(".apn-skeleton").waitFor({ state:"hidden" });
    for (const fraction of [0, .5, 1]) {
      await page.evaluate(f => {
        for (const el of [document.scrollingElement, ...document.querySelectorAll(".apn-main,.apn-body,.tc-conversations,.tc-messages")]) {
          if (el) el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight) * f;
        }
      }, fraction);
      await page.waitForTimeout(120);
      if (route === "chat" && chatHidden) { assert.equal(await launcher().count(),0); checks++; continue; }
      const collisions = await launcher().evaluate(button => {
        const launcher = button.closest(".allbee-mascot-launcher"), r = button.getBoundingClientRect();
        if (getComputedStyle(launcher).visibility === "hidden") return [];
        const hits = new Set();
        for (const x of [r.left + 2, (r.left+r.right)/2, r.right - 2]) for (const y of [r.top + 2, (r.top+r.bottom)/2, r.bottom - 2]) {
          for (const el of document.elementsFromPoint(x, y)) {
            const control = el.closest("button,a[href],input,select,textarea,[role='button']");
            if (control && !launcher.contains(control)) hits.add(control.getAttribute("aria-label") || control.textContent || control.tagName);
          }
        }
        return [...hits];
      });
      assert.deepEqual(collisions, [], `mascot covers an action: ${route} ${width} scroll ${fraction}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      checks++;
    }
  }

  // Reduced motion applies to the transparent mascot too.
  await page.goto(`http://127.0.0.1:${port}/?role=anonymous`);
  await page.emulateMedia({ reducedMotion:"reduce" });
  await launcher().waitFor();
  const fallback = await page.locator('.allbee-mascot-launcher--login .allbee-mascot').evaluate(el => ({
    staticOpacity:getComputedStyle(el.querySelector("img")).opacity,
    rigDisplay:getComputedStyle(el.querySelector("svg")).display,
    roaming:el.closest(".allbee-mascot-launcher").dataset.roaming,
  }));
  assert.equal(fallback.staticOpacity, "1");
  assert.equal(fallback.rigDisplay, "none");
  assert.equal(fallback.roaming, "resting");
  checks++;

  // A controlled clock verifies real roaming and separate joint motion without
  // waiting through minutes of calm pauses. The harness uses the production components.
  const motion = await browser.newPage({ viewport:{ width:1440,height:900 } });
  motion.on("pageerror", e => failures.push(e.message));
  await motion.addInitScript(() => { Math.random=()=>.4; sessionStorage.setItem("allbee-mascot-intro-v3","shown"); });
  await motion.clock.install({ time:new Date("2026-10-02T03:00:00Z") });
  const motionButton = () => motion.getByRole("button",{name:"Ask ALLBEE AI with mascot"});
  await motion.goto(`http://127.0.0.1:${port}/__mascot-preview`);
  await motionButton().waitFor();
  await motion.locator("#rig-review").evaluate(el => { for (const a of el.getAnimations({subtree:true})) { a.pause(); a.currentTime=600; } });
  await motion.screenshot({ path:resolve(evidence,"rig-1440.png") });
  const resting = await motionButton().boundingBox();
  await motion.clock.runFor(12000);
  const stepOne = await motionButton().boundingBox();
  assert(resting.x-stepOne.x > 5, "character should walk away from its initial position");
  assert.equal(await motion.locator('[data-testid="allbee-mascot-launcher"]').getAttribute("data-roaming"),"walking");
  await motion.clock.runFor(1000);
  const stepTwo = await motionButton().boundingBox();
  assert(stepOne.x-stepTwo.x > 9 && stepOne.x-stepTwo.x < 14, "walking speed should stay natural and slow");
  const joints = await motionButton().evaluate(el => [...el.querySelectorAll(".allbee-mascot-leg")].map(leg=>getComputedStyle(leg).transform));
  assert(joints[0] !== joints[1], "legs should alternate independently");
  await motion.mouse.move(stepTwo.x+stepTwo.width/2,stepTwo.y+stepTwo.height/2);
  const frozen = await motionButton().boundingBox();
  await motion.clock.runFor(2000);
  const afterHover = await motionButton().boundingBox();
  assert(Math.abs(frozen.x-afterHover.x)<.1,"hover must pause roaming without a jump");
  await motionButton().click();
  assert.match(await motion.getByRole("status").textContent(),/Hi, Maya!/);
  assert.equal(await motion.evaluate(()=>window.__mascotOpened),0);
  await motion.getByRole("button",{name:"Open ALLBEE AI"}).click();
  assert.equal(await motion.evaluate(()=>window.__mascotOpened),1);
  await motion.mouse.move(100,100);
  await motion.clock.runFor(83000);
  await motion.getByRole("status").waitFor();
  assert.match(await motion.getByRole("status").textContent(),/Need a hand here/);
  checks+=7;
  await motion.emulateMedia({ reducedMotion:"reduce" });
  await motion.clock.runFor(20000);
  assert.equal(await motion.locator('[data-testid="allbee-mascot-launcher"]').getAttribute("data-roaming"),"resting");
  checks++;

  // A control inside the proposed travel corridor prevents the stroll.
  await motion.emulateMedia({ reducedMotion:"no-preference" });
  await motion.goto(`http://127.0.0.1:${port}/__mascot-preview?blocked=1`);
  await motionButton().waitFor();
  const blockedStart = await motionButton().boundingBox();
  await motion.clock.runFor(30000);
  const blockedEnd = await motionButton().boundingBox();
  assert(Math.abs(blockedStart.x-blockedEnd.x)<.1,"walk must not cross a protected action");
  checks++;
  await motion.close();

  // A real touch interaction must release synthetic hover/focus after the greeting.
  const mobile = await browser.newPage({ viewport:{width:390,height:900}, isMobile:true, hasTouch:true });
  mobile.on("pageerror", e => failures.push(e.message));
  await mobile.addInitScript(() => { Math.random=()=>.4; sessionStorage.setItem("allbee-mascot-intro-v3","shown"); });
  await mobile.clock.install({time:new Date("2026-10-02T03:00:00Z")});
  await mobile.goto(`http://127.0.0.1:${port}/__mascot-preview`);
  const mobileButton=mobile.getByRole("button",{name:"Ask ALLBEE AI with mascot"});
  await mobileButton.waitFor();
  await mobileButton.tap();
  assert.match(await mobile.getByRole("status").textContent(),/Hi, Maya!/);
  await mobile.clock.runFor(26000);
  assert.equal(await mobile.getByRole("status").count(),0,"touch greeting should close on its timer");
  checks++;
  const mobileResume=await mobileButton.evaluate(b=>({roaming:b.closest(".allbee-mascot-launcher").dataset.roaming,x:parseFloat(b.closest(".allbee-mascot-launcher").style.getPropertyValue("--mascot-x"))}));
  assert.equal(mobileResume.roaming,"walking","touch focus must not prevent later strolls");
  assert(mobileResume.x < -10,"mascot should resume moving after a touch greeting");
  checks++;
  await mobile.close();

  // Capture the actual shared launcher on representative app surfaces.
  await page.emulateMedia({ reducedMotion:"no-preference" });
  for (const [width,role,hash,label] of [[1440,"staff","dashboard","workspace"],[390,"partner","apn/network","apn"],[390,"client","client/home","client"],[390,"client","client/ai","client-ai"],[390,"anonymous","","login"]]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`http://127.0.0.1:${port}/?role=${role}&clientAI=enabled#/${hash}`);
    await page.mouse.move(20,20);
    await page.waitForTimeout(700);
    console.log(`Capture ${label} at ${width}px`);
    try { await launcher().waitFor({timeout:5000}); }
    catch(error) {
      console.log("Hidden launcher", await launcher().evaluate(button => {
        const el=button.closest(".allbee-mascot-launcher"),r=button.getBoundingClientRect(),hits=new Set();
        for(const x of [r.left+2,(r.left+r.right)/2,r.right-2])for(const y of [r.top+2,(r.top+r.bottom)/2,r.bottom-2])
          for(const node of document.elementsFromPoint(x,y)){const control=node.closest("button,a[href],input,select,textarea,[role='button']");if(control&&!el.contains(control))hits.add(control.getAttribute("aria-label")||control.textContent||control.tagName);}
        return {rect:r.toJSON(),style:el.getAttribute("style"),classes:el.className,scrollY,hover:el.matches(":hover"),active:document.activeElement?.tagName,hits:[...hits]};
      }));
      await page.screenshot({path:resolve(evidence,`failed-${label}-${width}.png`)});
      throw error;
    }
    await launcher().click();
    await page.getByRole("button",{name:"Open ALLBEE AI"}).waitFor();
    const bubbleBox = await page.locator(".allbee-mascot-greeting").boundingBox();
    assert(bubbleBox.x>=0 && bubbleBox.x+bubbleBox.width<=width+1,"greeting should fit the viewport");
    await page.screenshot({path:resolve(evidence,`${label}-${width}.png`)});
    checks++;
  }
  writeFileSync(resolve(evidence,"results.json"),JSON.stringify({checks,pageErrors:failures,widths,chatHidden},null,2)+"\n");

  console.log(`Mascot browser checks: ${checks} passed; page errors: ${failures.length}`);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
  await server.close();
}
