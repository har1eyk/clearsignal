create table public.obsidian_notebook_order_links (
  session_id uuid not null references public.obsidian_notebook_sessions(id),
  test_order_id uuid not null references public.test_orders(id),
  created_at timestamptz not null default now(),
  primary key (session_id, test_order_id)
);

create index obsidian_notebook_order_links_order_idx
  on public.obsidian_notebook_order_links(test_order_id, session_id);

alter table public.obsidian_notebook_order_links enable row level security;
revoke all on public.obsidian_notebook_order_links from public, anon, authenticated;

insert into public.obsidian_notebook_order_links(session_id, test_order_id)
select e.session_id, o.id
from public.obsidian_notebook_events e
join public.test_orders o on o.id::text = e.payload->>'order_id'
where e.kind = 'order'
on conflict do nothing;

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
  if v_event.id is not null and v_event.payload->>'order_id' is distinct from v_order.id::text then
    raise exception 'notebook operation belongs to another order' using errcode = '23505';
  end if;
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
      'catalog_version', v_order.catalog_version, 'status', v_order.status,
      'status_updated_at', v_order.status_updated_at
    )) returning * into v_event;
    update public.obsidian_notebook_sessions set created_by = auth.uid(), laboratory_id = v_order.lab_id
    where id = p_session_id;
  end if;
  insert into public.obsidian_notebook_order_links(session_id, test_order_id)
  values (p_session_id, v_order.id)
  on conflict do nothing;
  return jsonb_build_object('sequence', v_event.sequence_number, 'kind', v_event.kind,
    'operation_id', v_event.operation_id, 'payload', v_event.payload, 'created_at', v_event.created_at);
end;
$$;

create or replace function public.stamp_test_order_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    new.status_updated_at := now();
  else
    new.status_updated_at := old.status_updated_at;
  end if;
  return new;
end;
$$;

create trigger stamp_test_order_status_updated_at
before update of status on public.test_orders
for each row execute function public.stamp_test_order_status_updated_at();

create or replace function public.append_obsidian_order_status_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_sequence bigint;
  v_reason text := nullif(current_setting('app.change_reason', true), '');
begin
  if old.status is not distinct from new.status then return new; end if;
  for v_session in
    select s.id
    from public.obsidian_notebook_order_links l
    join public.obsidian_notebook_sessions s on s.id = l.session_id
    where l.test_order_id = new.id and s.status = 'open'
    order by s.id
    for update of s
  loop
    select coalesce(max(sequence_number), 0) + 1 into v_sequence
    from public.obsidian_notebook_events
    where session_id = v_session.id;
    insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload)
    values (v_session.id, v_sequence, 'order_status', gen_random_uuid(), jsonb_build_object(
      'order_id', new.id,
      'order_number', new.order_number,
      'previous_status', old.status,
      'status', new.status,
      'reason', v_reason,
      'changed_at', new.status_updated_at
    ));
  end loop;
  return new;
end;
$$;

create trigger append_obsidian_order_status_events
after update of status on public.test_orders
for each row
when (old.status is distinct from new.status)
execute function public.append_obsidian_order_status_events();

create or replace function public.set_test_order_status(
  p_order_id uuid,
  p_status public.test_order_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.test_orders%rowtype;
begin
  select * into v_order from public.test_orders where id = p_order_id for update;
  if not found then raise exception 'test order not found' using errcode = 'P0002'; end if;
  perform public.require_lab_role(v_order.lab_id, array['admin','analyst','reviewer']::public.lab_role[]);
  if nullif(trim(p_reason), '') is null then raise exception 'a status change reason is required'; end if;
  if v_order.status = p_status then
    return jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'status_updated_at', v_order.status_updated_at,
      'changed', false
    );
  end if;
  perform set_config('app.change_reason', trim(p_reason), true);
  update public.test_orders set status = p_status where id = p_order_id returning * into v_order;
  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'status_updated_at', v_order.status_updated_at,
    'changed', true
  );
end;
$$;

revoke all on function public.set_test_order_status(uuid, public.test_order_status, text) from public, anon;
grant execute on function public.set_test_order_status(uuid, public.test_order_status, text) to authenticated;
