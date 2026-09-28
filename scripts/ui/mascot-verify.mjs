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
const launcher = () => page.getByRole("button", { name:"Ask ALLBEE AI with mascot" });

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
  await page.goto(`http://127.0.0.1:${port}/?role=client#/dashboard`);
  await page.getByText("Client portal", { exact:true }).waitFor();
  assert.equal(await launcher().count(), 1);
  await page.getByRole("button", { name:/Support/ }).click();
  assert.equal(await launcher().count(), 1);
  await launcher().click();
  await page.getByRole("button", { name:"ALLBEE AI", exact:true }).waitFor();
  await page.getByText("Your workspace assistant", { exact:true }).waitFor();
  assert.equal(await launcher().count(), 1);
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
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/home`);
  await page.locator('[data-apn-page="home"]').waitFor();
  await launcher().waitFor();
  const stableStart = await launcher().boundingBox();
  await launcher().hover();
  await page.getByRole("status").waitFor();
  assert.match(await page.getByRole("status").textContent(), /^Hello, .+! 👋$/);
  const hoverState = await page.locator(".allbee-mascot-launcher .allbee-mascot").getAttribute("class");
  assert(hoverState.includes("allbee-mascot--wave"), "hover should trigger a wave");
  for (let i=0;i<8;i++) {
    await page.waitForTimeout(250);
    const sample = await launcher().boundingBox();
    assert(Math.abs(sample.x-stableStart.x)<0.1 && Math.abs(sample.y-stableStart.y)<0.1, `launcher moved during animation sample ${i}`);
  }
  await page.mouse.move(400,400);
  checks++;

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
