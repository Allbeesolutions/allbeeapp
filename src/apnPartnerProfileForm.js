export function apnPartnerProfileForm(partner, stats, target) {
  const level = partner?.level || (partner?.role === "state_head" ? "State Head" : partner?.role === "district_head" ? "District Head" : (stats?.level?.name || "Trainee").replace(/ Partner$/, ""));
  return {
    name: partner.name || "", username: partner.username || "", email: partner.email || "", mobile: partner.mobile || "",
    alternateNumber: partner.alternateNumber || "", gender: partner.gender || "", dob: partner.dob || "",
    country: partner.country || "India", state: partner.state || "Tamil Nadu", district: partner.district || "", taluk: partner.taluk || "",
    city: partner.city || "", pincode: partner.pincode || "", address: partner.address || "",
    status: partner.status || "pending", level, target: partner.target ?? target?.goal ?? "",
    targetMetric: partner.targetMetric || target?.metric || "leads", commissionPct: stats.level.rate,
    attendanceScore: partner.attendanceScore ?? "", notes: partner.notes || partner.reason || "", kycStatus: partner.kycStatus || "Not started",
  };
}
