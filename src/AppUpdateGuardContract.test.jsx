import { describe, it, expect } from "vitest";
import fs from "node:fs";

const guard = fs.readFileSync("src/appUpdateGuard.js", "utf8");
const main = fs.readFileSync("src/main.jsx", "utf8");
const vite = fs.readFileSync("vite.config.js", "utf8");
const sw = fs.readFileSync("public/sw.js", "utf8");
const vercel = fs.readFileSync("vercel.json", "utf8");

describe("stale mobile build recovery", () => {
  it("publishes and checks a build manifest with no-store semantics", () => {
    expect(vite).toContain('fileName: "allbee-build.json"');
    expect(guard).toContain('/allbee-build.json?t=${Date.now()}');
    expect(guard).toContain('cache: "no-store"');
    expect(vercel).toContain('/allbee-build.json');
    expect(vercel).toContain('no-cache, no-store, must-revalidate');
  });
  it("installs the update guard at app boot and reloads a stale visible build", () => {
    expect(main).toContain("installAppUpdateGuard();");
    expect(guard).toContain("window.location.reload()");
    expect(guard).toContain('document.visibilityState === "hidden"');
  });
  it("forces service-worker update checks and advances the shell cache generation", () => {
    expect(guard).toContain('register("/sw.js", { updateViaCache: "none" })');
    expect(guard).toContain("registration.update()");
    expect(sw).toContain("allbee-shell-v3");
  });
});
