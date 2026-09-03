begin;
select plan(47);

select has_table('public', 'demo_order_progression_config', 'demo progression configuration exists');
select has_column('public', 'test_orders', 'demo_auto_progress', 'orders record demo enrollment');
select has_column('public', 'test_orders', 'demo_next_transition_at', 'orders record the next demo transition');
select has_column('public', 'test_orders', 'demo_paused_seconds', 'orders retain paused demo time');
select has_function('public', 'advance_demo_test_orders', array['integer'], 'private progression worker exists');
select is(
  (select enabled from public.demo_order_progression_config where id),
  true,
  'automatic progression defaults on'
);
select results_eq(
  $$select pending_to_preparing_seconds, preparing_to_testing_seconds,
      testing_to_analysis_seconds, analysis_to_review_seconds,
      review_to_complete_seconds
    from public.demo_order_progression_config where id$$,
  $$values (20, 5, 5, 5, 5)$$,
  'demo progression has the presentation defaults'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.demo_order_progression_config'::regclass),
  true,
  'demo configuration has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.demo_order_progression_config', 'select'),
  'anonymous clients cannot read demo configuration'
);
select ok(
  not has_table_privilege('authenticated', 'public.demo_order_progression_config', 'update'),
  'authenticated clients cannot change demo configuration'
);
select ok(
  not has_function_privilege('anon', 'public.advance_demo_test_orders(integer)', 'execute'),
  'anonymous clients cannot run the progression worker'
);
select ok(
  not has_function_privilege('authenticated', 'public.advance_demo_test_orders(integer)', 'execute'),
  'authenticated clients cannot run the progression worker'
);
select is(
  (select count(*) from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  1::bigint,
  'one named demo progression job is installed'
);
select is(
  (select schedule from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  '1 second',
  'the demo worker runs with one-second precision'
);
select is(
  (select active from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  true,
  'the cron job defaults active'
);
select throws_ok(
  $$delete from public.demo_order_progression_config where id$$,
  '55000',
  'demo progression configuration cannot be deleted',
  'the required singleton configuration cannot be deleted'
);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '18000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'demo-progression@example.test', '', now(),
  '{}', '{}', now(), now(), '', '', '', ''
);

insert into public.laboratories(id, name, created_by)
values (
  '28000000-0000-4000-8000-000000000001',
  'Demo Progression Lab',
  '18000000-0000-4000-8000-000000000001'
);
insert into public.lab_memberships(lab_id, user_id, role, created_by)
values (
  '28000000-0000-4000-8000-000000000001',
  '18000000-0000-4000-8000-000000000001',
  'analyst',
  '18000000-0000-4000-8000-000000000001'
);

insert into public.test_orders(id, lab_id, order_number, status, created_by)
values (
  '38000000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  'TR-DEMO-COMPLETE',
  'complete',
  '18000000-0000-4000-8000-000000000001'
);

select is(
  (select demo_auto_progress from public.test_orders where id = '38000000-0000-4000-8000-000000000001'),
  false,
  'completed orders are not enrolled'
);

select is(
  (select active from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  true,
  'the progression job remains active'
);

insert into public.test_orders(id, lab_id, order_number, created_by)
values (
  '38000000-0000-4000-8000-000000000002',
  '28000000-0000-4000-8000-000000000001',
  'TR-DEMO-ACTIVE',
  '18000000-0000-4000-8000-000000000001'
);

select is(
  (select demo_auto_progress from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  true,
  'new orders are enrolled while demo mode is enabled'
);
select ok(
  (select demo_next_transition_at between clock_timestamp() + interval '19 seconds'
      and clock_timestamp() + interval '21 seconds'
   from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'the first transition uses the 20-second delay'
);
select is(
  (select demo_auto_progress from public.test_orders where id = '38000000-0000-4000-8000-000000000001'),
  false,
  'completed orders remain outside progression'
);

insert into public.obsidian_notebook_sessions(
  id, request_sha256, read_token_sha256, browser_token_sha256
) values (
  '58000000-0000-4000-8000-000000000001',
  repeat('a', 64), repeat('b', 64), repeat('c', 64)
);
insert into public.obsidian_notebook_events(
  session_id, sequence_number, kind, operation_id, payload
) values (
  '58000000-0000-4000-8000-000000000001', 1, 'order',
  '68000000-0000-4000-8000-000000000001',
  '{"order_id":"38000000-0000-4000-8000-000000000002","status":"pending_laboratory_review"}'::jsonb
);
insert into public.obsidian_notebook_order_links(session_id, test_order_id)
values (
  '58000000-0000-4000-8000-000000000001',
  '38000000-0000-4000-8000-000000000002'
);

update public.test_orders
set demo_next_transition_at = clock_timestamp() - interval '1 second'
where id = '38000000-0000-4000-8000-000000000002';

select is(public.advance_demo_test_orders(), 1, 'the worker advances one due order');
select is(
  (select status::text from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'preparing_samples',
  'the first automatic status is preparing samples'
);
select ok(
  (select demo_next_transition_at between clock_timestamp() + interval '4 seconds'
      and clock_timestamp() + interval '6 seconds'
   from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'the worker schedules the next five-second delay'
);
select results_eq(
  $$select payload->>'previous_status', payload->>'status', payload->>'reason'
    from public.obsidian_notebook_events
    where session_id = '58000000-0000-4000-8000-000000000001'
      and sequence_number = 2$$,
  $$values (
    'pending_laboratory_review'::text,
    'preparing_samples'::text,
    'Automated demo progression'::text
  )$$,
  'automatic changes use the existing notebook event trigger'
);
select is(public.advance_demo_test_orders(), 0, 'an immediate duplicate worker run is a no-op');

update public.test_orders set demo_next_transition_at = clock_timestamp() - interval '1 second'
where id = '38000000-0000-4000-8000-000000000002';
select is(public.advance_demo_test_orders(), 1, 'the second transition becomes due');
select is(
  (select status::text from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'in_testing',
  'the second automatic status is in testing'
);

update public.test_orders set demo_next_transition_at = clock_timestamp() - interval '1 second'
where id = '38000000-0000-4000-8000-000000000002';
select is(public.advance_demo_test_orders(), 1, 'the third transition becomes due');
select is(
  (select status::text from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'in_analysis',
  'the third automatic status is in analysis'
);

update public.test_orders set demo_next_transition_at = clock_timestamp() - interval '1 second'
where id = '38000000-0000-4000-8000-000000000002';
select is(public.advance_demo_test_orders(), 1, 'the fourth transition becomes due');
select is(
  (select status::text from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'in_review',
  'the fourth automatic status is in review'
);

update public.test_orders set demo_next_transition_at = clock_timestamp() - interval '1 second'
where id = '38000000-0000-4000-8000-000000000002';
select is(public.advance_demo_test_orders(), 1, 'the final transition becomes due');
select is(
  (select status::text from public.test_orders where id = '38000000-0000-4000-8000-000000000002'),
  'complete',
  'the final automatic status is complete'
);
select results_eq(
  $$select demo_auto_progress, demo_next_transition_at, demo_paused_seconds
    from public.test_orders where id = '38000000-0000-4000-8000-000000000002'$$,
  $$values (false, null::timestamptz, null::integer)$$,
  'completion permanently clears demo progression state'
);
select results_eq(
  $$select sequence_number from public.obsidian_notebook_events
    where session_id = '58000000-0000-4000-8000-000000000001'
    order by sequence_number$$,
  $$values (1::bigint), (2::bigint), (3::bigint), (4::bigint), (5::bigint), (6::bigint), (7::bigint)$$,
  'all automatic notebook events retain monotonic sequence numbers'
);
select is(
  (select status::text from public.obsidian_notebook_sessions where id = '58000000-0000-4000-8000-000000000001'),
  'closing',
  'automatic completion starts the existing notebook closing handshake'
);
select is(
  (select count(*) from public.audit_events
   where entity_type = 'test_orders'
     and entity_id = '38000000-0000-4000-8000-000000000002'
     and before_data->>'status' is distinct from after_data->>'status'
     and reason = 'Automated demo progression'),
  5::bigint,
  'all five automatic transitions are explicitly audited'
);

insert into public.test_orders(id, lab_id, order_number, created_by)
values (
  '38000000-0000-4000-8000-000000000003',
  '28000000-0000-4000-8000-000000000001',
  'TR-DEMO-CONFIG',
  '18000000-0000-4000-8000-000000000001'
);
select throws_ok(
  $$update public.demo_order_progression_config set enabled = false where id$$,
  '55000',
  'automatic order progression cannot be disabled',
  'automatic progression cannot be disabled'
);
select is(
  (select enabled from public.demo_order_progression_config where id),
  true,
  'a rejected disable leaves progression enabled'
);
select is(
  (select active from cron.job
   where jobname = 'clearsignal-demo-order-progression'
     and database = current_database()
     and username = current_user),
  true,
  'a rejected disable leaves the cron job active'
);

update public.demo_order_progression_config
set pending_to_preparing_seconds = 30
where id;
select ok(
  (select demo_next_transition_at between clock_timestamp() + interval '29 seconds'
      and clock_timestamp() + interval '31 seconds'
   from public.test_orders where id = '38000000-0000-4000-8000-000000000003'),
  'editing the current delay restarts the active countdown'
);
select results_eq(
  $$select demo_next_transition_at is not null, demo_paused_seconds is null
    from public.test_orders where id = '38000000-0000-4000-8000-000000000003'$$,
  $$values (true, true)$$,
  'always-on orders retain an active countdown instead of paused state'
);

insert into public.test_orders(id, lab_id, order_number, created_by)
values (
  '38000000-0000-4000-8000-000000000004',
  '28000000-0000-4000-8000-000000000001',
  'TR-DEMO-ALWAYS-ON',
  '18000000-0000-4000-8000-000000000001'
);
select is(
  (select demo_auto_progress from public.test_orders where id = '38000000-0000-4000-8000-000000000004'),
  true,
  'new orders are always enrolled'
);
select ok(
  pg_get_functiondef('public.advance_demo_test_orders(integer)'::regprocedure) ilike '%for update skip locked%',
  'the worker claims due orders with skip-locked row locks'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"18000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.set_test_order_status(
    '38000000-0000-4000-8000-000000000003',
    'in_testing',
    'Manual demo correction'
  )$$,
  'manual status changes remain available for enrolled demo orders'
);
select results_eq(
  $$select demo_auto_progress,
      demo_next_transition_at between clock_timestamp() + interval '4 seconds'
        and clock_timestamp() + interval '6 seconds',
      demo_paused_seconds is null
    from public.test_orders
    where id = '38000000-0000-4000-8000-000000000003'$$,
  $$values (true, true, true)$$,
  'a manual change adopts an active countdown for its new stage'
);

select * from finish();
rollback;
