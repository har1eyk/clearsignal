create type public.obsidian_session_status as enum ('open', 'closed');
create type public.obsidian_event_kind as enum ('quote', 'guidance', 'order');

create table public.obsidian_notebook_sessions (
  id uuid primary key,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  read_token_sha256 text not null unique check (read_token_sha256 ~ '^[0-9a-f]{64}$'),
  browser_token_sha256 text not null unique check (browser_token_sha256 ~ '^[0-9a-f]{64}$'),
  status public.obsidian_session_status not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references auth.users(id),
  laboratory_id uuid references public.laboratories(id),
  constraint obsidian_session_close_consistency check (
    (status = 'open' and closed_at is null) or (status = 'closed' and closed_at is not null)
  )
);

create table public.obsidian_notebook_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.obsidian_notebook_sessions(id),
  sequence_number bigint not null check (sequence_number > 0),
  kind public.obsidian_event_kind not null,
  operation_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number),
  unique (session_id, operation_id)
);

alter table public.obsidian_notebook_sessions enable row level security;
alter table public.obsidian_notebook_events enable row level security;
revoke all on public.obsidian_notebook_sessions from public, anon, authenticated;
revoke all on public.obsidian_notebook_events from public, anon, authenticated;

create or replace function public.create_obsidian_notebook_session(
  p_session_id uuid,
  p_request_sha256 text,
  p_read_token_sha256 text,
  p_browser_token_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype;
begin
  if p_request_sha256 !~ '^[0-9a-f]{64}$'
    or p_read_token_sha256 !~ '^[0-9a-f]{64}$'
    or p_browser_token_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid digest';
  end if;
  insert into public.obsidian_notebook_sessions(id, request_sha256, read_token_sha256, browser_token_sha256)
  values (p_session_id, p_request_sha256, p_read_token_sha256, p_browser_token_sha256)
  returning * into v_session;
  return jsonb_build_object('session_id', v_session.id, 'status', v_session.status,
    'request_sha256', v_session.request_sha256, 'created_at', v_session.created_at);
end;
$$;

create or replace function public.get_obsidian_browser_session(
  p_session_id uuid,
  p_browser_token_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype;
begin
  select * into v_session from public.obsidian_notebook_sessions
  where id = p_session_id and browser_token_sha256 = p_browser_token_sha256;
  if v_session.id is null then raise exception 'invalid notebook browser token' using errcode = '42501'; end if;
  if v_session.status <> 'open' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
  return jsonb_build_object('session_id', v_session.id, 'status', v_session.status,
    'request_sha256', v_session.request_sha256, 'created_at', v_session.created_at);
end;
$$;

create or replace function public.read_obsidian_notebook_events(
  p_session_id uuid,
  p_read_token_sha256 text,
  p_after_sequence bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype; v_events jsonb;
begin
  select * into v_session from public.obsidian_notebook_sessions
  where id = p_session_id and read_token_sha256 = p_read_token_sha256;
  if v_session.id is null then raise exception 'invalid notebook read token' using errcode = '42501'; end if;
  if v_session.status <> 'open' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', e.sequence_number, 'kind', e.kind, 'operation_id', e.operation_id,
    'payload', e.payload, 'created_at', e.created_at
  ) order by e.sequence_number), '[]'::jsonb) into v_events
  from public.obsidian_notebook_events e
  where e.session_id = p_session_id and e.sequence_number > greatest(p_after_sequence, 0);
  return jsonb_build_object('session_id', v_session.id, 'status', v_session.status,
    'server_time', now(), 'events', v_events);
end;
$$;

create or replace function public.append_obsidian_public_event(
  p_session_id uuid,
  p_browser_token_sha256 text,
  p_operation_id uuid,
  p_kind public.obsidian_event_kind,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype; v_event public.obsidian_notebook_events%rowtype; v_sequence bigint;
begin
  if p_kind not in ('quote', 'guidance') then raise exception 'unsupported public notebook event'; end if;
  select * into v_session from public.obsidian_notebook_sessions
  where id = p_session_id and browser_token_sha256 = p_browser_token_sha256 for update;
  if v_session.id is null then raise exception 'invalid notebook browser token' using errcode = '42501'; end if;
  if v_session.status <> 'open' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
  select * into v_event from public.obsidian_notebook_events
  where session_id = p_session_id and operation_id = p_operation_id;
  if v_event.id is null then
    select coalesce(max(sequence_number), 0) + 1 into v_sequence
    from public.obsidian_notebook_events where session_id = p_session_id;
    insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload)
    values (p_session_id, v_sequence, p_kind, p_operation_id, p_payload) returning * into v_event;
  end if;
  return jsonb_build_object('sequence', v_event.sequence_number, 'kind', v_event.kind,
    'operation_id', v_event.operation_id, 'payload', v_event.payload, 'created_at', v_event.created_at);
