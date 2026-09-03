create extension if not exists pg_cron;

create table public.demo_order_progression_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  pending_to_preparing_seconds integer not null default 20
    check (pending_to_preparing_seconds between 5 and 86400),
  preparing_to_testing_seconds integer not null default 5
    check (preparing_to_testing_seconds between 5 and 86400),
  testing_to_analysis_seconds integer not null default 5
    check (testing_to_analysis_seconds between 5 and 86400),
  analysis_to_review_seconds integer not null default 5
    check (analysis_to_review_seconds between 5 and 86400),
  review_to_complete_seconds integer not null default 5
    check (review_to_complete_seconds between 5 and 86400),
  updated_at timestamptz not null default now()
);

insert into public.demo_order_progression_config(id) values (true);

alter table public.demo_order_progression_config enable row level security;
revoke all on public.demo_order_progression_config from public, anon, authenticated;

alter table public.test_orders
  add column demo_auto_progress boolean not null default false,
  add column demo_next_transition_at timestamptz,
  add column demo_paused_seconds integer check (demo_paused_seconds is null or demo_paused_seconds >= 0),
  add constraint test_orders_demo_progression_state check (
    (demo_auto_progress and num_nonnulls(demo_next_transition_at, demo_paused_seconds) = 1)
    or (
      not demo_auto_progress
      and demo_next_transition_at is null
      and demo_paused_seconds is null
    )
  );

create index test_orders_demo_progression_due_idx
  on public.test_orders(demo_next_transition_at, id)
  where demo_auto_progress and demo_next_transition_at is not null;

create or replace function public.enroll_demo_test_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.demo_order_progression_config%rowtype;
begin
  select * into strict v_config
  from public.demo_order_progression_config
  where id = true;

  if v_config.enabled and new.status <> 'complete' then
    new.demo_auto_progress := true;
    new.demo_next_transition_at := clock_timestamp()
      + make_interval(secs => case new.status
          when 'pending_laboratory_review' then v_config.pending_to_preparing_seconds
          when 'preparing_samples' then v_config.preparing_to_testing_seconds
          when 'in_testing' then v_config.testing_to_analysis_seconds
          when 'in_analysis' then v_config.analysis_to_review_seconds
          when 'in_review' then v_config.review_to_complete_seconds
          when 'complete' then null
        end);
    new.demo_paused_seconds := null;
  else
    new.demo_auto_progress := false;
    new.demo_next_transition_at := null;
    new.demo_paused_seconds := null;
  end if;
  return new;
end;
$$;

create trigger enroll_demo_test_order
before insert on public.test_orders
for each row execute function public.enroll_demo_test_order();

create or replace function public.schedule_next_demo_order_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.demo_order_progression_config%rowtype;
  v_delay integer;
begin
  if old.status is not distinct from new.status or not old.demo_auto_progress then
    return new;
  end if;

  if new.status = 'complete' then
    new.demo_auto_progress := false;
    new.demo_next_transition_at := null;
    new.demo_paused_seconds := null;
    return new;
  end if;

  select * into strict v_config
  from public.demo_order_progression_config
  where id = true;
  v_delay := case new.status
    when 'pending_laboratory_review' then v_config.pending_to_preparing_seconds
    when 'preparing_samples' then v_config.preparing_to_testing_seconds
    when 'in_testing' then v_config.testing_to_analysis_seconds
    when 'in_analysis' then v_config.analysis_to_review_seconds
    when 'in_review' then v_config.review_to_complete_seconds
    when 'complete' then 0
  end;

  new.demo_auto_progress := true;
  if v_config.enabled then
    new.demo_next_transition_at := clock_timestamp() + make_interval(secs => v_delay);
    new.demo_paused_seconds := null;
  else
    new.demo_next_transition_at := null;
    new.demo_paused_seconds := v_delay;
  end if;
  return new;
end;
$$;

create trigger schedule_next_demo_order_transition
before update of status on public.test_orders
for each row execute function public.schedule_next_demo_order_transition();

