import { describe, expect, it } from "vitest";
import { resolvePersonAvatar } from "./avatarResolver.js";
describe("resolvePersonAvatar", () => {
  it("prefers the current canonical profile photo over a historical snapshot", () => expect(resolvePersonAvatar({ people: [{ id: "h1", name: "Haji", photo_url: "live.jpg" }] }, { senderId: "h1", senderName: "Haji" }, "old.jpg")).toBe("live.jpg"));
  it("resolves by normalized name when old records have no id", () => expect(resolvePersonAvatar({ publicOwners: [{ name: "Haji", photo_url: "owner.jpg" }] }, { senderName: " hAjI " })).toBe("owner.jpg"));
  it("resolves APN pictures and only then falls back", () => { expect(resolvePersonAvatar({ apnUsers: [{ id: "p1", name: "Partner", profilePicture: "partner.jpg" }] }, { id: "p1" }, "fallback.jpg")).toBe("partner.jpg"); expect(resolvePersonAvatar({}, { name: "Nobody" }, "fallback.jpg")).toBe("fallback.jpg"); });
});
