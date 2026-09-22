export async function ensureProfile(supabase, user) {
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (data) return;
  const name = user.user_metadata?.name || (user.email ? user.email.split("@")[0] : "Member");
  await supabase.from("profiles").upsert({ id: user.id, name, email: user.email, role: "staff", approved: false }, { onConflict: "id", ignoreDuplicates: true });
}

export async function updateProfile(supabase, id, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
