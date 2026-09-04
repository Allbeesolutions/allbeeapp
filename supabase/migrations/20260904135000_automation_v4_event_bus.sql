begin;
create or replace function public.business_automation_emit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_TABLE_NAME='apn_users' then perform public.business_automation_emit(TG_OP||'_apn_user','apn_users',null,jsonb_build_object('id',new.id,'data',new.data));
 elsif TG_TABLE_NAME='transactions' then perform public.business_automation_emit(TG_OP||'_transaction','transactions',null,jsonb_build_object('id',new.id,'data',new.data));
 else perform public.business_automation_emit(TG_OP||'_'||TG_TABLE_NAME,TG_TABLE_NAME,new.id,'{}'::jsonb); end if;
 return new; end $$;

drop trigger if exists automation_emit_apn on public.apn_users;
create trigger automation_emit_apn after insert or update on public.apn_users for each row execute function public.business_automation_emit_trigger();
drop trigger if exists automation_emit_finance on public.transactions;
create trigger automation_emit_finance after insert or update on public.transactions for each row execute function public.business_automation_emit_trigger();
commit;
notify pgrst,'reload schema';
