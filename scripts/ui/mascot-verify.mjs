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
try {
  for (const role of ["partner","district_head","state_head"]) for (const width of widths) {
    await page.setViewportSize({width,height:900});
    await page.goto(`http://127.0.0.1:${port}/?role=${role}#/apn/home`);
    await page.locator('[data-apn-page="home"]').waitFor();
    assert.equal(await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).count(),0);
    assert(await page.locator(".apn-ai-banner .allbee-mascot img").count());
    await page.evaluate(()=>location.hash="#/apn/wallet");
    await page.locator('[data-apn-page="wallet"]').waitFor();
    const button=page.locator(".allbee-mascot-button");
    await button.waitFor({state:"attached"});
    // Collision detection runs on requestAnimationFrame plus a delayed layout check.
    // Let it settle before comparing the React state to actual CSS visibility.
    await page.waitForTimeout(500);
    if(role==="partner" && width===390) await page.screenshot({path:"/tmp/allbee-mascot-wallet-390.png"});
    const position=await button.evaluate(el=>{
      const r=el.getBoundingClientRect(), nav=document.querySelector(".apn-bottomnav")?.getBoundingClientRect();
      return {left:r.left,right:r.right,bottom:r.bottom,navTop:nav?.top,loaded:el.querySelector("img")?.naturalWidth||0,covered:el.closest(".allbee-mascot-launcher")?.classList.contains("is-covered")};
    });
    assert(position.left>=0 && position.right<=width+1, `offscreen ${role} ${width}`);
    if(width<773) assert(position.bottom<=position.navTop, `bottom nav collision ${role} ${width}`);
    assert(position.loaded>0,`image unavailable ${role} ${width}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(await button.isVisible(),!position.covered,`collision visibility ${role} ${width}`);
    checks++;
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/home`);
  await page.locator('[data-apn-page="home"]').waitFor();
  await page.evaluate(()=>location.hash="#/apn/wallet");
  await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-apn-page="ai"]').waitFor();
  assert.equal(await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).count(),0);
  assert(await page.locator(".apn-ai-welcome .allbee-mascot img").count());
  checks++;
  for(const route of ["leads","quotations","chat"]) {
    await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/${route}`);
    await page.locator(`[data-apn-page="${route}"]`).waitFor();
    assert.equal(await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).count(),0,`duplicate/conflicting launcher on ${route}`);
    checks++;
  }
  await page.goto(`http://127.0.0.1:${port}/?role=partner#/apn/home`);
  await page.locator('[data-apn-page="home"]').waitFor();
  await page.evaluate(()=>location.hash="#/apn/wallet");
  await page.locator(".allbee-mascot-button").waitFor({state:"attached"});
  await page.getByRole("button",{name:"Search",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).count(),0);
  checks++;
  await page.goto(`http://127.0.0.1:${port}/?role=client#/dashboard`);
  assert.equal(await page.getByRole("button",{name:"Ask ALLBEE AI with mascot"}).count(),0);
  checks++;
  await page.goto(`http://127.0.0.1:${port}/?role=anonymous`);
  await page.getByRole("button",{name:/Open login help/}).waitFor();
  assert(await page.locator(".web-ai-fab .allbee-mascot img").count());
  checks++;
  await page.emulateMedia({reducedMotion:"reduce"});
  const animation=await page.locator(".web-ai-fab .allbee-mascot img").evaluate(el=>getComputedStyle(el).animationName);
  assert.equal(animation,"none");
  checks++;
  console.log(`Mascot browser checks: ${checks} passed; page errors: ${failures.length}`);
  assert.deepEqual(failures,[]);
} finally {
  await browser.close();
  await server.close();
}
