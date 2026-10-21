import { chromium } from "playwright";
import { createServer } from "vite";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const smoke = process.argv.includes("--smoke");
const widths = smoke ? [390] : [390, 1440];
const rounds = smoke ? 2 : 8;
const routesByRole = {
  superadmin: ["dashboard", "concepts", "ai-center", "dashboard"],
  partner: ["apn/home", "apn/chat", "apn/ai", "apn/home"],
  client: ["client/home", "client/chat", "client/ai", "client/home"],
};
const results = [];
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 0 },
  define: {
    "import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET": JSON.stringify("true"),
    "import.meta.env.VITE_PAUSE_TEST": JSON.stringify("0"),
  },
  plugins: [{
    name: "allbee-soak-isolated-mock",
    enforce: "pre",
    resolveId(id) {
      if (/(?:^|\/)supabaseClient(?:\.js)?$/.test(id)) return "\0allbee-soak-mock";
    },
    load(id) {
      if (id === "\0allbee-soak-mock") return readFileSync(resolve(root, "scripts/ui/mockSupabase.js"), "utf8");
    },
  }],
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
try {
  for (const width of widths) {
    for (const [role, routes] of Object.entries(routesByRole)) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        const u = new URL(route.request().url());
        return ["127.0.0.1", "localhost"].includes(u.hostname) || ["data:", "blob:"].includes(u.protocol)
          ? route.continue() : route.abort();
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      try {
        await page.goto(`${base}/?role=${role}#/${routes[0]}`, {
          waitUntil: "domcontentloaded",
          timeout: 35000,
        });
        await page.waitForFunction(
          () => document.body?.innerText?.length > 80 &&
            !document.querySelector(".prism-wrap,.loading-screen") &&
            !/ALLBEE services could not be reached/.test(document.body.innerText),
          null, { timeout: 18000 },
        );
        const startMetrics = await cdp.send("Performance.getMetrics");
        const heapOf = obj => obj.metrics.find(x => x.name === "JSHeapUsedSize")?.value ?? 0;
        for (let i = 0; i < rounds * routes.length; i++) {
          const route = routes[i % routes.length];
          const oldErrorCount = errors.length;
          const started = Date.now();
          let error = "";
          try {
            await page.evaluate(next => { window.location.hash = "#/" + next; }, route);
            await page.waitForFunction(next => window.location.hash === "#/" + next, route, { timeout: 5000 });
            await page.waitForTimeout(smoke ? 75 : 125);
          } catch (e) {
            error = String(e.message).slice(0, 250);
          }
          const snapshot = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            fatal: /ALLBEE could not render|This page could not load|Cannot read properties|ALLBEE services could not be reached/.test(document.body.innerText),
          }));
          const pass = !error && !snapshot.overflow && !snapshot.fatal && errors.length === oldErrorCount;
          results.push({ role, route, width, pass, durationMs: Date.now() - started, error: error || errors.slice(oldErrorCount).join(" | ") });
          if (!pass) break;
        }
        const endingMetrics = await cdp.send("Performance.getMetrics");
        console.log(JSON.stringify({
          role, width, checks: results.filter(x => x.role === role && x.width === width).length,
          heapStartMiB: +(heapOf(startMetrics) / 1048576).toFixed(2),
          heapEndMiB: +(heapOf(endingMetrics) / 1048576).toFixed(2),
        }));
      } finally {
        await cdp.detach();
        await context.close();
      }
    }
  }
} finally {
  const evidence = resolve(root, ".ai", "spa-soak-evidence");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(resolve(evidence, smoke ? "smoke.json" : "full.json"), JSON.stringify({ mocked: true, results }, null, 2));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify({ checked: results.length, failed: results.filter(x => !x.pass).length }));
if (results.some(x => !x.pass)) process.exitCode = 1;
