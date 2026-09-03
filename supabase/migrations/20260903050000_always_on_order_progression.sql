alter table public.demo_order_progression_config
  alter column enabled set default true;

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
  if not new.enabled then
    raise exception 'automatic order progression cannot be disabled' using errcode = '55000';
  end if;

  new.updated_at := v_now;
  perform set_config('app.change_reason', 'Automated demo progression configuration changed', true);

  if old.pending_to_preparing_seconds is distinct from new.pending_to_preparing_seconds then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => new.pending_to_preparing_seconds),
        demo_paused_seconds = null
    where demo_auto_progress and status = 'pending_laboratory_review';
  end if;
  if old.preparing_to_testing_seconds is distinct from new.preparing_to_testing_seconds then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => new.preparing_to_testing_seconds),
        demo_paused_seconds = null
    where demo_auto_progress and status = 'preparing_samples';
  end if;
  if old.testing_to_analysis_seconds is distinct from new.testing_to_analysis_seconds then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => new.testing_to_analysis_seconds),
        demo_paused_seconds = null
    where demo_auto_progress and status = 'in_testing';
  end if;
  if old.analysis_to_review_seconds is distinct from new.analysis_to_review_seconds then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => new.analysis_to_review_seconds),
        demo_paused_seconds = null
    where demo_auto_progress and status = 'in_analysis';
  end if;
  if old.review_to_complete_seconds is distinct from new.review_to_complete_seconds then
    update public.test_orders
    set demo_next_transition_at = v_now + make_interval(secs => new.review_to_complete_seconds),
        demo_paused_seconds = null
    where demo_auto_progress and status = 'in_review';
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'clearsignal-demo-order-progression'
    and database = current_database()
    and username = current_user;
  if v_job_id is null then
    raise exception 'the automatic order progression cron job is missing' using errcode = '55000';
  end if;

  perform cron.alter_job(
    v_job_id,
    schedule := '1 second',
    command := 'select public.advance_demo_test_orders()',
    active := true
  );
  return new;
end;
$$;

update public.demo_order_progression_config
set enabled = true
where id = true;

alter table public.demo_order_progression_config
  add constraint demo_order_progression_always_enabled check (enabled);

update public.test_orders as o
set demo_auto_progress = true,
    demo_next_transition_at = clock_timestamp() + make_interval(secs => case o.status
      when 'pending_laboratory_review' then c.pending_to_preparing_seconds
      when 'preparing_samples' then c.preparing_to_testing_seconds
      when 'in_testing' then c.testing_to_analysis_seconds
      when 'in_analysis' then c.analysis_to_review_seconds
      when 'in_review' then c.review_to_complete_seconds
      when 'complete' then 0
    end),
    demo_paused_seconds = null
from public.demo_order_progression_config as c
where c.id = true
  and o.order_number = 'TR-20260903-ED1A7B2C'
  and o.status <> 'complete'
  and not o.demo_auto_progress;
