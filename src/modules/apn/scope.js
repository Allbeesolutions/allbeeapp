export const apnDistrictHeadMembers = (db, meRow) => {
  const rows = db.apn_hierarchy_assignments || [];
  const assigned = new Set(rows.filter((r) => r.district_head_id === meRow.id && r.status !== "inactive").map((r) => r.partner_id));
  const district = meRow.district || "";
  return (db.apn_users || []).filter((u) => u.id !== meRow.id && u.role === "partner" && u.status !== "rejected" && u.status !== "banned" && (assigned.has(u.id) || (!assigned.size && u.district === district)));
};
export const apnStateScope = (db, meRow) => {
  const rows = db.apn_hierarchy_assignments || [];
  const assigned = new Set(rows.filter((r) => r.state_head_id === meRow.id && r.status !== "reassigned").map((r) => r.partner_id));
  const state = String(meRow.state || "").trim().toLowerCase();
  const namespace = String(meRow.apnId || "").toUpperCase().split("-").slice(0, 2).join("-");
  const districts = new Set((db.apn_users || []).filter((u) => u.role === "district_head" && state && String(u.state || "").trim().toLowerCase() === state).map((u) => u.district).filter(Boolean));
  return (db.apn_users || []).filter((u) => {
    if (u.id === meRow.id || u.role !== "partner" || u.status === "rejected" || u.status === "banned") return false;
    const uState = String(u.state || "").trim().toLowerCase();
    const uNamespace = String(u.apnId || "").toUpperCase().split("-").slice(0, 2).join("-");
    return assigned.has(u.id) || (state && uState === state) || (districts.has(u.district)) || (namespace && uNamespace === namespace);
  });
};
