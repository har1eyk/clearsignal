alter table public.test_orders
  add column idempotency_key text;

create unique index test_orders_lab_idempotency_idx
  on public.test_orders(lab_id, idempotency_key)
  where idempotency_key is not null;

alter table public.samples
  alter column endotoxin_limit_eu_ml drop not null,
  alter column maximum_valid_dilution drop not null;

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
  v_sample_count integer := 0;
begin
  perform public.require_lab_role(
    v_lab_id,
    array['admin','analyst','reviewer','viewer']::public.lab_role[]
  );

  select id, order_number into v_order_id, v_order_number
  from public.test_orders
  where lab_id = v_lab_id and idempotency_key = p_idempotency_key;

  if v_order_id is not null then
    select count(*) into v_sample_count
    from public.samples where test_order_id = v_order_id;
    return jsonb_build_object(
      'id', v_order_id,
      'order_number', v_order_number,
      'sample_count', v_sample_count
    );
  end if;

  v_order_number := 'TR-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  perform set_config('app.correlation_id', p_idempotency_key, true);

  insert into public.test_orders(
    lab_id, order_number, idempotency_key, client_name, project_name, purpose, created_by
  ) values (
    v_lab_id, v_order_number, p_idempotency_key, p_payload->>'client_name',
    trim(p_payload->>'project_name'), trim(p_payload->>'purpose'), auth.uid()
  ) returning id into v_order_id;

  for v_sample in select * from jsonb_array_elements(p_payload->'samples') loop
    insert into public.samples(
      lab_id, test_order_id, external_id, kind, product_name, product_lot, matrix,
      process_stage, collected_at, collected_by, storage_condition, quantity,
      quantity_unit, endotoxin_limit_eu_ml, maximum_valid_dilution, created_by
    ) values (
      v_lab_id, v_order_id, trim(v_sample->>'external_id'),
      coalesce((v_sample->>'kind')::public.sample_kind, 'original'),
      v_sample->>'product_name', v_sample->>'product_lot', trim(v_sample->>'matrix'),
      v_sample->>'process_stage', nullif(v_sample->>'collected_at','')::timestamptz,
      v_sample->>'collected_by', v_sample->>'storage_condition',
      nullif(v_sample->>'quantity','')::numeric, v_sample->>'quantity_unit',
      null, null, auth.uid()
    ) returning id into v_sample_id;
    insert into public.sample_events(lab_id, sample_id, event_type, occurred_at, notes, created_by)
    values (
      v_lab_id,
      v_sample_id,
      'registered', now(), 'Registered through testing request ' || v_order_number, auth.uid()
    );
    v_sample_count := v_sample_count + 1;
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'sample_count', v_sample_count
  );
end;
$$;

create or replace function public.set_sample_specification(
  p_sample_id uuid,
  p_endotoxin_limit_eu_ml numeric,
  p_maximum_valid_dilution numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sample public.samples%rowtype;
begin
  select * into v_sample from public.samples where id = p_sample_id;
  if not found then raise exception 'sample not found'; end if;
  perform public.require_lab_role(v_sample.lab_id, array['admin','analyst']::public.lab_role[]);
  if p_endotoxin_limit_eu_ml < 0 then raise exception 'endotoxin limit must be nonnegative'; end if;
  if p_maximum_valid_dilution < 1 then raise exception 'maximum valid dilution must be at least 1'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'a change reason is required'; end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update public.samples set
    endotoxin_limit_eu_ml = p_endotoxin_limit_eu_ml,
    maximum_valid_dilution = p_maximum_valid_dilution,
    updated_at = now()
  where id = p_sample_id;
  return p_sample_id;
end;
$$;

create or replace function public.create_assay_run(p_payload jsonb, p_idempotency_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lab_id uuid := (p_payload->>'lab_id')::uuid;
  v_id uuid;
  v_sample jsonb;
begin
  perform public.require_lab_role(v_lab_id, array['admin','analyst']::public.lab_role[]);
  if p_idempotency_key is not null then
    select id into v_id from public.assay_runs where lab_id = v_lab_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
  end if;
  if not exists (
    select 1 from public.method_versions m
    left join public.sop_versions sop on sop.id = m.sop_version_id
    where m.id = (p_payload->>'method_version_id')::uuid and m.lab_id = v_lab_id and m.status = 'active'
      and (m.sop_version_id is null or sop.status = 'active')
  ) then raise exception 'method version must be active'; end if;
  if not exists (
    select 1 from public.instruments i
    where i.id = (p_payload->>'instrument_id')::uuid and i.lab_id = v_lab_id and i.status = 'active'
  ) then raise exception 'instrument must be active'; end if;
  if not exists (
    select 1 from public.instrument_events ie
    where ie.instrument_id = (p_payload->>'instrument_id')::uuid
      and ie.event_type in ('calibration','qualification')
      and (ie.due_at is null or ie.due_at >= now())
  ) then raise exception 'instrument has no current calibration or qualification record'; end if;
  if not exists (
    select 1 from public.material_lots ml
    where ml.id = (p_payload->>'reagent_lot_id')::uuid and ml.lab_id = v_lab_id
      and ml.material_type = 'rfc_reagent' and ml.status = 'active'
      and (ml.expires_at is null or ml.expires_at >= now())
  ) then raise exception 'rFC reagent lot must be active and unexpired'; end if;
  if not exists (
    select 1 from public.material_lots ml
    where ml.id = (p_payload->>'standard_lot_id')::uuid and ml.lab_id = v_lab_id
      and ml.material_type = 'control_standard_endotoxin' and ml.status = 'active'
      and (ml.expires_at is null or ml.expires_at >= now())
  ) then raise exception 'control standard lot must be active and unexpired'; end if;
  perform set_config('app.correlation_id', coalesce(p_idempotency_key, ''), true);
  insert into public.assay_runs(
    lab_id, run_number, idempotency_key, method_version_id, instrument_id,
    reagent_lot_id, standard_lot_id, plate_format, supersedes_run_id, notes, created_by
  ) values (
    v_lab_id, trim(p_payload->>'run_number'), p_idempotency_key,
    (p_payload->>'method_version_id')::uuid, (p_payload->>'instrument_id')::uuid,
    (p_payload->>'reagent_lot_id')::uuid, (p_payload->>'standard_lot_id')::uuid,
    (p_payload->>'plate_format')::integer, nullif(p_payload->>'supersedes_run_id','')::uuid,
    p_payload->>'notes', auth.uid()
  ) returning id into v_id;
  for v_sample in select * from jsonb_array_elements(coalesce(p_payload->'samples', '[]'::jsonb)) loop
    if not exists (
      select 1 from public.samples s
      where s.id = (v_sample->>'sample_id')::uuid and s.lab_id = v_lab_id
        and s.endotoxin_limit_eu_ml is not null and s.maximum_valid_dilution is not null
    ) then raise exception 'sample is not in this laboratory or is missing its endotoxin specification'; end if;
    insert into public.run_samples(lab_id, run_id, sample_id, planned_dilution, created_by)
    values (v_lab_id, v_id, (v_sample->>'sample_id')::uuid, (v_sample->>'planned_dilution')::numeric, auth.uid());
  end loop;
  return v_id;
end;
$$;

grant execute on function public.create_testing_request(jsonb, text) to authenticated;
grant execute on function public.set_sample_specification(uuid, numeric, numeric, text) to authenticated;
