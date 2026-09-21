import { useCallback, useEffect } from "react";

export function usePeopleSync({ session, supabase, ensureProfile, fetchTeam, fetchConfig, fetchLocks, setTeam, setConfig, setLocks, setProfile, setSyncError }) {
  const loadPeople = useCallback(async (user) => {
    try {
      await ensureProfile(user);
      const [list, cfg, lk] = await Promise.all([fetchTeam(), fetchConfig(), fetchLocks()]);
      setTeam(list);
      setConfig(cfg);
      setLocks(lk);
      setProfile(list.find((p) => p.id === user.id) || null);
    } catch (e) {
      setSyncError(e.message || String(e));
      setProfile(null);
    }
  }, [ensureProfile, fetchTeam, fetchConfig, fetchLocks, setTeam, setConfig, setLocks, setProfile, setSyncError]);

  useEffect(() => {
    if (!session) {
      setProfile(undefined); setTeam([]); setConfig(null); setLocks([]);
      return undefined;
    }
    loadPeople(session.user);
    const ch = supabase.channel("allbee-people")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_config" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fin_locks" }, async () => setLocks(await fetchLocks()));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, supabase, loadPeople, setProfile, setTeam, setConfig, setLocks, fetchLocks]);

  return loadPeople;
}
