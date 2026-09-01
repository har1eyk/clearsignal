-- ClearSignal rFC laboratory backend
-- Research prototype with GLP-style traceability. This migration does not
-- assert regulatory validation or 21 CFR Part 11 compliance.

create extension if not exists pgcrypto;

create type public.lab_role as enum ('admin', 'analyst', 'reviewer', 'viewer');
create type public.membership_status as enum ('active', 'inactive');
create type public.controlled_status as enum ('draft', 'active', 'retired');
create type public.curve_model as enum ('linear', 'log10-linear');
create type public.sample_status as enum ('registered', 'received', 'in_storage', 'in_testing', 'consumed', 'disposed');
create type public.sample_kind as enum ('original', 'aliquot', 'pool');
create type public.run_status as enum ('draft', 'in_progress', 'calculated', 'submitted', 'approved', 'rejected', 'invalidated');
create type public.well_role as enum ('blank', 'standard', 'sample', 'ppc');
create type public.result_qualifier as enum ('within_range', 'below_lloq', 'above_uloq', 'invalid');
create type public.specification_decision as enum ('pass', 'fail', 'not_reportable');
create type public.review_decision as enum ('approve', 'reject', 'invalidate');

create table public.laboratories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lab_memberships (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.lab_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (lab_id, user_id)
);
create index lab_memberships_user_idx on public.lab_memberships(user_id, status);

create table public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  sop_code text not null,
  title text not null,
  version text not null,
  status public.controlled_status not null default 'draft',
  effective_at timestamptz,
  retired_at timestamptz,
  document_uri text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (lab_id, sop_code, version),
  check ((status <> 'active') or effective_at is not null)
);

create table public.method_versions (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  sop_version_id uuid references public.sop_versions(id),
  method_code text not null,
  name text not null,
  version text not null,
  status public.controlled_status not null default 'draft',
  curve_model public.curve_model not null,
  standard_min_eu_ml numeric not null check (standard_min_eu_ml > 0),
  standard_max_eu_ml numeric not null check (standard_max_eu_ml > standard_min_eu_ml),
  r2_min numeric not null check (r2_min between 0 and 1),
  replicate_cv_max_pct numeric not null check (replicate_cv_max_pct >= 0),
  ppc_recovery_min_pct numeric not null check (ppc_recovery_min_pct >= 0),
  ppc_recovery_max_pct numeric not null check (ppc_recovery_max_pct > ppc_recovery_min_pct),
  blank_max_rfu numeric not null check (blank_max_rfu >= 0),
  notes text,
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (lab_id, method_code, version),
  check ((status <> 'active') or effective_at is not null)
);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  instrument_code text not null,
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  status public.controlled_status not null default 'draft',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (lab_id, instrument_code),
  unique (lab_id, serial_number)
);

create table public.instrument_events (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  instrument_id uuid not null references public.instruments(id),
  event_type text not null check (event_type in ('calibration', 'qualification', 'maintenance', 'repair', 'inspection')),
  performed_at timestamptz not null,
  due_at timestamptz,
  outcome text not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table public.material_lots (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  material_type text not null check (material_type in ('rfc_reagent', 'control_standard_endotoxin', 'water', 'consumable', 'other')),
  name text not null,
  manufacturer text,
  catalog_number text,
  lot_number text not null,
  concentration numeric,
  concentration_unit text,
  received_at timestamptz,
  opened_at timestamptz,
  expires_at timestamptz,
  storage_condition text,
  status public.controlled_status not null default 'draft',
  certificate_uri text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (lab_id, material_type, lot_number)
);

create table public.test_orders (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  order_number text not null,
  client_name text,
  project_name text,
  purpose text,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (lab_id, order_number)
);

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  test_order_id uuid references public.test_orders(id),
  external_id text not null,
  kind public.sample_kind not null default 'original',
  product_name text,
  product_lot text,
  matrix text not null,
  process_stage text,
  collected_at timestamptz,
  collected_by text,
  received_at timestamptz,
  received_by uuid references auth.users(id),
  receipt_condition text,
  storage_condition text,
  quantity numeric check (quantity is null or quantity >= 0),
  quantity_unit text,
  endotoxin_limit_eu_ml numeric not null check (endotoxin_limit_eu_ml >= 0),
  maximum_valid_dilution numeric not null check (maximum_valid_dilution >= 1),
  status public.sample_status not null default 'registered',
  disposition_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (lab_id, external_id)
);
create index samples_lab_status_idx on public.samples(lab_id, status, created_at desc);

create table public.sample_components (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  derived_sample_id uuid not null references public.samples(id),
  source_sample_id uuid not null references public.samples(id),
  amount numeric,
  amount_unit text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (derived_sample_id, source_sample_id),
  check (derived_sample_id <> source_sample_id)
);

