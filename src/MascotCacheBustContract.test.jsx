import { describe, it, expect } from "vitest";
import fs from "node:fs";
import crypto from "node:crypto";

describe("mascot cache integrity contract", () => {
  it("imports the mascot through Vite so production uses a content-hashed asset URL", () => {
    const src = fs.readFileSync("src/ui/AllbeeMascot.jsx", "utf8");
    expect(src).toContain('import mascotAsset from "../assets/allbee-ai-mascot.png"');
    expect(src).toContain("src={mascotAsset}");
    expect(src).not.toMatch(/src=\"\/allbee-ai-mascot/);
  });
  it("ships the exact canonical transparent artwork bytes", () => {
    const file = fs.readFileSync("src/assets/allbee-ai-mascot.png");
    expect(file.length).toBeGreaterThan(100000);
    expect(crypto.createHash("sha256").update(file).digest("hex")).toBe("cd41701c8695dda0568ea0d4df02e28e87a3ed2ca133d1dd46f9c04d81e470d0");
  });
});
