// Real-browser verification of the founder lockdown logo-tap sequence against
// the REAL application entry point (not an isolated component).
// Usage: node scripts/verify-founder-tap.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "founder-tap-verify-"));

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, env: { ...process.env, ...opts.env }, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(" ")} failed:\n${out}`))));
  });

const waitForPort = async (port, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`port ${port} never came up`);
};

const server = async (port, dir) => {
  const p = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--outDir", dir], { cwd: root, shell: true, stdio: "ignore" });
  await waitForPort(port);
  return p;
};

const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`); if (!ok) failures++; };

// ── Build 1: paused variant — gate is LIVE on screen, real entry point ─────
console.log("Building paused variant (VITE_PAUSE_TEST=1)…");
await run("npx", ["vite", "build", "--outDir", join(work, "dist-paused")], { env: { VITE_PAUSE_TEST: "1" } });
const s1 = await server(4183, join(work, "dist-paused"));
const page1 = await browser.newPage();
await page1.goto("http://127.0.0.1:4183/", { waitUntil: "domcontentloaded" });
await page1.waitForSelector("text=Founder-controlled maintenance", { timeout: 10000 });
const logo1 = page1.locator('img[alt="ALLBEE"]');
check("gate logo present on the real entry point", await logo1.count() === 1);
for (let i = 1; i <= 21; i++) {
  await logo1.click();
  await sleep(280);
  const chip = await page1.locator(".founder-chip").count();
  const text = chip ? await page1.locator(".founder-chip").first().textContent() : "";
  if (i === 16) check("tap 16: no countdown", chip === 0);
  if (i === 17) check("tap 17 → '3'", text === "3");
  if (i === 18) check("tap 18 → '2'", text === "2");
  if (i === 19) check("tap 19 → '1'", text === "1");
  if (i === 20) check("tap 20 → armed", (await page1.locator('.founder-chip[data-countdown="armed"]').count()) === 1);
  if (i === 21) {
    const authVisible = await page1.locator('input[id="founder-code"]').count();
    check("tap 21 → emergency authorization screen", authVisible === 1);
    // authorize with a wrong code → existing server-side rejection path (network-offline UI)
    await page1.locator('input[id="founder-code"]').fill("111111");
    await page1.getByRole("button", { name: "Authorize" }).click();
    await page1.waitForSelector(".auth-msg", { timeout: 8000 });
    const errText = await page1.locator(".auth-msg").first().textContent();
    check("wrong code → existing rejection shown", !!errText && errText.trim().length > 0, errText.trim());
  }
}
await page1.screenshot({ path: join(work, "gate-sequence.png") });
await page1.close();
s1.kill();

// ── Build 2: standard build — login screen logo in the real app ───────────
console.log("Building standard variant…");
await run("npx", ["vite", "build", "--outDir", join(work, "dist-live")], {});
const s2 = await server(4184, join(work, "dist-live"));
const page2 = await browser.newPage();
// The standard build has no .env here (placeholder.supabase.co), so the live
// gate poll would time out. Stub the lockdown endpoint as "unlocked" before
// the app boots so the REAL login screen renders (network isolation only —
// the app code itself is the production build).
await page2.addInitScript(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = String(input);
    if (url.includes("/functions/v1/founder-lockdown")) {
      return Promise.resolve(new Response(JSON.stringify({ locked: false }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return realFetch(input, init);
  };
});
await page2.goto("http://127.0.0.1:4184/", { waitUntil: "domcontentloaded" });
// gate polls the live endpoint; on unlocked it passes through to the login screen
try {
  await page2.waitForSelector("text=How would you like to sign in", { timeout: 40000 });
  check("live build passes through to the login screen", true);
  const loginLogo = page2.locator('img[alt="ALLBEE Solutions"]');
  if (await loginLogo.count() === 1) {
    for (let i = 0; i < 21; i++) { await loginLogo.click(); await sleep(280); }
    const authVisible = await page2.locator('input[id="founder-code"]').count();
    check("login-screen logo sequence opens the emergency authorization screen", authVisible === 1);
    await page2.screenshot({ path: join(work, "login-sequence.png") });
  } else {
    check("login-screen logo found", false, "logo not rendered");
  }
} catch (e) {
  check("live build reaches the login screen", false, `gate did not pass through (${e.message.split("\n")[0]})`);
}
await page2.close();
s2.kill();

await browser.close();
console.log(failures ? `\n${failures} verification check(s) FAILED` : "\nAll founder-tap verification checks passed.");
process.exit(failures ? 1 : 0);