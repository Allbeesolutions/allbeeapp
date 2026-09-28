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
    expect(crypto.createHash("sha256").update(file).digest("hex")).toBe("71f0f23dfe6c755ff4cf7616e72c94b8f43adb77b33d228352b97ef6dc292ae4");
  });
});
