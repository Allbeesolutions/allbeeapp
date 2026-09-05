import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = typeof traverseModule === "function" ? traverseModule : traverseModule.default;
const allowed = new Set([
  "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "console",
  "Math", "JSON", "Date", "Promise", "Array", "Object", "String", "Number", "Boolean", "RegExp", "Error",
  "TypeError", "URL", "URLSearchParams", "Blob", "File", "FileReader", "FormData", "AbortController", "Intl",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent", "crypto", "Notification",
  "PushManager", "WebSocket", "Event", "KeyboardEvent", "MouseEvent", "HTMLElement", "Node", "Element", "CSS",
  "getComputedStyle", "fetch", "btoa", "atob", "structuredClone", "performance", "CustomEvent", "useState",
]);

function unresolved(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  const names = new Set();
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (allowed.has(name) || p.scope.hasBinding(name)) return;
      const parent = p.parentPath;
      if ((parent.isJSXOpeningElement() || parent.isJSXClosingElement()) && parent.node.name === p.node) return;
      names.add(name);
    },
  });
  return [...names].sort();
}

describe("static runtime integrity", () => {
  it("has no unresolved lexical dependencies in production JSX modules", () => {
    const root = path.resolve(process.cwd(), "src");
    const failures = [];
    for (const name of fs.readdirSync(root).filter((x) => x.endsWith(".jsx") && !x.includes(".test."))) {
      const missing = unresolved(path.join(root, name));
      if (missing.length) failures.push(`${name}: ${missing.join(", ")}`);
    }
    expect(failures).toEqual([]);
  });
});
