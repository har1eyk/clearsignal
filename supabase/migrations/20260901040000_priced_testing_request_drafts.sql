create table public.testing_request_drafts (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  request_payload jsonb not null,
  status text not null default 'unpriced' check (status in ('unpriced', 'converted')),
  test_order_id uuid unique references public.test_orders(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  converted_at timestamptz,
  check (jsonb_typeof(request_payload) = 'object'),
  check (
    (status = 'unpriced' and test_order_id is null and converted_at is null)
    or (status = 'converted' and test_order_id is not null and converted_at is not null)
  )
);

create index testing_request_drafts_lab_created_idx
  on public.testing_request_drafts(lab_id, created_at desc);

alter table public.testing_request_drafts enable row level security;
revoke all on public.testing_request_drafts from anon, authenticated;
grant select on public.testing_request_drafts to authenticated;
create policy read_lab_testing_request_drafts
  on public.testing_request_drafts for select to authenticated
  using (public.has_lab_role(lab_id, array['admin','analyst','reviewer','viewer']::public.lab_role[]));

create trigger audit_testing_request_drafts
after insert or update or delete on public.testing_request_drafts
for each row execute function public.audit_row_change();

create trigger reject_delete_testing_request_drafts
before delete on public.testing_request_drafts
for each row execute function public.reject_delete();

create or replace function public.create_testing_request_draft(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lab_id uuid := (p_payload->>'lab_id')::uuid;
  v_draft_id uuid;
  v_sample_count integer;
begin
  perform public.require_lab_role(
    v_lab_id,
    array['admin','analyst','reviewer','viewer']::public.lab_role[]
  );

  if nullif(trim(p_payload->>'project_name'), '') is null then
    raise exception 'project name is required';
  end if;
  if nullif(trim(p_payload->>'purpose'), '') is null then
    raise exception 'testing purpose is required';
  end if;
  if jsonb_typeof(p_payload->'samples') <> 'array' then
    raise exception 'samples must be an array';
  end if;

  v_sample_count := jsonb_array_length(p_payload->'samples');
  if v_sample_count < 1 or v_sample_count > 100 then
    raise exception 'sample count must be between 1 and 100';
  end if;

  insert into public.testing_request_drafts(lab_id, request_payload, created_by)
  values (v_lab_id, p_payload, auth.uid())
  returning id into v_draft_id;

  return v_draft_id;
end;
$$;

create or replace function public.confirm_testing_request_draft(
  p_draft_id uuid,
  p_idempotency_key text,
  p_catalog_item text,
  p_catalog_version text,
  p_unit_price_cents integer,
  p_total_price_cents integer,
  p_currency text,
  p_spend_less_than_each_cents integer,
  p_quote_confirmed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.testing_request_drafts%rowtype;
  v_payload jsonb;
  v_order_id uuid;
  v_order_number text;
  v_sample jsonb;
  v_sample_id uuid;
  v_sample_count integer;
  v_existing_unit_price_cents integer;
  v_existing_total_price_cents integer;
  v_existing_currency text;
begin
  select * into v_draft
  from public.testing_request_drafts
  where id = p_draft_id
  for update;

  if v_draft.id is null then raise exception 'testing request draft not found' using errcode = 'P0002'; end if;
  perform public.require_lab_role(
    v_draft.lab_id,
    array['admin','analyst','reviewer','viewer']::public.lab_role[]
  );
  if v_draft.created_by <> auth.uid() then raise exception 'testing request draft belongs to another user' using errcode = '42501'; end if;

  if v_draft.status = 'converted' then
    select id, order_number, unit_price_cents, total_price_cents, currency
      into v_order_id, v_order_number, v_existing_unit_price_cents,
        v_existing_total_price_cents, v_existing_currency
    from public.test_orders
    where id = v_draft.test_order_id;
    select count(*) into v_sample_count from public.samples where test_order_id = v_order_id;
    return jsonb_build_object(
      'id', v_order_id,
      'order_number', v_order_number,
      'sample_count', v_sample_count,
      'unit_price_cents', v_existing_unit_price_cents,
      'total_price_cents', v_existing_total_price_cents,
      'currency', v_existing_currency
    );
  end if;

  if v_draft.status <> 'unpriced' then raise exception 'testing request draft cannot be converted'; end if;
  if length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 160 then
    raise exception 'invalid idempotency key';
  end if;
  if p_catalog_item <> 'standard_endotoxin_test' then raise exception 'unsupported catalog item'; end if;
  if p_catalog_version <> '2026-09-01' then raise exception 'catalog version changed'; end if;
  if p_currency <> 'USD' then raise exception 'unsupported currency'; end if;
  -- This immutable catalog-version snapshot prevents direct RPC callers from
  -- substituting a price. Application quotes originate from unitPriceCents in
  -- lib/lab/endotoxin-order.ts and must match this persisted catalog version.
  if p_unit_price_cents <> 37500 then raise exception 'catalog unit price changed'; end if;

  v_payload := v_draft.request_payload;
  v_sample_count := jsonb_array_length(v_payload->'samples');
  if p_total_price_cents <> p_unit_price_cents * v_sample_count then
    raise exception 'quoted total does not match unit price times sample count';
  end if;
  if p_spend_less_than_each_cents is not null and p_unit_price_cents >= p_spend_less_than_each_cents then
    raise exception 'price cap exceeded';
  end if;
  if p_quote_confirmed_at is null then raise exception 'quote confirmation is required'; end if;

  select id, order_number, unit_price_cents, total_price_cents, currency
    into v_order_id, v_order_number, v_existing_unit_price_cents,
      v_existing_total_price_cents, v_existing_currency
  from public.test_orders
  where lab_id = v_draft.lab_id and idempotency_key = p_idempotency_key;

  if v_order_id is not null then
    select count(*) into v_sample_count from public.samples where test_order_id = v_order_id;
    return jsonb_build_object(
      'id', v_order_id,
      'order_number', v_order_number,
      'sample_count', v_sample_count,
      'unit_price_cents', v_existing_unit_price_cents,
      'total_price_cents', v_existing_total_price_cents,
      'currency', v_existing_currency
    );
  end if;

  v_order_number := 'TR-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  perform set_config('app.correlation_id', p_idempotency_key, true);

  insert into public.test_orders(
    lab_id, order_number, idempotency_key, client_name, project_name, purpose,
    catalog_item, catalog_version, unit_price_cents, total_price_cents, currency,
    spend_less_than_each_cents, quote_confirmed_at, created_by
  ) values (
    v_draft.lab_id, v_order_number, p_idempotency_key, v_payload->>'client_name',
    trim(v_payload->>'project_name'), trim(v_payload->>'purpose'),
    p_catalog_item, p_catalog_version, p_unit_price_cents, p_total_price_cents,
    p_currency, p_spend_less_than_each_cents, p_quote_confirmed_at, auth.uid()
  ) returning id into v_order_id;

  for v_sample in select * from jsonb_array_elements(v_payload->'samples') loop
    insert into public.samples(
      lab_id, test_order_id, external_id, kind, product_name, product_lot, matrix,
      process_stage, collected_at, collected_by, storage_condition, quantity,
      quantity_unit, endotoxin_limit_eu_ml, maximum_valid_dilution, created_by
    ) values (
      v_draft.lab_id, v_order_id, trim(v_sample->>'external_id'),
      coalesce((v_sample->>'kind')::public.sample_kind, 'original'),
      v_sample->>'product_name', v_sample->>'product_lot', nullif(trim(v_sample->>'matrix'), ''),
      v_sample->>'process_stage', nullif(v_sample->>'collected_at','')::timestamptz,
      v_sample->>'collected_by', v_sample->>'storage_condition',
      nullif(v_sample->>'quantity','')::numeric, v_sample->>'quantity_unit',
      null, null, auth.uid()
    ) returning id into v_sample_id;
    insert into public.sample_events(lab_id, sample_id, event_type, occurred_at, notes, created_by)
    values (v_draft.lab_id, v_sample_id, 'registered', now(), 'Registered through testing request ' || v_order_number, auth.uid());
  end loop;

  update public.testing_request_drafts
  set status = 'converted', test_order_id = v_order_id, converted_at = now()
  where id = v_draft.id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'sample_count', v_sample_count,
    'unit_price_cents', p_unit_price_cents,
    'total_price_cents', p_total_price_cents,
    'currency', p_currency
  );
end;
$$;

revoke execute on function public.create_testing_request(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_testing_request_draft(jsonb) from public, anon;
grant execute on function public.create_testing_request_draft(jsonb) to authenticated;
revoke all on function public.confirm_testing_request_draft(uuid, text, text, text, integer, integer, text, integer, timestamptz) from public, anon;
grant execute on function public.confirm_testing_request_draft(uuid, text, text, text, integer, integer, text, integer, timestamptz) to authenticated;
