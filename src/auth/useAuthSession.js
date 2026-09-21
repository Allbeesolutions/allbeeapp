import { useEffect } from "react";
export function useAuthSession({ supabase, setSession, setPasswordRecovery, setSyncError, appendAuditEvent, authRecoveryRef }) {
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setSyncError(error.message || "Could not restore your session."); return; }
      setSession(data.session ?? null);
    }).catch((e) => { if (mounted) setSyncError(e?.message || "Could not restore your session."); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_IN" && session?.user) {
        supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", session.user.id).then(() => {}, () => {});
        const actor = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "System";
        appendAuditEvent({ user:actor,userId:session.user.id,action:"logged in",module:"System",entity:"Authentication",description:`${actor} logged in` }).catch(() => {});
      }
      if (event === "SIGNED_OUT") authRecoveryRef.current = false;
      setSession((prev) => {
        const prevId = prev?.user?.id || null;
        const nextId = session?.user?.id || null;
        if (prevId === nextId) return prev;
        return session ?? null;
      });
    });
    return () => { mounted=false; sub.subscription.unsubscribe(); };
  }, [supabase, setSession, setPasswordRecovery, setSyncError, appendAuditEvent, authRecoveryRef]);
}
