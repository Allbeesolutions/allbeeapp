export async function fetchTeamRows(supabase, loadTableRows) {
  const rows = await loadTableRows(
    supabase,
    "profiles",
    "id,name,email,role,active,created_at,status,mobile,dob,photo_url,perms,tnc_version,tnc_roles_accepted,approved,designation,last_active,last_login,last_logout,username",
    "created_at", 8000, 1, true, 500, 5000,
  );
  return rows.slice().sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

export async function fetchConfigRows(supabase) {
  const { data, error } = await supabase.from("app_config").select("key,value").in("key", ["tnc_version", "tnc_body", "tnc_roles", "company", "class_sheet_webhook", "ai"]);
  if (error) return {};
  return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

export async function saveConfigRows(supabase, patch) {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value: value == null ? "" : String(value) }));
  const { error } = await supabase.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function fetchFinancialLocks(supabase, loadTableRows) {
  const rows = await loadTableRows(supabase, "fin_locks", "period", "period", 8000, 1, true, 500, 5000);
  return rows.map((row) => row.period).filter(Boolean).sort();
}

export async function lockFinancialPeriod(supabase, period, who) {
  const { error } = await supabase.from("fin_locks").upsert({ period, locked_by: who || null }, { onConflict: "period" });
  if (error) throw new Error(error.message);
}

export async function unlockFinancialPeriod(supabase, period) {
  const { error } = await supabase.from("fin_locks").delete().eq("period", period);
  if (error) throw new Error(error.message);
}
