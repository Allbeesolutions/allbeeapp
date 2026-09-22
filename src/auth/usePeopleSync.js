import { useCallback, useEffect } from "react";

const PROFILE_COLUMNS = "id,name,email,role,active,created_at,status,mobile,dob,photo_url,perms,tnc_version,tnc_roles_accepted,approved,designation,last_active,last_login,last_logout,username";

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout:" + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function usePeopleSync({ session, supabase, ensureProfile, fetchTeam, fetchConfig, fetchLocks, setTeam, setConfig, setLocks, setProfile, setSyncError }) {
  const loadPeople = useCallback(async (user) => {
    try {
      // Authentication must never be blocked by the full staff/config/finance
      // bootstrap. In particular, APN partners can remain on the loading screen
      // forever if one unrelated table is slow. Resolve the current profile directly
      // first, with a hard timeout. Do not run an unbounded ensureProfile request
      // before this critical read.
      let { data: ownProfile, error: profileError } = await withTimeout(
        supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
        10000,
        "profile"
      );
      if (profileError) throw profileError;

      // Only provision a missing profile as a recovery path, and bound both the
      // provisioning request and the verification read. Existing APN profiles
      // therefore never depend on an upsert before authentication can continue.
      if (!ownProfile) {
        await withTimeout(ensureProfile(supabase, user), 10000, "ensure-profile");
        const retry = await withTimeout(
          supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
          10000,
          "profile-retry"
        );
        ownProfile = retry.data;
        if (retry.error) throw retry.error;
      }
      if (!ownProfile) throw new Error("Your account profile could not be loaded. Please sign out and sign in again.");
      setProfile(ownProfile);
      setSyncError(null);

      // Secondary workspace datasets load independently. They are not allowed to
      // hold the authenticated shell or APN portal behind a global Promise.all.
      const results = await Promise.allSettled([fetchTeam(), fetchConfig(), fetchLocks()]);
      const [teamResult, configResult, locksResult] = results;
      if (teamResult.status === "fulfilled") setTeam(teamResult.value);
      if (configResult.status === "fulfilled") setConfig(configResult.value);
      if (locksResult.status === "fulfilled") setLocks(locksResult.value);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.reason) console.warn("[ALLBEE] secondary people/config sync failed:", failed.reason);
    } catch (e) {
      setSyncError(e.message || String(e));
      setProfile(null);
    }
  }, [ensureProfile, supabase, fetchTeam, fetchConfig, fetchLocks, setTeam, setConfig, setLocks, setProfile, setSyncError]);

  useEffect(() => {
    if (!session) {
      setProfile(undefined); setTeam([]); setConfig(null); setLocks([]);
      return undefined;
    }
    loadPeople(session.user);
    const ch = supabase.channel("allbee-people")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_config" }, () => loadPeople(session.user))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fin_locks" }, async () => setLocks(await fetchLocks()));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, supabase, loadPeople, setProfile, setTeam, setConfig, setLocks, fetchLocks]);

  return loadPeople;
}
