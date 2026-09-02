import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("accessibility hardening", () => {
  it("keeps interactive quiz options keyboard accessible", () => {
    const source = read("APNQuizTaker.jsx");
    expect(source).toMatch(/role=\{?"radio"\}?/);
    expect(source).toMatch(/aria-checked=/);
    expect(source).toMatch(/onKeyDown=/);
  });

  it("keeps helpdesk expanders keyboard accessible", () => {
    for (const file of ["APNHelpdesk.jsx", "PortalHelpdesk.jsx"]) {
      const source = read(file);
      expect(source).toMatch(/role=\{?"button"\}?/);
      expect(source).toMatch(/tabIndex=\{?0\}?/);
      expect(source).toMatch(/onKeyDown=/);
    }
  });

  it("keeps checklist and upload controls keyboard reachable", () => {
    const source = read("TestDetail.jsx");
    expect(source).toMatch(/role=\{?"checkbox"\}?/);
    expect(source).toMatch(/tabIndex=\{?0\}?/);
    expect(source).toMatch(/aria-checked=/);
    expect(source).toMatch(/<label[^>]*className="thumb-add-label"/);
  });
});
