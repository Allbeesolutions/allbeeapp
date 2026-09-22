export async function fetchDashboardSnapshot(supabase) {
  const [finance, crm, ai] = await Promise.all([
    supabase.rpc("finance_v5_dashboard"),
    supabase.rpc("crm_v5_dashboard"),
    supabase.rpc("ai_get_dashboard"),
  ]);
  return { finance: finance.data || null, crm: crm.data || null, ai: ai.data || null, generatedAt: new Date().toISOString() };
}