create table public.sample_events (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  sample_id uuid not null references public.samples(id),
  event_type text not null check (event_type in ('registered', 'received', 'transferred', 'aliquoted', 'pooled', 'stored', 'removed', 'consumed', 'disposed', 'condition_noted')),
  occurred_at timestamptz not null,
  location text,
  condition text,
  quantity numeric,
  quantity_unit text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index sample_events_sample_time_idx on public.sample_events(sample_id, occurred_at, created_at);

create table public.assay_runs (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_number text not null,
  idempotency_key text,
  method_version_id uuid not null references public.method_versions(id),
  instrument_id uuid not null references public.instruments(id),
  reagent_lot_id uuid not null references public.material_lots(id),
  standard_lot_id uuid not null references public.material_lots(id),
  plate_format integer not null check (plate_format in (96, 384)),
  status public.run_status not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  report_snapshot jsonb,
  supersedes_run_id uuid references public.assay_runs(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (lab_id, run_number),
  unique (lab_id, idempotency_key)
);
create index assay_runs_lab_status_idx on public.assay_runs(lab_id, status, created_at desc);

create table public.run_samples (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  sample_id uuid not null references public.samples(id),
  planned_dilution numeric not null check (planned_dilution >= 1),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (run_id, sample_id)
);

create table public.raw_artifacts (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  idempotency_key text,
  storage_bucket text not null default 'assay-raw-data',
  storage_path text not null,
  storage_version text,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references auth.users(id),
  unique (storage_bucket, storage_path),
  unique (run_id, idempotency_key)
);

create table public.plate_wells (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  well text not null,
  role public.well_role not null,
  sample_id uuid references public.samples(id),
  replicate integer not null check (replicate >= 1),
  dilution_factor numeric not null default 1 check (dilution_factor >= 1),
  standard_eu_ml numeric check (standard_eu_ml is null or standard_eu_ml > 0),
  spike_eu_ml numeric check (spike_eu_ml is null or spike_eu_ml > 0),
  source_artifact_id uuid references public.raw_artifacts(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (run_id, well),
  check (
    (role = 'blank' and sample_id is null and standard_eu_ml is null and spike_eu_ml is null)
    or (role = 'standard' and sample_id is null and standard_eu_ml is not null and spike_eu_ml is null)
    or (role = 'sample' and sample_id is not null and standard_eu_ml is null and spike_eu_ml is null)
    or (role = 'ppc' and sample_id is not null and standard_eu_ml is null and spike_eu_ml is not null)
  )
);

create table public.endpoint_readings (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  plate_well_id uuid not null references public.plate_wells(id),
  fluorescence_rfu numeric not null check (fluorescence_rfu >= 0),
  entered_at timestamptz not null default now(),
  entered_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (plate_well_id)
);

create table public.deviations (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid references public.assay_runs(id),
  sample_id uuid references public.samples(id),
  deviation_code text not null,
  description text not null,
  impact_assessment text,
  resolution text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  check (run_id is not null or sample_id is not null)
);

create table public.calculation_revisions (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  revision integer not null,
  idempotency_key text,
  input_sha256 text not null check (input_sha256 ~ '^[a-f0-9]{64}$'),
  is_valid boolean not null,
  diagnostics jsonb not null,
  curve_parameters jsonb,
  calculated_at timestamptz not null default now(),
  calculated_by uuid not null references auth.users(id),
  unique (run_id, revision),
  unique (run_id, idempotency_key)
);

create table public.sample_results (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  calculation_revision_id uuid not null references public.calculation_revisions(id),
  run_id uuid not null references public.assay_runs(id),
  sample_id uuid not null references public.samples(id),
  measured_eu_ml numeric,
  corrected_eu_ml numeric,
  qualifier public.result_qualifier not null,
  ppc_recovery_pct numeric,
  replicate_cv_pct numeric,
  specification_decision public.specification_decision not null,
  validity_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (calculation_revision_id, sample_id)
);

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.laboratories(id),
  run_id uuid not null references public.assay_runs(id),
  idempotency_key text,
  decision public.review_decision not null,
  meaning text not null,
  comment text,
  report_snapshot jsonb,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null references auth.users(id),
  unique (run_id, idempotency_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  lab_id uuid,
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  operation text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  correlation_id text,
  transaction_id bigint not null default txid_current()
);
create index audit_events_entity_idx on public.audit_events(lab_id, entity_type, entity_id, occurred_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.has_lab_role(p_lab_id uuid, p_roles public.lab_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lab_memberships m
    where m.lab_id = p_lab_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create or replace function public.require_lab_role(p_lab_id uuid, p_roles public.lab_role[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_lab_role(p_lab_id, p_roles) then
    raise exception 'not authorized for laboratory' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.bootstrap_lab_admin(p_user_id uuid, p_lab_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_lab_id uuid;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'auth user does not exist';
  end if;
  insert into public.laboratories(name, created_by)
  values (trim(p_lab_name), p_user_id)
  returning id into v_lab_id;
  insert into public.lab_memberships(lab_id, user_id, role, created_by)
  values (v_lab_id, p_user_id, 'admin', p_user_id);
  return v_lab_id;
end;
$$;
revoke all on function public.bootstrap_lab_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_lab_admin(uuid, text) to service_role;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_lab_id uuid;
  v_entity_id uuid;
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_lab_id := coalesce((v_after->>'lab_id')::uuid, (v_before->>'lab_id')::uuid);
  v_entity_id := coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid);
  insert into public.audit_events(
    lab_id, actor_id, operation, entity_type, entity_id, before_data, after_data,
    reason, correlation_id
  ) values (
    v_lab_id, auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_before, v_after,
    nullif(current_setting('app.change_reason', true), ''),
    nullif(current_setting('app.correlation_id', true), '')
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.reject_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard deletes are disabled for %', tg_table_name using errcode = '55000';
end;
$$;

create or replace function public.guard_run_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'invalidated' then
    raise exception 'approved or invalidated assay runs are immutable' using errcode = '55000';
  end if;
  if old.status = 'approved' and not (
    new.status = 'invalidated'
    and to_jsonb(new) - array['status','updated_at'] = to_jsonb(old) - array['status','updated_at']
  ) then
    raise exception 'approved assay runs may only be invalidated' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_sop_version(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_lab_id uuid := (p_payload->>'lab_id')::uuid; v_id uuid;
begin
  perform public.require_lab_role(v_lab_id, array['admin']::public.lab_role[]);
  insert into public.sop_versions(
    lab_id, sop_code, title, version, document_uri, content_sha256, created_by
  ) values (
    v_lab_id, trim(p_payload->>'sop_code'), trim(p_payload->>'title'),
    trim(p_payload->>'version'), p_payload->>'document_uri',
    nullif(p_payload->>'content_sha256',''), auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_sop_status(p_id uuid, p_status public.controlled_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.sop_versions%rowtype;
begin
  select * into v_row from public.sop_versions where id = p_id for update;
  if not found then raise exception 'SOP version not found'; end if;
  perform public.require_lab_role(v_row.lab_id, array['admin']::public.lab_role[]);
  if not ((v_row.status = 'draft' and p_status = 'active') or (v_row.status = 'active' and p_status = 'retired')) then
    raise exception 'invalid SOP status transition';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.sop_versions set status = p_status,
    effective_at = case when p_status = 'active' then now() else effective_at end,
    retired_at = case when p_status = 'retired' then now() else retired_at end
  where id = p_id;
end;
$$;

create or replace function public.create_method_version(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_lab_id uuid := (p_payload->>'lab_id')::uuid; v_id uuid;
begin
  perform public.require_lab_role(v_lab_id, array['admin']::public.lab_role[]);
  insert into public.method_versions(
    lab_id, sop_version_id, method_code, name, version, curve_model,
    standard_min_eu_ml, standard_max_eu_ml, r2_min, replicate_cv_max_pct,
    ppc_recovery_min_pct, ppc_recovery_max_pct, blank_max_rfu, notes, created_by
  ) values (
    v_lab_id, nullif(p_payload->>'sop_version_id','')::uuid,
    trim(p_payload->>'method_code'), trim(p_payload->>'name'), trim(p_payload->>'version'),
    (p_payload->>'curve_model')::public.curve_model,
    (p_payload->>'standard_min_eu_ml')::numeric, (p_payload->>'standard_max_eu_ml')::numeric,
    (p_payload->>'r2_min')::numeric, (p_payload->>'replicate_cv_max_pct')::numeric,
    (p_payload->>'ppc_recovery_min_pct')::numeric, (p_payload->>'ppc_recovery_max_pct')::numeric,
    (p_payload->>'blank_max_rfu')::numeric, p_payload->>'notes', auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_method_status(p_id uuid, p_status public.controlled_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.method_versions%rowtype;
begin
  select * into v_row from public.method_versions where id = p_id for update;
  if not found then raise exception 'method version not found'; end if;
  perform public.require_lab_role(v_row.lab_id, array['admin']::public.lab_role[]);
  if not ((v_row.status = 'draft' and p_status = 'active') or (v_row.status = 'active' and p_status = 'retired')) then
    raise exception 'invalid method status transition';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.method_versions set status = p_status,
    effective_at = case when p_status = 'active' then now() else effective_at end,
    retired_at = case when p_status = 'retired' then now() else retired_at end
  where id = p_id;
end;
$$;

create or replace function public.create_instrument(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_lab_id uuid := (p_payload->>'lab_id')::uuid; v_id uuid;
begin
  perform public.require_lab_role(v_lab_id, array['admin']::public.lab_role[]);
  insert into public.instruments(
    lab_id, instrument_code, name, manufacturer, model, serial_number, status, created_by
  ) values (
    v_lab_id, trim(p_payload->>'instrument_code'), trim(p_payload->>'name'),
    p_payload->>'manufacturer', p_payload->>'model', p_payload->>'serial_number',
    'draft', auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_instrument_status(p_id uuid, p_status public.controlled_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.instruments%rowtype;
begin
  select * into v_row from public.instruments where id = p_id for update;
  if not found then raise exception 'instrument not found'; end if;
  perform public.require_lab_role(v_row.lab_id, array['admin']::public.lab_role[]);
  if not ((v_row.status = 'draft' and p_status = 'active') or (v_row.status = 'active' and p_status = 'retired')) then
    raise exception 'invalid instrument status transition';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.instruments set status = p_status where id = p_id;
end;
$$;

create or replace function public.record_instrument_event(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_instrument public.instruments%rowtype; v_id uuid;
begin
  select * into v_instrument from public.instruments where id = (p_payload->>'instrument_id')::uuid;
  if not found then raise exception 'instrument not found'; end if;
  perform public.require_lab_role(v_instrument.lab_id, array['admin']::public.lab_role[]);
  insert into public.instrument_events(
    lab_id, instrument_id, event_type, performed_at, due_at, outcome, notes, created_by
  ) values (
    v_instrument.lab_id, v_instrument.id, p_payload->>'event_type',
    (p_payload->>'performed_at')::timestamptz, nullif(p_payload->>'due_at','')::timestamptz,
    trim(p_payload->>'outcome'), p_payload->>'notes', auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_material_lot(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_lab_id uuid := (p_payload->>'lab_id')::uuid; v_id uuid;
begin
  perform public.require_lab_role(v_lab_id, array['admin']::public.lab_role[]);
  insert into public.material_lots(
    lab_id, material_type, name, manufacturer, catalog_number, lot_number,
    concentration, concentration_unit, received_at, opened_at, expires_at,
    storage_condition, status, certificate_uri, created_by
  ) values (
    v_lab_id, p_payload->>'material_type', trim(p_payload->>'name'),
    p_payload->>'manufacturer', p_payload->>'catalog_number', trim(p_payload->>'lot_number'),
    nullif(p_payload->>'concentration','')::numeric, p_payload->>'concentration_unit',
    nullif(p_payload->>'received_at','')::timestamptz, nullif(p_payload->>'opened_at','')::timestamptz,
    nullif(p_payload->>'expires_at','')::timestamptz, p_payload->>'storage_condition',
    'draft',
    p_payload->>'certificate_uri', auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_material_lot_status(p_id uuid, p_status public.controlled_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.material_lots%rowtype;
begin
  select * into v_row from public.material_lots where id = p_id for update;
  if not found then raise exception 'material lot not found'; end if;
  perform public.require_lab_role(v_row.lab_id, array['admin']::public.lab_role[]);
  if not ((v_row.status = 'draft' and p_status = 'active') or (v_row.status = 'active' and p_status = 'retired')) then
    raise exception 'invalid material lot status transition';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.material_lots set status = p_status where id = p_id;
end;
$$;

create or replace function public.guard_controlled_record_update()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('active', 'retired') and to_jsonb(new) - array['status','retired_at'] <> to_jsonb(old) - array['status','retired_at'] then
    raise exception 'active or retired controlled records are immutable' using errcode = '55000';
  end if;
  if old.status = 'retired' then
    raise exception 'retired controlled records cannot be changed' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger guard_method_versions before update on public.method_versions
for each row execute function public.guard_controlled_record_update();
create trigger guard_sop_versions before update on public.sop_versions
for each row execute function public.guard_controlled_record_update();
create trigger guard_assay_runs before update on public.assay_runs
for each row execute function public.guard_run_update();

do $$
declare
  t text;
begin
  foreach t in array array[
    'sop_versions','method_versions','instruments','instrument_events','material_lots',
    'test_orders','samples','sample_components','sample_events','assay_runs','run_samples',
    'raw_artifacts','plate_wells','endpoint_readings','deviations','calculation_revisions',
    'sample_results','review_actions'
  ] loop
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
    execute format('create trigger reject_delete_%I before delete on public.%I for each row execute function public.reject_delete()', t, t);
  end loop;
end;
$$;

create or replace function public.create_sample(p_payload jsonb, p_idempotency_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lab_id uuid := (p_payload->>'lab_id')::uuid;
  v_id uuid;
begin
  perform public.require_lab_role(v_lab_id, array['admin','analyst']::public.lab_role[]);
  if p_idempotency_key is not null then
    select id into v_id from public.samples
    where lab_id = v_lab_id and created_by = auth.uid()
      and external_id = p_payload->>'external_id';
    if v_id is not null then return v_id; end if;
  end if;
  perform set_config('app.correlation_id', coalesce(p_idempotency_key, ''), true);
  insert into public.samples(
    lab_id, test_order_id, external_id, kind, product_name, product_lot, matrix,
    process_stage, collected_at, collected_by, storage_condition, quantity,
    quantity_unit, endotoxin_limit_eu_ml, maximum_valid_dilution, created_by
  ) values (
    v_lab_id, nullif(p_payload->>'test_order_id','')::uuid, trim(p_payload->>'external_id'),
    coalesce((p_payload->>'kind')::public.sample_kind, 'original'), p_payload->>'product_name',
    p_payload->>'product_lot', trim(p_payload->>'matrix'), p_payload->>'process_stage',
    nullif(p_payload->>'collected_at','')::timestamptz, p_payload->>'collected_by',
    p_payload->>'storage_condition', nullif(p_payload->>'quantity','')::numeric,
    p_payload->>'quantity_unit', (p_payload->>'endotoxin_limit_eu_ml')::numeric,
    (p_payload->>'maximum_valid_dilution')::numeric, auth.uid()
  ) returning id into v_id;
  insert into public.sample_events(lab_id, sample_id, event_type, occurred_at, notes, created_by)
  values (v_lab_id, v_id, 'registered', now(), 'Sample registered', auth.uid());
  return v_id;
end;
$$;

create or replace function public.record_sample_event(p_sample_id uuid, p_payload jsonb, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sample public.samples%rowtype;
  v_id uuid;
  v_event text := p_payload->>'event_type';
  v_status public.sample_status;
begin
  select * into v_sample from public.samples where id = p_sample_id;
  if not found then raise exception 'sample not found'; end if;
  perform public.require_lab_role(v_sample.lab_id, array['admin','analyst']::public.lab_role[]);
  perform set_config('app.change_reason', coalesce(p_reason, p_payload->>'notes', ''), true);
  insert into public.sample_events(
    lab_id, sample_id, event_type, occurred_at, location, condition, quantity,
    quantity_unit, notes, created_by
  ) values (
    v_sample.lab_id, p_sample_id, v_event,
    coalesce(nullif(p_payload->>'occurred_at','')::timestamptz, now()),
    p_payload->>'location', p_payload->>'condition', nullif(p_payload->>'quantity','')::numeric,
    p_payload->>'quantity_unit', p_payload->>'notes', auth.uid()
  ) returning id into v_id;
  v_status := case v_event
    when 'received' then 'received'::public.sample_status
    when 'stored' then 'in_storage'::public.sample_status
    when 'removed' then 'in_testing'::public.sample_status
    when 'consumed' then 'consumed'::public.sample_status
    when 'disposed' then 'disposed'::public.sample_status
    else null
  end;
  if v_status is not null then
    update public.samples set
      status = v_status,
      received_at = case when v_event = 'received' then coalesce(nullif(p_payload->>'occurred_at','')::timestamptz, now()) else received_at end,
      received_by = case when v_event = 'received' then auth.uid() else received_by end,
      receipt_condition = case when v_event = 'received' then p_payload->>'condition' else receipt_condition end,
      disposition_reason = case when v_event in ('consumed','disposed') then p_payload->>'notes' else disposition_reason end,
      updated_at = now()
    where id = p_sample_id;
  end if;
  return v_id;
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
      select 1 from public.samples s where s.id = (v_sample->>'sample_id')::uuid and s.lab_id = v_lab_id
    ) then raise exception 'sample is not in this laboratory'; end if;
    insert into public.run_samples(lab_id, run_id, sample_id, planned_dilution, created_by)
    values (v_lab_id, v_id, (v_sample->>'sample_id')::uuid, (v_sample->>'planned_dilution')::numeric, auth.uid());
  end loop;
  return v_id;
end;
$$;

create or replace function public.register_raw_artifact(p_run_id uuid, p_payload jsonb, p_idempotency_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.assay_runs%rowtype;
  v_id uuid;
begin
  select * into v_run from public.assay_runs where id = p_run_id;
  if not found then raise exception 'run not found'; end if;
  perform public.require_lab_role(v_run.lab_id, array['admin','analyst']::public.lab_role[]);
  if v_run.status not in ('draft','in_progress') then raise exception 'run does not accept raw data'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.raw_artifacts where run_id = p_run_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.raw_artifacts(
    lab_id, run_id, idempotency_key, storage_path, storage_version, original_filename,
    mime_type, byte_size, sha256, uploaded_by
  ) values (
    v_run.lab_id, p_run_id, p_idempotency_key, p_payload->>'storage_path',
    p_payload->>'storage_version', p_payload->>'original_filename', p_payload->>'mime_type',
    (p_payload->>'byte_size')::bigint, p_payload->>'sha256', auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upsert_endpoint_readings(p_run_id uuid, p_rows jsonb, p_artifact_id uuid default null, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.assay_runs%rowtype;
  v_row jsonb;
  v_well_id uuid;
  v_count integer := 0;
begin
  select * into v_run from public.assay_runs where id = p_run_id;
  if not found then raise exception 'run not found'; end if;
  perform public.require_lab_role(v_run.lab_id, array['admin','analyst']::public.lab_role[]);
  if v_run.status not in ('draft','in_progress') then raise exception 'run does not accept readings'; end if;
  perform set_config('app.change_reason', coalesce(p_reason, 'endpoint reading entry'), true);
  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.plate_wells(
      lab_id, run_id, well, role, sample_id, replicate, dilution_factor,
      standard_eu_ml, spike_eu_ml, source_artifact_id, created_by
    ) values (
      v_run.lab_id, p_run_id, upper(v_row->>'well'), (v_row->>'role')::public.well_role,
      nullif(v_row->>'sample_id','')::uuid, (v_row->>'replicate')::integer,
      (v_row->>'dilution_factor')::numeric, nullif(v_row->>'standard_eu_ml','')::numeric,
      nullif(v_row->>'spike_eu_ml','')::numeric, p_artifact_id, auth.uid()
    ) on conflict (run_id, well) do update set
      role = excluded.role, sample_id = excluded.sample_id, replicate = excluded.replicate,
      dilution_factor = excluded.dilution_factor, standard_eu_ml = excluded.standard_eu_ml,
      spike_eu_ml = excluded.spike_eu_ml,
      source_artifact_id = coalesce(excluded.source_artifact_id, public.plate_wells.source_artifact_id),
      updated_at = now()
    returning id into v_well_id;
    insert into public.endpoint_readings(lab_id, run_id, plate_well_id, fluorescence_rfu, entered_by)
    values (v_run.lab_id, p_run_id, v_well_id, (v_row->>'fluorescence_rfu')::numeric, auth.uid())
    on conflict (plate_well_id) do update set
      fluorescence_rfu = excluded.fluorescence_rfu, entered_by = auth.uid(), updated_at = now();
    v_count := v_count + 1;
  end loop;
  update public.assay_runs set status = 'in_progress', started_at = coalesce(started_at, now()) where id = p_run_id;
  return v_count;
end;
$$;

create or replace function public.save_calculation_revision(
  p_run_id uuid,
  p_input_sha256 text,
  p_is_valid boolean,
  p_diagnostics jsonb,
  p_curve_parameters jsonb,
  p_results jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.assay_runs%rowtype;
  v_id uuid;
  v_revision integer;
  v_result jsonb;
begin
  select * into v_run from public.assay_runs where id = p_run_id for update;
  if not found then raise exception 'run not found'; end if;
  perform public.require_lab_role(v_run.lab_id, array['admin','analyst']::public.lab_role[]);
  if v_run.status not in ('in_progress','calculated') then raise exception 'run cannot be calculated in its current state'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.calculation_revisions where run_id = p_run_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
  end if;
  select coalesce(max(revision), 0) + 1 into v_revision from public.calculation_revisions where run_id = p_run_id;
  insert into public.calculation_revisions(
    lab_id, run_id, revision, idempotency_key, input_sha256, is_valid,
    diagnostics, curve_parameters, calculated_by
  ) values (
    v_run.lab_id, p_run_id, v_revision, p_idempotency_key, p_input_sha256,
    p_is_valid, p_diagnostics, p_curve_parameters, auth.uid()
  ) returning id into v_id;
  for v_result in select * from jsonb_array_elements(p_results) loop
    insert into public.sample_results(
      lab_id, calculation_revision_id, run_id, sample_id, measured_eu_ml,
      corrected_eu_ml, qualifier, ppc_recovery_pct, replicate_cv_pct,
      specification_decision, validity_details, created_by
    ) values (
      v_run.lab_id, v_id, p_run_id, (v_result->>'sample_id')::uuid,
      nullif(v_result->>'measured_eu_ml','')::numeric,
      nullif(v_result->>'corrected_eu_ml','')::numeric,
      (v_result->>'qualifier')::public.result_qualifier,
      nullif(v_result->>'ppc_recovery_pct','')::numeric,
      nullif(v_result->>'replicate_cv_pct','')::numeric,
      (v_result->>'specification_decision')::public.specification_decision,
      coalesce(v_result->'validity_details', '{}'::jsonb), auth.uid()
    );
  end loop;
  update public.assay_runs set status = 'calculated', completed_at = now() where id = p_run_id;
  return v_id;
end;
$$;

create or replace function public.calculate_assay_run(p_run_id uuid, p_idempotency_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run public.assay_runs%rowtype;
  v_method public.method_versions%rowtype;
  v_existing uuid;
  v_calculation_id uuid;
  v_revision integer;
  v_blank numeric;
  v_blank_valid boolean := false;
  v_standard_count integer := 0;
  v_standards_valid boolean := false;
  v_slope double precision;
  v_intercept double precision;
  v_r2 double precision;
  v_curve_valid boolean := false;
  v_standard_points jsonb := '[]'::jsonb;
  v_curve_parameters jsonb;
  v_global_issues jsonb := '[]'::jsonb;
  v_all_samples_valid boolean := true;
  v_sample_count integer := 0;
  v_assignment record;
  v_sample_count_wells integer;
  v_ppc_count_wells integer;
  v_dilution_count integer;
  v_spike_count integer;
  v_dilution numeric;
  v_spike numeric;
  v_sample_response numeric;
  v_ppc_response numeric;
  v_sample_cv numeric;
  v_ppc_cv numeric;
  v_measured numeric;
  v_ppc_measured numeric;
  v_recovery numeric;
  v_corrected numeric;
  v_local_valid boolean;
  v_reportable boolean;
  v_sample_issues jsonb;
  v_qualifier public.result_qualifier;
  v_decision public.specification_decision;
  v_input jsonb;
  v_input_sha256 text;
begin
  select * into v_run from public.assay_runs where id = p_run_id for update;
  if not found then raise exception 'run not found'; end if;
  perform public.require_lab_role(v_run.lab_id, array['admin','analyst']::public.lab_role[]);
  if v_run.status not in ('in_progress','calculated') then raise exception 'run cannot be calculated in its current state'; end if;
  if p_idempotency_key is not null then
    select id into v_existing from public.calculation_revisions where run_id = p_run_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then return v_existing; end if;
  end if;
  select * into v_method from public.method_versions where id = v_run.method_version_id;

  select avg(er.fluorescence_rfu)
  into v_blank
  from public.plate_wells w
  join public.endpoint_readings er on er.plate_well_id = w.id
  where w.run_id = p_run_id and w.role = 'blank';
  v_blank_valid := v_blank is not null and v_blank <= v_method.blank_max_rfu;
  if v_blank is null then v_global_issues := v_global_issues || jsonb_build_array('No blank wells were provided');
  elsif not v_blank_valid then v_global_issues := v_global_issues || jsonb_build_array(format('Blank mean RFU %s exceeds %s', round(v_blank, 8), v_method.blank_max_rfu));
  end if;

  with grouped as (
    select w.standard_eu_ml as concentration,
      avg(er.fluorescence_rfu - v_blank) as response,
      case when count(*) > 1 and avg(er.fluorescence_rfu - v_blank) <> 0
        then stddev_samp(er.fluorescence_rfu - v_blank) / abs(avg(er.fluorescence_rfu - v_blank)) * 100
        else null end as cv_pct,
      count(*) as replicates
    from public.plate_wells w
    join public.endpoint_readings er on er.plate_well_id = w.id
    where w.run_id = p_run_id and w.role = 'standard'
    group by w.standard_eu_ml
  ), transformed as (
    select *,
      case when v_method.curve_model = 'log10-linear' then log(10.0, concentration) else concentration::double precision end as x,
      case when v_method.curve_model = 'log10-linear' and response > 0 then log(10.0, response) else response::double precision end as y
    from grouped
  )
  select count(*),
    coalesce(bool_and(
      concentration between v_method.standard_min_eu_ml and v_method.standard_max_eu_ml
      and response > 0
      and (cv_pct is null or cv_pct <= v_method.replicate_cv_max_pct)
    ), false),
    regr_slope(y, x), regr_intercept(y, x), regr_r2(y, x),
    coalesce(jsonb_agg(jsonb_build_object(
      'concentrationEuMl', concentration,
      'meanCorrectedRfu', round(response, 8),
      'cvPct', case when cv_pct is null then null else round(cv_pct, 8) end,
      'replicates', replicates
    ) order by concentration), '[]'::jsonb)
  into v_standard_count, v_standards_valid, v_slope, v_intercept, v_r2, v_standard_points
  from transformed;

  if v_standard_count < 3 then v_global_issues := v_global_issues || jsonb_build_array('At least three standard concentrations are required'); end if;
  if not v_standards_valid then v_global_issues := v_global_issues || jsonb_build_array('Standard range, response, or replicate CV criteria failed'); end if;
  v_curve_valid := v_standard_count >= 3 and v_slope is not null and v_slope > 0 and v_r2 >= v_method.r2_min;
  if v_slope is null then v_global_issues := v_global_issues || jsonb_build_array('The standard curve could not be fitted');
  elsif v_slope <= 0 then v_global_issues := v_global_issues || jsonb_build_array('The standard curve slope must be positive');
  elsif v_r2 < v_method.r2_min then v_global_issues := v_global_issues || jsonb_build_array(format('Standard curve R² %s is below %s', round(v_r2::numeric, 8), v_method.r2_min));
  end if;
  if v_slope is not null then
    v_curve_parameters := jsonb_build_object(
      'model', v_method.curve_model,
      'slope', round(v_slope::numeric, 8),
      'intercept', round(v_intercept::numeric, 8),
      'r2', round(v_r2::numeric, 8),
      'blankMeanRfu', round(v_blank, 8),
      'standardPoints', v_standard_points
    );
  end if;

  select jsonb_build_object(
    'method', to_jsonb(v_method),
    'samples', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.run_samples rs join public.samples s on s.id = rs.sample_id where rs.run_id = p_run_id), '[]'::jsonb),
    'wells', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('fluorescence_rfu', er.fluorescence_rfu) order by w.well) from public.plate_wells w join public.endpoint_readings er on er.plate_well_id = w.id where w.run_id = p_run_id), '[]'::jsonb)
  ) into v_input;
  v_input_sha256 := encode(digest(v_input::text, 'sha256'), 'hex');
  select coalesce(max(revision), 0) + 1 into v_revision from public.calculation_revisions where run_id = p_run_id;
  insert into public.calculation_revisions(
    lab_id, run_id, revision, idempotency_key, input_sha256, is_valid,
    diagnostics, curve_parameters, calculated_by
  ) values (
    v_run.lab_id, p_run_id, v_revision, p_idempotency_key, v_input_sha256, false,
    '{}'::jsonb, v_curve_parameters, auth.uid()
  ) returning id into v_calculation_id;

  for v_assignment in
    select rs.sample_id, rs.planned_dilution, s.external_id, s.endotoxin_limit_eu_ml, s.maximum_valid_dilution
    from public.run_samples rs join public.samples s on s.id = rs.sample_id
    where rs.run_id = p_run_id order by s.external_id
  loop
    v_sample_count := v_sample_count + 1;
    v_sample_issues := '[]'::jsonb;
    select count(*), count(distinct w.dilution_factor), min(w.dilution_factor),
      avg(er.fluorescence_rfu - v_blank),
      case when count(*) > 1 and avg(er.fluorescence_rfu - v_blank) <> 0
        then stddev_samp(er.fluorescence_rfu - v_blank) / abs(avg(er.fluorescence_rfu - v_blank)) * 100 else null end
    into v_sample_count_wells, v_dilution_count, v_dilution, v_sample_response, v_sample_cv
    from public.plate_wells w join public.endpoint_readings er on er.plate_well_id = w.id
    where w.run_id = p_run_id and w.role = 'sample' and w.sample_id = v_assignment.sample_id;
    select count(*), count(distinct w.spike_eu_ml), min(w.spike_eu_ml),
      count(distinct w.dilution_factor), min(w.dilution_factor),
      avg(er.fluorescence_rfu - v_blank),
      case when count(*) > 1 and avg(er.fluorescence_rfu - v_blank) <> 0
        then stddev_samp(er.fluorescence_rfu - v_blank) / abs(avg(er.fluorescence_rfu - v_blank)) * 100 else null end
    into v_ppc_count_wells, v_spike_count, v_spike, v_dilution_count, v_dilution, v_ppc_response, v_ppc_cv
    from public.plate_wells w join public.endpoint_readings er on er.plate_well_id = w.id
    where w.run_id = p_run_id and w.role = 'ppc' and w.sample_id = v_assignment.sample_id;

    if v_sample_count_wells = 0 then v_sample_issues := v_sample_issues || jsonb_build_array('No unspiked sample wells'); end if;
    if v_ppc_count_wells = 0 then v_sample_issues := v_sample_issues || jsonb_build_array('No PPC wells'); end if;
    if (select count(distinct dilution_factor) from public.plate_wells where run_id = p_run_id and sample_id = v_assignment.sample_id and role in ('sample','ppc')) <> 1 then
      v_sample_issues := v_sample_issues || jsonb_build_array('Sample and PPC wells must use one common dilution');
    end if;
    if v_spike_count > 1 then v_sample_issues := v_sample_issues || jsonb_build_array('PPC wells must use one common spike concentration'); end if;
    if v_dilution > v_assignment.maximum_valid_dilution then v_sample_issues := v_sample_issues || jsonb_build_array(format('Dilution %s exceeds MVD %s', v_dilution, v_assignment.maximum_valid_dilution)); end if;
    if v_sample_cv is not null and v_sample_cv > v_method.replicate_cv_max_pct then v_sample_issues := v_sample_issues || jsonb_build_array('Sample replicate CV exceeds the configured maximum'); end if;
    if v_ppc_cv is not null and v_ppc_cv > v_method.replicate_cv_max_pct then v_sample_issues := v_sample_issues || jsonb_build_array('PPC replicate CV exceeds the configured maximum'); end if;

    v_measured := null; v_ppc_measured := null; v_recovery := null; v_corrected := null;
    if v_curve_valid and v_sample_response > 0 then
      v_measured := case when v_method.curve_model = 'log10-linear'
        then power(10.0, (log(10.0, v_sample_response) - v_intercept) / v_slope)
        else (v_sample_response - v_intercept) / v_slope end;
    end if;
    if v_curve_valid and v_ppc_response > 0 then
      v_ppc_measured := case when v_method.curve_model = 'log10-linear'
        then power(10.0, (log(10.0, v_ppc_response) - v_intercept) / v_slope)
        else (v_ppc_response - v_intercept) / v_slope end;
    end if;
    if v_measured is not null and v_ppc_measured is not null and v_spike is not null and v_spike > 0 then
      v_recovery := (v_ppc_measured - v_measured) / v_spike * 100;
    end if;
    if v_recovery is null then v_sample_issues := v_sample_issues || jsonb_build_array('PPC recovery could not be calculated');
    elsif v_recovery < v_method.ppc_recovery_min_pct or v_recovery > v_method.ppc_recovery_max_pct then
      v_sample_issues := v_sample_issues || jsonb_build_array(format('PPC recovery %s%% is outside the configured range', round(v_recovery, 8)));
    end if;
    if v_measured is not null and v_dilution is not null then v_corrected := v_measured * v_dilution; end if;
    v_local_valid := jsonb_array_length(v_sample_issues) = 0;
    v_all_samples_valid := v_all_samples_valid and v_local_valid;
    v_reportable := v_blank_valid and v_standards_valid and v_curve_valid and v_local_valid;
    v_qualifier := case
      when not v_reportable or v_measured is null then 'invalid'
      when v_measured < v_method.standard_min_eu_ml then 'below_lloq'
      when v_measured > v_method.standard_max_eu_ml then 'above_uloq'
      else 'within_range' end;
    v_decision := case
      when not v_reportable or v_corrected is null or v_qualifier = 'above_uloq' then 'not_reportable'
      when v_corrected <= v_assignment.endotoxin_limit_eu_ml then 'pass'
      else 'fail' end;
    insert into public.sample_results(
      lab_id, calculation_revision_id, run_id, sample_id, measured_eu_ml,
      corrected_eu_ml, qualifier, ppc_recovery_pct, replicate_cv_pct,
      specification_decision, validity_details, created_by
    ) values (
      v_run.lab_id, v_calculation_id, p_run_id, v_assignment.sample_id,
      case when v_measured is null then null else round(v_measured, 8) end,
      case when v_corrected is null then null else round(v_corrected, 8) end,
      v_qualifier, case when v_recovery is null then null else round(v_recovery, 8) end,
      case when v_sample_cv is null then null else round(v_sample_cv, 8) end,
      v_decision, jsonb_build_object('valid', v_reportable, 'issues', v_sample_issues, 'dilutionFactor', v_dilution), auth.uid()
    );
    if not v_local_valid then v_global_issues := v_global_issues || jsonb_build_array(format('%s: %s', v_assignment.external_id, v_sample_issues::text)); end if;
  end loop;

  if v_sample_count = 0 then
    v_all_samples_valid := false;
    v_global_issues := v_global_issues || jsonb_build_array('No samples are assigned to the run');
  end if;
  if not (v_blank_valid and v_standards_valid and v_curve_valid and v_all_samples_valid) then
    update public.sample_results set qualifier = 'invalid', specification_decision = 'not_reportable',
      validity_details = jsonb_set(validity_details, '{valid}', 'false'::jsonb)
    where calculation_revision_id = v_calculation_id;
  end if;
  update public.calculation_revisions set
    is_valid = v_blank_valid and v_standards_valid and v_curve_valid and v_all_samples_valid,
    diagnostics = jsonb_build_object(
      'issues', v_global_issues,
      'blankValid', v_blank_valid,
      'curveValid', v_curve_valid,
      'standardsValid', v_standards_valid,
      'samplesValid', v_all_samples_valid
    )
  where id = v_calculation_id;
  update public.assay_runs set status = 'calculated', completed_at = now() where id = p_run_id;
  return v_calculation_id;
end;
$$;

create or replace function public.submit_assay_run(p_run_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_run public.assay_runs%rowtype;
begin
  select * into v_run from public.assay_runs where id = p_run_id for update;
  if not found then raise exception 'run not found'; end if;
  perform public.require_lab_role(v_run.lab_id, array['admin','analyst']::public.lab_role[]);
  if v_run.status <> 'calculated' then raise exception 'only calculated runs can be submitted'; end if;
  perform set_config('app.change_reason', coalesce(p_reason, 'submitted for review'), true);
  update public.assay_runs set status = 'submitted', submitted_at = now() where id = p_run_id;
end;
$$;

create or replace function public.build_run_report(p_run_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'run', to_jsonb(r) - 'report_snapshot',
    'method', to_jsonb(m),
    'sop', to_jsonb(sop),
    'instrument', to_jsonb(i),
    'instrument_events', coalesce((select jsonb_agg(to_jsonb(ie) order by ie.performed_at) from public.instrument_events ie where ie.instrument_id = r.instrument_id), '[]'::jsonb),
    'reagent_lot', to_jsonb(rl),
    'standard_lot', to_jsonb(sl),
    'samples', coalesce((select jsonb_agg(jsonb_build_object(
      'sample', to_jsonb(sa),
      'planned_dilution', rs.planned_dilution,
      'events', coalesce((select jsonb_agg(to_jsonb(se) order by se.occurred_at, se.created_at) from public.sample_events se where se.sample_id = sa.id), '[]'::jsonb)
    ) order by sa.external_id) from public.run_samples rs join public.samples sa on sa.id = rs.sample_id where rs.run_id = r.id), '[]'::jsonb),
    'raw_artifacts', coalesce((select jsonb_agg(to_jsonb(a) order by a.uploaded_at) from public.raw_artifacts a where a.run_id = r.id), '[]'::jsonb),
    'wells', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object('fluorescence_rfu', er.fluorescence_rfu) order by w.well) from public.plate_wells w join public.endpoint_readings er on er.plate_well_id = w.id where w.run_id = r.id), '[]'::jsonb),
    'calculations', coalesce((select jsonb_agg(to_jsonb(cr) || jsonb_build_object('results', coalesce((select jsonb_agg(to_jsonb(sr) order by sr.sample_id) from public.sample_results sr where sr.calculation_revision_id = cr.id), '[]'::jsonb)) order by cr.revision) from public.calculation_revisions cr where cr.run_id = r.id), '[]'::jsonb),
    'deviations', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from public.deviations d where d.run_id = r.id), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(ra) - 'report_snapshot' order by ra.reviewed_at) from public.review_actions ra where ra.run_id = r.id), '[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(ae) order by ae.occurred_at, ae.id) from public.audit_events ae where ae.lab_id = r.lab_id and (
      ae.entity_id = r.id
      or ae.entity_id in (select rs2.id from public.run_samples rs2 where rs2.run_id = r.id)
      or ae.entity_id in (select w2.id from public.plate_wells w2 where w2.run_id = r.id)
      or ae.entity_id in (select er2.id from public.endpoint_readings er2 where er2.run_id = r.id)
      or ae.entity_id in (select cr2.id from public.calculation_revisions cr2 where cr2.run_id = r.id)
      or ae.entity_id in (select sr2.id from public.sample_results sr2 where sr2.run_id = r.id)
      or ae.entity_id in (select ra2.id from public.review_actions ra2 where ra2.run_id = r.id)
    )), '[]'::jsonb)
  )
  from public.assay_runs r
  join public.method_versions m on m.id = r.method_version_id
  left join public.sop_versions sop on sop.id = m.sop_version_id
  join public.instruments i on i.id = r.instrument_id
  join public.material_lots rl on rl.id = r.reagent_lot_id
  join public.material_lots sl on sl.id = r.standard_lot_id
  where r.id = p_run_id
    and public.has_lab_role(r.lab_id, array['admin','analyst','reviewer','viewer']::public.lab_role[]);
$$;

create or replace function public.review_assay_run(
  p_run_id uuid,
  p_decision public.review_decision,
  p_meaning text,
  p_comment text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.assay_runs%rowtype;
  v_id uuid;
  v_snapshot jsonb;
  v_next public.run_status;
begin
  select * into v_run from public.assay_runs where id = p_run_id for update;
  if not found then raise exception 'run not found'; end if;
  if not (
    public.has_lab_role(v_run.lab_id, array['admin','reviewer']::public.lab_role[])
    or (v_run.created_by = auth.uid() and public.has_lab_role(v_run.lab_id, array['analyst']::public.lab_role[]))
  ) then raise exception 'not authorized to review this run' using errcode = '42501'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.review_actions where run_id = p_run_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
  end if;
  if p_decision in ('approve','reject') and v_run.status <> 'submitted' then
    raise exception 'approve or reject requires a submitted run';
  end if;
  if p_decision = 'invalidate' and v_run.status <> 'approved' then
    raise exception 'only approved runs can be invalidated';
  end if;
  if p_decision = 'approve' and not exists (
    select 1 from public.calculation_revisions cr where cr.run_id = p_run_id and cr.is_valid
      and cr.revision = (select max(cr2.revision) from public.calculation_revisions cr2 where cr2.run_id = p_run_id)
  ) then raise exception 'latest calculation is invalid and cannot be approved'; end if;
  v_next := case p_decision when 'approve' then 'approved'::public.run_status when 'reject' then 'rejected'::public.run_status else 'invalidated'::public.run_status end;
  perform set_config('app.change_reason', coalesce(p_comment, p_meaning), true);
  insert into public.review_actions(
    lab_id, run_id, idempotency_key, decision, meaning, comment,
    report_snapshot, reviewed_by
  ) values (
    v_run.lab_id, p_run_id, p_idempotency_key, p_decision, trim(p_meaning),
    p_comment, null, auth.uid()
  ) returning id into v_id;
  v_snapshot := public.build_run_report(p_run_id);
  update public.review_actions set report_snapshot = v_snapshot where id = v_id;
  update public.assay_runs set status = v_next,
    approved_at = case when p_decision = 'approve' then now() else approved_at end,
    report_snapshot = case when p_decision = 'approve' then v_snapshot else report_snapshot end
  where id = p_run_id;
  return v_id;
end;
$$;

-- RLS: no anonymous access; authenticated users can read rows for their lab.
do $$
declare t text;
begin
  foreach t in array array[
    'lab_memberships','sop_versions','method_versions','instruments',
    'instrument_events','material_lots','test_orders','samples','sample_components',
    'sample_events','assay_runs','run_samples','raw_artifacts','plate_wells',
    'endpoint_readings','deviations','calculation_revisions','sample_results',
    'review_actions','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_lab_role(lab_id, array[''admin'',''analyst'',''reviewer'',''viewer'']::public.lab_role[]))', 'read_lab_' || t, t);
  end loop;
end;
$$;

alter table public.laboratories enable row level security;
revoke all on public.laboratories from anon, authenticated;
grant select on public.laboratories to authenticated;
create policy read_member_laboratories on public.laboratories for select to authenticated
using (public.has_lab_role(id, array['admin','analyst','reviewer','viewer']::public.lab_role[]));

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy read_own_profile on public.profiles for select to authenticated using (user_id = auth.uid());

grant execute on function public.has_lab_role(uuid, public.lab_role[]) to authenticated;
grant execute on function public.create_sop_version(jsonb) to authenticated;
grant execute on function public.set_sop_status(uuid, public.controlled_status, text) to authenticated;
grant execute on function public.create_method_version(jsonb) to authenticated;
grant execute on function public.set_method_status(uuid, public.controlled_status, text) to authenticated;
grant execute on function public.create_instrument(jsonb) to authenticated;
grant execute on function public.set_instrument_status(uuid, public.controlled_status, text) to authenticated;
grant execute on function public.record_instrument_event(jsonb) to authenticated;
grant execute on function public.create_material_lot(jsonb) to authenticated;
grant execute on function public.set_material_lot_status(uuid, public.controlled_status, text) to authenticated;
grant execute on function public.create_sample(jsonb, text) to authenticated;
grant execute on function public.record_sample_event(uuid, jsonb, text) to authenticated;
grant execute on function public.create_assay_run(jsonb, text) to authenticated;
grant execute on function public.register_raw_artifact(uuid, jsonb, text) to authenticated;
grant execute on function public.upsert_endpoint_readings(uuid, jsonb, uuid, text) to authenticated;
revoke all on function public.save_calculation_revision(uuid, text, boolean, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.calculate_assay_run(uuid, text) to authenticated;
grant execute on function public.submit_assay_run(uuid, text) to authenticated;
grant execute on function public.build_run_report(uuid) to authenticated;
grant execute on function public.review_assay_run(uuid, public.review_decision, text, text, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('assay-raw-data', 'assay-raw-data', false, 10485760, array['text/csv','application/csv','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy assay_raw_data_read on storage.objects
for select to authenticated
using (
  bucket_id = 'assay-raw-data'
  and exists (
    select 1 from public.lab_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
      and m.lab_id::text = (storage.foldername(name))[1]
  )
);

create policy assay_raw_data_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'assay-raw-data'
  and exists (
    select 1 from public.lab_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('admin','analyst')
      and m.lab_id::text = (storage.foldername(name))[1]
  )
);

comment on schema public is 'ClearSignal research prototype; not a validated GLP or Part 11 system.';
