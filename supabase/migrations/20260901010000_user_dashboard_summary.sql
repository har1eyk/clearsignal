create or replace function public.get_user_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_lab_id uuid;
  v_membership_count integer;
  v_testing_requests bigint;
  v_samples_in_progress bigint;
  v_approved_results bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*), min(lab_id::text)::uuid
    into v_membership_count, v_lab_id
  from public.lab_memberships
  where user_id = v_user_id
    and status = 'active';

  if v_membership_count = 0 then
    raise exception 'active laboratory membership required' using errcode = '42501';
  end if;
  if v_membership_count > 1 then
    raise exception 'multiple active laboratory memberships are not supported';
  end if;

  select count(*)
    into v_testing_requests
  from public.test_orders
  where lab_id = v_lab_id
    and created_by = v_user_id;

  select count(*)
    into v_samples_in_progress
  from public.samples
  where lab_id = v_lab_id
    and created_by = v_user_id
    and status in ('registered', 'received', 'in_storage', 'in_testing');

  select count(distinct assay_runs.id)
    into v_approved_results
  from public.assay_runs
  join public.run_samples on run_samples.run_id = assay_runs.id
  join public.samples on samples.id = run_samples.sample_id
  where assay_runs.lab_id = v_lab_id
    and assay_runs.status = 'approved'
    and samples.lab_id = v_lab_id
    and samples.created_by = v_user_id;

  return jsonb_build_object(
    'testingRequests', v_testing_requests,
    'samplesInProgress', v_samples_in_progress,
    'approvedResults', v_approved_results
  );
end;
$$;

revoke all on function public.get_user_dashboard_summary() from public, anon;
grant execute on function public.get_user_dashboard_summary() to authenticated;
