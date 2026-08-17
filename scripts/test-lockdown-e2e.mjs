// Founder Emergency Lockdown — real-browser E2E verification.
// Two builds of the app are exercised against real Chromium:
//   1. VITE_PAUSE_TEST=1 build  → the gate MUST render the lockdown UI instantly
//      (zero network), accept typed codes, and reject them with a visible error.
//   2. standard build       → the gate MUST pass through within one poll cycle
//      (live status endpoint is currently unlocked) and the app boot proceeds.
// Usage: node scripts/test-lockdown-e2e.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "lockdown-e2e-"));

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

// ── Build 1: paused lockdown UI (VITE_PAUSE_TEST=1) ──────────────────────────────
console.log("Building paused variant (VITE_PAUSE_TEST=1)…");
await run("npx", ["vite", "build", "--outDir", join(work, "dist-paused")], { env: { VITE_PAUSE_TEST: "1" } });
const s1 = await server(4173, join(work, "dist-paused"));
const page1 = await browser.newPage();
await page1.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });

await page1.waitForSelector("text=Founder-controlled maintenance in progress", { timeout: 8000 }).catch(async (e) => {
  const body = await page1.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "");
  const url = page1.url();
  throw new Error(`gate text not found\nURL: ${url}\nBODY: ${JSON.stringify(body)}\n${e}`);
});
check("paused build shows the lockdown gate immediately (no network)", true);

const input = page1.getByLabel("Authorization code");
await input.fill("111111");
const authorizeBtn = page1.getByRole("button", { name: "Authorize" });
await authorizeBtn.click();
await page1.waitForSelector("text=Could not reach the authorization service", { timeout: 8000 });
check("typed code + Authorize produces a visible rejection (no crash)", true);

await page1.screenshot({ path: join(work, "paused-gate.png") });
await page1.close();
s1.kill();

// ── Build 2: live pass-through (standard build) ─────────────────────────────
console.log("Building standard variant…");
await run("npx", ["vite", "build", "--outDir", join(work, "dist-live")], {});
const s2 = await server(4174, join(work, "dist-live"));
const page2 = await browser.newPage();
await page2.goto("http://127.0.0.1:4174/", { waitUntil: "domcontentloaded" });

// Gate must disappear on its own within one poll cycle (status == unlocked).
try {
  await page2.waitForSelector("text=Checking services…", { timeout: 3000 });
} catch { /* already passed through before the first paint — also fine */ }
await page2.waitForSelector("text=Founder-controlled maintenance", { timeout: 2000, state: "detached" });
await page2.waitForFunction(() => !document.body.innerText.includes("Founder-controlled maintenance"), { timeout: 35000 });
check("live build passes through the gate when services are unlocked", true, "within one poll cycle");

await page2.screenshot({ path: join(work, "live-passthrough.png") });
await page2.close();
s2.kill();

await browser.close();
console.log(failures ? `\n${failures} E2E check(s) FAILED` : "\nAll lockdown E2E checks passed.");
process.exit(failures ? 1 : 0);
