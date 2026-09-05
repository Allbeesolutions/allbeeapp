begin;

-- Proposal public surface hardening: never expose internal history, CRM ids,
-- actor metadata, or version snapshots through a customer token.
create or replace function public.proposal_public_projection(p_proposal_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
select jsonb_build_object(
  'proposal',jsonb_build_object(
    'id',p.id,'proposal_number',p.proposal_number,'proposal_title',p.proposal_title,
    'customer_name',p.customer_name,'customer_email',p.customer_email,'customer_phone',p.customer_phone,
    'theme',p.theme,'pricing_mode',p.pricing_mode,'currency',p.currency,'subtotal',p.subtotal,
    'discount_amount',p.discount_amount,'tax_amount',p.tax_amount,'grand_total',p.grand_total,
    'optional_addons',p.optional_addons,'scope',p.scope,'timeline',p.timeline,'status',p.status,
    'current_version',p.current_version,'expires_at',p.expires_at,'public_token_expires_at',p.public_token_expires_at,
    'created_at',p.created_at,'updated_at',p.updated_at,'sent_at',p.sent_at,'viewed_at',p.viewed_at,
    'approved_at',p.approved_at,'rejected_at',p.rejected_at
  ),
  'sections',coalesce((select jsonb_agg(jsonb_build_object(
    'section_key',s.section_key,'name',s.name,'section_type',s.section_type,
    'sort_order',s.sort_order,'enabled',s.enabled,'content',s.content
  ) order by s.sort_order) from public.proposal_sections s where s.proposal_id=p.id
    and s.version_id=(select v.id from public.proposal_versions v where v.proposal_id=p.id and v.version=p.current_version)),'[]'::jsonb),
  'signature',coalesce((select jsonb_build_object('signed',true,'signer_name',s.signer_name,'signer_email',s.signer_email,'version',s.version,'signed_at',s.signed_at)
    from public.proposal_signatures s where s.proposal_id=p.id and s.version=p.current_version order by s.signed_at desc limit 1),jsonb_build_object('signed',false)),
  'public',true
) from public.proposals p where p.id=p_proposal_id;
$$;

revoke execute on function public.proposal_public_projection(uuid) from public,anon,authenticated;
grant execute on function public.proposal_public_projection(uuid) to anon,authenticated;

create or replace function public.proposal_public_get(p_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare pid uuid;
begin
  select id into pid from public.proposals where public_token_hash=md5(trim(p_token)) and public_token_expires_at>now();
  if pid is null then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if;
  update public.proposals set viewed_at=coalesce(viewed_at,now()),status=case when status='sent' then 'viewed' else status end,updated_at=now() where id=pid;
  perform public.proposal_log(pid,'viewed',jsonb_build_object('description','Proposal viewed through customer link.'),'customer');
  return public.proposal_public_projection(pid);
end $$;

create or replace function public.proposal_record_action(
  p_proposal_id uuid,p_action text,p_comment text default '',p_token text default null,
  p_signer_name text default null,p_signer_email text default null,p_signature text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.proposals%rowtype; is_public boolean:=p_token is not null; actor_type text:=case when is_public then 'customer' else 'internal' end; actor_name text:=coalesce(nullif(trim(p_signer_name),''),public.proposal_actor_name());
begin
  if p_action not in ('sent','viewed','approved','rejected','revision_requested','question') then raise exception 'Invalid proposal action.' using errcode='invalid_parameter_value'; end if;
  select * into p from public.proposals where id=p_proposal_id for update;
  if not found then raise exception 'Proposal not found.' using errcode='no_data_found'; end if;
  if is_public then
    if p.public_token_hash<>md5(trim(p_token)) or p.public_token_expires_at<=now() then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if;
    if p_action not in ('viewed','approved','rejected','revision_requested','question') then raise exception 'This proposal action is not available to customers.' using errcode='insufficient_privilege'; end if;
  elsif not public.is_admin() and p.created_by<>auth.uid()::text then raise exception 'Proposal access denied.' using errcode='insufficient_privilege'; end if;
  if p.expires_at is not null and p.expires_at<=now() and p_action in ('approved','rejected','revision_requested') then raise exception 'This proposal has expired.' using errcode='check_violation'; end if;

  if p_action='approved' then
    if is_public then
      if p.status not in ('sent','viewed','revision_requested') then raise exception 'This proposal cannot be approved from its current state.' using errcode='check_violation'; end if;
      if nullif(trim(p_signer_name),'') is null or nullif(trim(p_signer_email),'') is null or nullif(trim(p_signature),'') is null then
        raise exception 'Signer name, signer email, and signature are required for approval.' using errcode='not_null_violation';
      end if;
      if exists(select 1 from public.proposal_signatures where proposal_id=p.id and version=p.current_version) then raise exception 'This proposal version has already been signed.' using errcode='unique_violation'; end if;
    elsif p.status not in ('draft','sent','viewed','revision_requested') then
      raise exception 'This proposal cannot be approved from its current state.' using errcode='check_violation';
    end if;
  elsif p_action='rejected' and p.status not in ('sent','viewed','revision_requested') then raise exception 'This proposal cannot be rejected from its current state.' using errcode='check_violation';
  elsif p_action='revision_requested' and p.status not in ('sent','viewed','revision_requested') then raise exception 'A revision cannot be requested from this proposal state.' using errcode='check_violation';
  elsif p_action='question' and p.status in ('draft','approved','rejected','expired','converted') then raise exception 'Questions are not available for this proposal state.' using errcode='check_violation';
  elsif p_action='sent' and p.status<>'draft' then raise exception 'Only draft proposals can be sent.' using errcode='check_violation';
  end if;

  insert into public.proposal_approvals(proposal_id,version,action,comment,actor_id,actor_name,actor_type)
  values(p.id,p.current_version,p_action,coalesce(p_comment,''),case when is_public then null else auth.uid()::text end,actor_name,actor_type);
  if p_action='approved' then
    update public.proposals set status='approved',approved_at=now(),updated_at=now() where id=p.id;
    if is_public then
      insert into public.proposal_signatures(proposal_id,version,signer_name,signer_email,signature_text,signature_hash)
      values(p.id,p.current_version,trim(p_signer_name),trim(p_signer_email),trim(p_signature),encode(extensions.digest(trim(p_signature)||E'\n'||trim(p_signer_email),'sha256'),'hex'));
    end if;
    perform public.proposal_finalize_approval(p.id);
  elsif p_action='rejected' then update public.proposals set status='rejected',rejected_at=now(),updated_at=now() where id=p.id;
  elsif p_action='revision_requested' then update public.proposals set status='revision_requested',updated_at=now() where id=p.id;
  elsif p_action='sent' then update public.proposals set status='sent',sent_at=coalesce(sent_at,now()),updated_at=now() where id=p.id;
  elsif p_action='viewed' then update public.proposals set status=case when status='sent' then 'viewed' else status end,viewed_at=coalesce(viewed_at,now()),updated_at=now() where id=p.id;
  end if;
  perform public.proposal_log(p.id,p_action,jsonb_build_object('description',coalesce(nullif(p_comment,''),initcap(replace(p_action,'_',' '))),'comment',p_comment),actor_type);
  if is_public then return public.proposal_public_projection(p.id); end if;
  return public.proposal_get(p.id);
end $$;

create or replace function public.proposal_public_action(
  p_token text,p_action text,p_comment text default '',p_signer_name text default null,
  p_signer_email text default null,p_signature text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare pid uuid;
begin
  select id into pid from public.proposals where public_token_hash=md5(trim(p_token)) and public_token_expires_at>now();
  if pid is null then raise exception 'Proposal link is invalid or expired.' using errcode='invalid_authorization_specification'; end if;
  return public.proposal_record_action(pid,p_action,p_comment,p_token,p_signer_name,p_signer_email,p_signature);
end $$;

revoke execute on function public.proposal_public_get(text),public.proposal_public_action(text,text,text,text,text,text) from public,authenticated;
grant execute on function public.proposal_public_get(text),public.proposal_public_action(text,text,text,text,text,text) to anon,authenticated;

commit;
notify pgrst,'reload schema';
