-- Fix State Head scope: APN identity is authoritative for APN roles.
-- The legacy profiles row can still say partner for an APN State Head.
create or replace function public.apn_state_head_scope(p_data jsonb)
returns boolean
language sql stable security definer set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.apn_users me
    where me.id = auth.uid()::text
      and me.data->>'role' = 'state_head'
      and coalesce(me.data->>'status','active') not in ('suspended','terminated','rejected','deleted','banned')
      and (
        exists (select 1 from public.apn_hierarchy_assignments h
          where h.partner_id = coalesce(p_data->>'id','')
            and h.state_head_id = auth.uid()::text
            and h.status = 'active')
        or (nullif(trim(p_data->>'state'),'') is not null
          and lower(trim(p_data->>'state')) = lower(trim(coalesce(me.data->>'state',''))))
        or (nullif(trim(p_data->>'apnId'),'') is not null
          and nullif(trim(me.data->>'apnId'),'') is not null
          and split_part(upper(trim(p_data->>'apnId')), '-', 2) = split_part(upper(trim(me.data->>'apnId')),'-',2))
      )
  );
$$;
