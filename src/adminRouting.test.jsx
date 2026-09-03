import { describe, it, expect, beforeEach } from "vitest";
import { parseHash } from "./AllbeeApp.jsx";

describe("Admin routing compatibility", () => {
  beforeEach(() => { window.location.hash = ""; });

  it("keeps the APN admin route canonical", () => {
    expect(parseHash("#/apn").route).toBe("apn");
    expect(parseHash("#/apn").legacyAdmin).toBeUndefined();
  });

  it.each(["#/admin", "#/admin.", "#/admin..", "#/admin..;", "admin..;"])(
    "maps legacy admin spelling %s to the APN admin route",
    (hash) => {
      const parsed = parseHash(hash);
      expect(parsed.route).toBe("apn");
      expect(parsed.legacyAdmin).toBe(true);
    }
  );

  it("does not broaden the alias to unrelated routes", () => {
    expect(parseHash("#/administrator").route).toBe("administrator");
    expect(parseHash("#/adminx").route).toBe("adminx");
  });
});
