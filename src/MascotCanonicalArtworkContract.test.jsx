import { describe, it, expect } from "vitest";
import fs from "node:fs";
import crypto from "node:crypto";

const EXPECTED = "cd41701c8695dda0568ea0d4df02e28e87a3ed2ca133d1dd46f9c04d81e470d0";
const digest = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

describe("canonical ALLBEE mascot artwork", () => {
  it("ships the exact user-approved transparent mascot bytes", () => {
    expect(digest("src/assets/allbee-ai-mascot.png")).toBe(EXPECTED);
  });
  it("keeps every historical mascot URL pinned to the same approved artwork", () => {
    for (const path of ["public/allbee-ai-mascot.png", "public/allbee-ai-mascot-v3.png", "public/allbee-ai-mascot.jpeg"]) {
      expect(digest(path)).toBe(EXPECTED);
    }
  });
});
