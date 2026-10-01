import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(new URL("../..", import.meta.url).pathname);
const server = await createServer({ root, server: { host:"127.0.0.1", port:0 }, define: {
  "import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET": JSON.stringify("true"),
  "import.meta.env.VITE_PAUSE_TEST": JSON.stringify("0")
}, plugins: [{ name:"isolated-mascot", enforce:"pre", resolveId(id) {
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
      return { left:r.left, right:r.right, bottom:r.bottom, navTop:nav?.top, loaded:img?.naturalWidth||0, src:img?.getAttribute("src")||"", covered:el.closest(".allbee-mascot-launcher")?.classList.contains("is-covered") };
    });
    assert(position.left >= 0 && position.right <= width + 1, `offscreen ${role} ${width}`);
    if (width < 773) assert(position.bottom <= position.navTop, `bottom-nav collision ${role} ${width}`);
    assert(position.loaded > 0, `transparent mascot unavailable ${role} ${width}`);
    assert(/(?:\/src\/assets\/|\/assets\/)allbee-ai-mascot[^/]*\.png(?:\?.*)?$/.test(position.src), `unexpected mascot asset ${position.src}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await launcher().isVisible(), !position.covered, `collision visibility ${role} ${width}`);
    checks++;
  }

  // APN launcher is shell-level, so it exists on every major APN page, including AI itself.
  await page.setViewportSize({ width:1440, height:900 });
  for (const route of ["home","leads","wallet","withdrawals","network","chat","targets","quotations","documents","agreements","notifications","learn","profile","ai","support"]) {
    await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/${route}`);
    await page.locator(`[data-apn-page="${route}"]`).waitFor();
    assert.equal(await launcher().count(), 1, `APN launcher missing on ${route}`);
    checks++;
  }
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/network`);
  await page.locator('[data-apn-page="network"]').waitFor();
  await launcher().focus();
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
    await launcher().click();
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
  await launcher().click();
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
  await launcher().click();
  await page.locator('.web-ai-panel').waitFor();
  assert(await page.locator('.web-ai-panel .allbee-mascot img').count());
  checks++;

  // Personality: hover/focus greets the authenticated user while the fixed launcher remains pixel-stable.
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
  const animation = await page.locator('.allbee-mascot-launcher--login .allbee-mascot img').evaluate(el => getComputedStyle(el).animationName);
  assert.equal(animation, "none");
  checks++;

  console.log(`Mascot browser checks: ${checks} passed; page errors: ${failures.length}`);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
  await server.close();
}
