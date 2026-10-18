// Dashboard sections are independent optional read models. A failing Finance
// RPC must not hide CRM and AI cards that were successfully returned.
const optionalDashboardRead = async (supabase, name) => {
  try {
    const response = await supabase.rpc(name);
    if (response?.error) return null;
    return response?.data ?? null;
  } catch {
    return null;
  }
};

export async function fetchDashboardSnapshot(supabase) {
  const [finance, crm, ai] = await Promise.all([
    optionalDashboardRead(supabase, "finance_v5_dashboard"),
    optionalDashboardRead(supabase, "crm_v5_dashboard"),
    optionalDashboardRead(supabase, "ai_get_dashboard"),
  ]);
  return { finance, crm, ai, generatedAt: new Date().toISOString() };
}

export async function fetchFinanceAccountBalances(supabase) {
  const { data, error } = await supabase.rpc("finance_account_balances");
  if (error) throw new Error(error.message || "Could not load authoritative account balances.");
  return data || null;
}