end;
$$;

create or replace function public.append_obsidian_order_event(
  p_session_id uuid,
  p_browser_token_sha256 text,
  p_operation_id uuid,
  p_test_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype; v_event public.obsidian_notebook_events%rowtype;
  v_order public.test_orders%rowtype; v_sequence bigint; v_samples jsonb;
begin
  select * into v_session from public.obsidian_notebook_sessions
  where id = p_session_id and browser_token_sha256 = p_browser_token_sha256 for update;
  if v_session.id is null then raise exception 'invalid notebook browser token' using errcode = '42501'; end if;
  if v_session.status <> 'open' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
  select * into v_order from public.test_orders where id = p_test_order_id;
  if v_order.id is null or v_order.created_by <> auth.uid() then
    raise exception 'order unavailable' using errcode = '42501';
  end if;
  perform public.require_lab_role(v_order.lab_id, array['admin','analyst','reviewer','viewer']::public.lab_role[]);
  select jsonb_agg(s.external_id order by s.created_at, s.id) into v_samples
  from public.samples s where s.test_order_id = v_order.id;
  select * into v_event from public.obsidian_notebook_events
  where session_id = p_session_id and operation_id = p_operation_id;
  if v_event.id is null then
    select coalesce(max(sequence_number), 0) + 1 into v_sequence
    from public.obsidian_notebook_events where session_id = p_session_id;
    insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload)
    values (p_session_id, v_sequence, 'order', p_operation_id, jsonb_build_object(
      'order_id', v_order.id, 'order_number', v_order.order_number,
      'sample_ids', coalesce(v_samples, '[]'::jsonb),
      'sample_count', jsonb_array_length(coalesce(v_samples, '[]'::jsonb)),
      'unit_price', v_order.unit_price_cents / 100.0,
      'total', v_order.total_price_cents / 100.0, 'currency', v_order.currency,
      'catalog_version', v_order.catalog_version, 'status', 'pending_laboratory_review'
    )) returning * into v_event;
    update public.obsidian_notebook_sessions set created_by = auth.uid(), laboratory_id = v_order.lab_id
    where id = p_session_id;
  end if;
  return jsonb_build_object('sequence', v_event.sequence_number, 'kind', v_event.kind,
    'operation_id', v_event.operation_id, 'payload', v_event.payload, 'created_at', v_event.created_at);
end;
$$;

create or replace function public.close_obsidian_notebook_session(
  p_session_id uuid,
  p_read_token_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.obsidian_notebook_sessions%rowtype;
begin
  select * into v_session from public.obsidian_notebook_sessions
  where id = p_session_id and read_token_sha256 = p_read_token_sha256 for update;
  if v_session.id is null then raise exception 'invalid notebook read token' using errcode = '42501'; end if;
  if v_session.status = 'open' then
    update public.obsidian_notebook_sessions set status = 'closed', closed_at = now()
    where id = p_session_id returning * into v_session;
  end if;
  return jsonb_build_object('session_id', v_session.id, 'status', v_session.status,
    'closed_at', v_session.closed_at, 'server_time', now());
end;
$$;

revoke all on function public.create_obsidian_notebook_session(uuid,text,text,text) from public;
revoke all on function public.get_obsidian_browser_session(uuid,text) from public;
revoke all on function public.read_obsidian_notebook_events(uuid,text,bigint) from public;
revoke all on function public.append_obsidian_public_event(uuid,text,uuid,public.obsidian_event_kind,jsonb) from public;
revoke all on function public.append_obsidian_order_event(uuid,text,uuid,uuid) from public;
revoke all on function public.close_obsidian_notebook_session(uuid,text) from public;
grant execute on function public.create_obsidian_notebook_session(uuid,text,text,text) to anon, authenticated;
grant execute on function public.get_obsidian_browser_session(uuid,text) to anon, authenticated;
grant execute on function public.read_obsidian_notebook_events(uuid,text,bigint) to anon, authenticated;
grant execute on function public.append_obsidian_public_event(uuid,text,uuid,public.obsidian_event_kind,jsonb) to anon, authenticated;
grant execute on function public.append_obsidian_order_event(uuid,text,uuid,uuid) to authenticated;
grant execute on function public.close_obsidian_notebook_session(uuid,text) to anon, authenticated;
