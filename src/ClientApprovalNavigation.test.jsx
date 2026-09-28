import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("client approval navigation contract", () => {
  const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");
  const clients = fs.readFileSync("src/Clients.jsx", "utf8");
  it("keeps client approvals out of Team and exposes them in Clients", () => {
    expect(app).toContain('const pending = team.filter((p) => p.role === "staff" && p.approved === false)');
    expect(clients).toContain(">Approve</button>");
    expect(clients).toContain(">Reject</button>");
    expect(clients).toContain(">Reconsider</button>");
    expect(app).toContain('key === "clients" && <ActionBadge count={newClientRegistrations}');
  });
  it("acknowledges the client nav notification when Clients is opened", () => {
    expect(app).toContain('localStorage.setItem("allbee_clients_seen_at"');
    expect(app).toContain('new Date(row.created_at || 0).getTime() > clientsSeenAt');
  });
});
