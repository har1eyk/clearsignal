alter table public.obsidian_notebook_sessions
  drop constraint obsidian_session_close_consistency;

alter table public.obsidian_notebook_sessions
  add constraint obsidian_session_close_consistency check (
    (status in ('open', 'closing') and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  );

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
  if v_session.status = 'closed' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
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
  if v_session.status = 'closed' then raise exception 'notebook session is closed' using errcode = '55000'; end if;
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
    if new.status = 'complete' then
      update public.obsidian_notebook_sessions
      set status = 'closing'
      where id = v_session.id;
    end if;
  end loop;
  return new;
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
  if v_session.status <> 'closed' then
    update public.obsidian_notebook_sessions set status = 'closed', closed_at = now()
    where id = p_session_id returning * into v_session;
  end if;
  return jsonb_build_object('session_id', v_session.id, 'status', v_session.status,
    'closed_at', v_session.closed_at, 'server_time', now());
end;
$$;
