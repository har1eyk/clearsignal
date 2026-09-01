create or replace function public.create_testing_request(p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lab_id uuid := (p_payload->>'lab_id')::uuid;
  v_order_id uuid;
  v_order_number text;
  v_sample jsonb;
  v_sample_id uuid;
  v_sample_count integer := jsonb_array_length(p_payload->'samples');
  v_unit_price_cents integer := 35000;
  v_total_price_cents integer := 35000 * v_sample_count;
  v_spend_limit_cents integer := nullif(p_payload->>'spend_less_than_each_cents', '')::integer;
  v_currency text := 'USD';
  v_existing_unit_price_cents integer;
  v_existing_total_price_cents integer;
  v_existing_currency text;
begin
  perform public.require_lab_role(
    v_lab_id,
    array['admin','analyst','reviewer','viewer']::public.lab_role[]
  );

  select id, order_number, unit_price_cents, total_price_cents, currency
  into v_order_id, v_order_number, v_existing_unit_price_cents,
    v_existing_total_price_cents, v_existing_currency
  from public.test_orders
  where lab_id = v_lab_id and idempotency_key = p_idempotency_key;

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

  if v_sample_count < 1 or v_sample_count > 100 then raise exception 'sample count must be between 1 and 100'; end if;
  if v_spend_limit_cents is not null and v_unit_price_cents >= v_spend_limit_cents then
    raise exception 'price cap exceeded';
  end if;

  v_order_number := 'TR-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  perform set_config('app.correlation_id', p_idempotency_key, true);

  insert into public.test_orders(
    lab_id, order_number, idempotency_key, client_name, project_name, purpose,
    catalog_item, catalog_version, unit_price_cents, total_price_cents, currency,
    spend_less_than_each_cents, quote_confirmed_at, created_by
  ) values (
    v_lab_id, v_order_number, p_idempotency_key, p_payload->>'client_name',
    trim(p_payload->>'project_name'), trim(p_payload->>'purpose'),
    'standard_endotoxin_test', '2026-09-01',
    v_unit_price_cents, v_total_price_cents, v_currency,
    v_spend_limit_cents, nullif(p_payload->>'quote_confirmed_at', '')::timestamptz,
    auth.uid()
  ) returning id into v_order_id;

  for v_sample in select * from jsonb_array_elements(p_payload->'samples') loop
    insert into public.samples(
      lab_id, test_order_id, external_id, kind, product_name, product_lot, matrix,
      process_stage, collected_at, collected_by, storage_condition, quantity,
      quantity_unit, endotoxin_limit_eu_ml, maximum_valid_dilution, created_by
    ) values (
      v_lab_id, v_order_id, trim(v_sample->>'external_id'),
      coalesce((v_sample->>'kind')::public.sample_kind, 'original'),
      v_sample->>'product_name', v_sample->>'product_lot', nullif(trim(v_sample->>'matrix'), ''),
      v_sample->>'process_stage', nullif(v_sample->>'collected_at','')::timestamptz,
      v_sample->>'collected_by', v_sample->>'storage_condition',
      nullif(v_sample->>'quantity','')::numeric, v_sample->>'quantity_unit',
      null, null, auth.uid()
    ) returning id into v_sample_id;
    insert into public.sample_events(lab_id, sample_id, event_type, occurred_at, notes, created_by)
    values (v_lab_id, v_sample_id, 'registered', now(), 'Registered through testing request ' || v_order_number, auth.uid());
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'sample_count', v_sample_count,
    'unit_price_cents', v_unit_price_cents,
    'total_price_cents', v_total_price_cents,
    'currency', v_currency
  );
end;
$$;

grant execute on function public.create_testing_request(jsonb, text) to authenticated;
