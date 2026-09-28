import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("profile avatar synchronization", () => {
  it("uses authoritative photos throughout APN chat identity surfaces", () => {
    const source = fs.readFileSync("src/APNTeamChat.jsx", "utf8");
    expect(source).toContain("const myPhoto = profile?.photo_url");
    expect(source).toContain("url={myPhoto}");
    expect(source).toContain("contactForConversation(c)?.photo_url");
    expect(source).toContain("contactForConversation(selected)?.photo_url");
    expect(source).toContain('select("id,photo_url")');
  });
  it("uses partner photos in APN network/head cards", () => {
    const network = fs.readFileSync("src/APNNetwork.jsx", "utf8");
    const head = fs.readFileSync("src/modules/apn/HeadPartnerCard.jsx", "utf8");
    expect(network).toContain("u?.profilePicture || u?.photo_url || u?.photoUrl");
    expect(head).toContain("partner.profilePicture || partner.photo_url || partner.photoUrl");
  });
  it("keeps initials underneath photos as the global broken-image fallback", () => {
    const source = fs.readFileSync("src/AllbeeApp.jsx", "utf8");
    expect(source).toContain('onError={(e) => { e.currentTarget.style.display = "none"; }}');
    expect(source).toContain('<span aria-hidden="true">{(name || "?")[0]}</span>');
  });
});
