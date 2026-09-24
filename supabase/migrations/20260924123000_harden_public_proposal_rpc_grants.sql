-- Harden public proposal RPC surface: only the token-gated entry points are public.
revoke execute on function public.proposal_public_projection(uuid) from anon, authenticated;
revoke execute on function public.proposal_public_get(text) from authenticated;
revoke execute on function public.proposal_public_action(text,text,text,text,text,text) from authenticated;

grant execute on function public.proposal_public_get(text) to anon;
grant execute on function public.proposal_public_action(text,text,text,text,text,text) to anon;