create or replace function public.advance_demo_test_orders(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.demo_order_progression_config%rowtype;
  v_updated integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'demo progression batch size must be between 1 and 1000';
  end if;

  select * into strict v_config
  from public.demo_order_progression_config
  where id = true
  for share;
  if not v_config.enabled then return 0; end if;

  perform set_config('app.change_reason', 'Automated demo progression', true);
  with due as (
    select id
    from public.test_orders
    where demo_auto_progress
      and demo_next_transition_at <= clock_timestamp()
      and status <> 'complete'
    order by demo_next_transition_at, id
    for update skip locked
    limit p_batch_size
  )
  update public.test_orders as o
  set status = case o.status
    when 'pending_laboratory_review' then 'preparing_samples'::public.test_order_status
    when 'preparing_samples' then 'in_testing'::public.test_order_status
    when 'in_testing' then 'in_analysis'::public.test_order_status
    when 'in_analysis' then 'in_review'::public.test_order_status
    when 'in_review' then 'complete'::public.test_order_status
    when 'complete' then 'complete'::public.test_order_status
  end
  from due
  where o.id = due.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.advance_demo_test_orders(integer) from public, anon, authenticated;

select cron.schedule(
  'clearsignal-demo-order-progression',
  '1 second',
  'select public.advance_demo_test_orders()'
);

select cron.alter_job(
  (select jobid from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  active := false
);

create or replace function public.apply_demo_order_progression_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_job_id bigint;
begin
  if old.id is distinct from new.id then
    raise exception 'the demo progression configuration id cannot be changed';
  end if;

  new.updated_at := v_now;
  perform set_config('app.change_reason', 'Automated demo progression configuration changed', true);

  if old.enabled and not new.enabled then
    update public.test_orders
    set demo_paused_seconds = greatest(
          0,
          ceil(extract(epoch from (demo_next_transition_at - v_now)))::integer
        ),
        demo_next_transition_at = null
    where demo_auto_progress and demo_next_transition_at is not null;
  elsif not old.enabled and new.enabled then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => coalesce(demo_paused_seconds, 0)),
        demo_paused_seconds = null
    where demo_auto_progress and demo_next_transition_at is null;
  end if;

  if old.pending_to_preparing_seconds is distinct from new.pending_to_preparing_seconds then
    update public.test_orders
    set demo_next_transition_at = case when new.enabled then v_now + make_interval(secs => new.pending_to_preparing_seconds) end,
        demo_paused_seconds = case when new.enabled then null else new.pending_to_preparing_seconds end
    where demo_auto_progress and status = 'pending_laboratory_review';
  end if;
  if old.preparing_to_testing_seconds is distinct from new.preparing_to_testing_seconds then
    update public.test_orders
    set demo_next_transition_at = case when new.enabled then v_now + make_interval(secs => new.preparing_to_testing_seconds) end,
        demo_paused_seconds = case when new.enabled then null else new.preparing_to_testing_seconds end
    where demo_auto_progress and status = 'preparing_samples';
  end if;
  if old.testing_to_analysis_seconds is distinct from new.testing_to_analysis_seconds then
    update public.test_orders
    set demo_next_transition_at = case when new.enabled then v_now + make_interval(secs => new.testing_to_analysis_seconds) end,
        demo_paused_seconds = case when new.enabled then null else new.testing_to_analysis_seconds end
    where demo_auto_progress and status = 'in_testing';
  end if;
  if old.analysis_to_review_seconds is distinct from new.analysis_to_review_seconds then
    update public.test_orders
    set demo_next_transition_at = case when new.enabled then v_now + make_interval(secs => new.analysis_to_review_seconds) end,
        demo_paused_seconds = case when new.enabled then null else new.analysis_to_review_seconds end
    where demo_auto_progress and status = 'in_analysis';
  end if;
  if old.review_to_complete_seconds is distinct from new.review_to_complete_seconds then
    update public.test_orders
    set demo_next_transition_at = case when new.enabled then v_now + make_interval(secs => new.review_to_complete_seconds) end,
        demo_paused_seconds = case when new.enabled then null else new.review_to_complete_seconds end
    where demo_auto_progress and status = 'in_review';
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'clearsignal-demo-order-progression'
    and database = current_database()
    and username = current_user;
  if v_job_id is not null then
    perform cron.alter_job(v_job_id, active := new.enabled);
  end if;
  return new;
end;
$$;

create trigger apply_demo_order_progression_config
before update on public.demo_order_progression_config
for each row execute function public.apply_demo_order_progression_config();

create or replace function public.prevent_demo_order_progression_config_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'demo progression configuration cannot be deleted' using errcode = '55000';
end;
$$;

create trigger prevent_demo_order_progression_config_delete
before delete on public.demo_order_progression_config
for each row execute function public.prevent_demo_order_progression_config_delete();

revoke all on function public.enroll_demo_test_order() from public, anon, authenticated;
revoke all on function public.schedule_next_demo_order_transition() from public, anon, authenticated;
revoke all on function public.apply_demo_order_progression_config() from public, anon, authenticated;
revoke all on function public.prevent_demo_order_progression_config_delete() from public, anon, authenticated;
