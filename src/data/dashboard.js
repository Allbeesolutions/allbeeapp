export async function fetchDashboardSnapshot(supabase) {
  const [finance, crm, ai] = await Promise.all([
    supabase.rpc("finance_v5_dashboard"),
    supabase.rpc("crm_v5_dashboard"),
    supabase.rpc("ai_get_dashboard"),
  ]);
  return { finance: finance.data || null, crm: crm.data || null, ai: ai.data || null, generatedAt: new Date().toISOString() };
}

export async function fetchFinanceAccountBalances(supabase) {
  const { data, error } = await supabase.rpc("finance_account_balances");
  if (error) throw new Error(error.message || "Could not load authoritative account balances.");
  return data || null;
}
