import { describe, expect, it } from "vitest";
import fs from "node:fs";

const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");

describe("finance route regression", () => {
  it("keeps financeComponentHelpers at component-hook scope, not inside renderPage", () => {
    const helper = app.indexOf("const financeComponentHelpers = useMemo(");
    const renderPage = app.indexOf("const renderPage = () =>");
    const accounts = app.indexOf('case "accounts":');
    expect(helper).toBeGreaterThan(-1);
    expect(renderPage).toBeGreaterThan(-1);
    expect(accounts).toBeGreaterThan(renderPage);
    expect(helper).toBeLessThan(renderPage);
  });
});
