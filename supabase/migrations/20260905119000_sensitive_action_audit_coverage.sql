begin;

-- Database-side audit coverage for security/financial state changes. This is
-- complementary to explicit user-confirmation logging in Edge Functions: if a
-- write reaches one of these authoritative tables, an immutable sensitive-action
-- event is recorded even when the caller bypasses a particular UI path.
create or replace function public.security_sensitive_change_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare oldj jsonb:='{}'; newj jsonb:='{}'; target text; actor uuid; meta jsonb;
begin
  if TG_OP in ('UPDATE','DELETE') then oldj:=to_jsonb(OLD); end if;
  if TG_OP in ('INSERT','UPDATE') then newj:=to_jsonb(NEW); end if;
  actor:=auth.uid();
  target:=coalesce(nullif(newj->>'id',''),nullif(oldj->>'id',''),nullif(newj->>'partner_id',''),nullif(oldj->>'partner_id',''),nullif(newj->>'project_id',''),nullif(oldj->>'project_id',''),nullif(newj->>'key',''),nullif(oldj->>'key',''));
  meta:=jsonb_strip_nulls(jsonb_build_object(
    'source','database_trigger','table',TG_TABLE_NAME,'operation',TG_OP,
    'actor_authenticated',actor is not null,
    'old_status',oldj->>'status','new_status',newj->>'status',
    'old_role',oldj->>'role','new_role',newj->>'role',
    'partner_id',coalesce(newj->>'partner_id',oldj->>'partner_id'),
    'project_id',coalesce(newj->>'project_id',oldj->>'project_id'),
    'amount',coalesce(newj->>'amount',oldj->>'amount'),
    'received_amount',coalesce(newj->>'received_amount',oldj->>'received_amount'),
    'requested_amount',coalesce(newj->>'requested_amount',oldj->>'requested_amount'),
    'key',coalesce(newj->>'key',oldj->>'key')
  ));
  insert into public.security_sensitive_actions(user_id,action_type,target_id,confirmed,metadata)
  values(actor,'db_change:'||TG_TABLE_NAME||':'||lower(TG_OP),target,true,meta);
  return coalesce(NEW,OLD);
end $$;
revoke execute on function public.security_sensitive_change_trigger() from public,anon,authenticated;

DO $$
declare t text;
  tables text[]:=array['profiles','transactions','apn_withdrawal_requests','crm_revenue_collections','apn_commission_ledger','apn_wallet_transactions','business_automation_queue','apn_agreements','security_sessions','apn_hierarchy_assignments','app_config'];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists security_sensitive_change_%I on public.%I',t,t);
      execute format('create trigger security_sensitive_change_%I after insert or update or delete on public.%I for each row execute function public.security_sensitive_change_trigger()',t,t);
    end if;
  end loop;
end $$;

commit;
notify pgrst,'reload schema';
