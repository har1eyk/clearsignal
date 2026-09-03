begin;
select plan(20);

select ok(
  'results' = any(enum_range(null::public.obsidian_event_kind)::text[]),
  'notebook event enum includes results'
);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '19000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'demo-results@example.test', '', now(),
  '{}', '{}', now(), now(), '', '', '', ''
);

insert into public.laboratories(id, name, created_by)
values (
  '29000000-0000-4000-8000-000000000001',
  'Demo Results Lab',
  '19000000-0000-4000-8000-000000000001'
);

insert into public.lab_memberships(lab_id, user_id, role, created_by)
values (
  '29000000-0000-4000-8000-000000000001',
  '19000000-0000-4000-8000-000000000001',
  'analyst',
  '19000000-0000-4000-8000-000000000001'
);

insert into public.test_orders(id, lab_id, order_number, created_by)
values (
  '39000000-0000-4000-8000-000000000001',
  '29000000-0000-4000-8000-000000000001',
  'TR-DEMO-RESULTS',
  '19000000-0000-4000-8000-000000000001'
);

insert into public.samples(id, lab_id, test_order_id, external_id, matrix, created_by, created_at) values
  ('79000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','sample-0003','water','19000000-0000-4000-8000-000000000001','2026-09-03T12:00:00Z'),
  ('79000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','sample-0004','water','19000000-0000-4000-8000-000000000001','2026-09-03T12:00:01Z');

insert into public.obsidian_notebook_sessions(
  id, request_sha256, read_token_sha256, browser_token_sha256
) values
  ('59000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),repeat('c',64)),
  ('59000000-0000-4000-8000-000000000002',repeat('d',64),repeat('e',64),repeat('f',64));

insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload) values
  ('59000000-0000-4000-8000-000000000001',1,'order','69000000-0000-4000-8000-000000000001','{"order_number":"TR-DEMO-RESULTS"}'::jsonb),
  ('59000000-0000-4000-8000-000000000002',1,'order','69000000-0000-4000-8000-000000000002','{"order_number":"TR-DEMO-RESULTS"}'::jsonb);

insert into public.obsidian_notebook_order_links(session_id, test_order_id) values
  ('59000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001'),
  ('59000000-0000-4000-8000-000000000002','39000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok(
  $$select public.set_test_order_status('39000000-0000-4000-8000-000000000001','in_review','Review started')$$,
  'a pre-completion transition succeeds'
);
select is(
  (select count(*) from public.obsidian_notebook_events where kind = 'results'),
  0::bigint,
  'results are not emitted before completion'
);
select lives_ok(
  $$select public.set_test_order_status('39000000-0000-4000-8000-000000000001','complete','Review completed')$$,
  'completion emits simulated results'
);

select results_eq(
  $$select sequence_number, kind::text
    from public.obsidian_notebook_events
    where session_id = '59000000-0000-4000-8000-000000000001'
    order by sequence_number$$,
  $$values (1::bigint,'order'::text),(2::bigint,'order_status'::text),(3::bigint,'order_status'::text),(4::bigint,'results'::text)$$,
  'results are the final event after the complete status'
);
select results_eq(
  $$select item->>'sample_id'
    from public.obsidian_notebook_events e,
      jsonb_array_elements(e.payload->'sample_results') with ordinality as samples(item, ordinal)
    where e.session_id = '59000000-0000-4000-8000-000000000001' and e.kind = 'results'
    order by ordinal$$,
  $$values ('sample-0003'::text),('sample-0004'::text)$$,
  'sample results preserve laboratory order'
);
select is(
  (select jsonb_array_length(payload->'sample_results') from public.obsidian_notebook_events
   where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'),
  2,
  'every ordered sample receives one result'
);
select ok(
  (select bool_and((item->>'endotoxin_eu_ml')::numeric between 0.01 and 0.25)
   from public.obsidian_notebook_events e,
     jsonb_array_elements(e.payload->'sample_results') as samples(item)
   where e.session_id = '59000000-0000-4000-8000-000000000001' and e.kind = 'results'),
  'all values are within the requested demo range'
);
select ok(
  (select bool_and((item->>'endotoxin_eu_ml')::numeric * 1000 = trunc((item->>'endotoxin_eu_ml')::numeric * 1000))
   from public.obsidian_notebook_events e,
     jsonb_array_elements(e.payload->'sample_results') as samples(item)
   where e.session_id = '59000000-0000-4000-8000-000000000001' and e.kind = 'results'),
  'all values have no more than three decimal places'
);
select ok(
  (select count(*) >= 1
   from public.obsidian_notebook_events e,
     jsonb_array_elements(e.payload->'sample_results') as samples(item)
   where e.session_id = '59000000-0000-4000-8000-000000000001'
     and e.kind = 'results' and item->>'qualitative_result' = 'negative'),
  'at least one sample is negative'
);
select ok(
  (select bool_and(
      ((item->>'endotoxin_eu_ml')::numeric <= 0.05 and item->>'qualitative_result' = 'negative')
      or ((item->>'endotoxin_eu_ml')::numeric > 0.05 and item->>'qualitative_result' = 'positive')
    )
   from public.obsidian_notebook_events e,
     jsonb_array_elements(e.payload->'sample_results') as samples(item)
   where e.session_id = '59000000-0000-4000-8000-000000000001' and e.kind = 'results'),
  'the demo cutoff controls every qualitative result'
);
select results_eq(
  $$select payload->>'units', (payload->>'negative_cutoff_eu_ml')::numeric, (payload->>'simulated')::boolean
    from public.obsidian_notebook_events
    where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'$$,
  $$values ('EU/mL'::text,0.05::numeric,true)$$,
  'results identify their units, demo cutoff, and simulated status'
);
select results_eq(
  $$select (point->>'log_conc')::numeric, (point->>'log_avg_rfu')::numeric
    from public.obsidian_notebook_events e,
      jsonb_array_elements(e.payload->'standard_curve'->'points') with ordinality as curve(point, ordinal)
    where e.session_id = '59000000-0000-4000-8000-000000000001' and e.kind = 'results'
    order by ordinal$$,
  $$values
    (0.698970004::numeric,5.494701294::numeric),
    (-0.301029996::numeric,4.581733538::numeric),
    (-1.301029996::numeric,3.573161809::numeric),
    (-2.301029996::numeric,2.457124626::numeric)$$,
  'the standard curve uses the exact shared points'
);
select is(
  (select payload from public.obsidian_notebook_events where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'),
  (select payload from public.obsidian_notebook_events where session_id = '59000000-0000-4000-8000-000000000002' and kind = 'results'),
  'all linked sessions receive the same persisted result payload'
);
select is(
  (select operation_id from public.obsidian_notebook_events where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'),
  (select operation_id from public.obsidian_notebook_events where session_id = '59000000-0000-4000-8000-000000000002' and kind = 'results'),
  'linked sessions share one result operation identity'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions
   where id in ('59000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000002') and status = 'closing'),
  2::bigint,
  'all linked sessions start closing after results are appended'
);
select is(
  jsonb_array_length(public.read_obsidian_notebook_events(
    '59000000-0000-4000-8000-000000000001',repeat('b',64),2
  )->'events'),
  2,
  'the final plugin poll receives Complete and Results together'
);
select is(
  public.read_obsidian_notebook_events(
    '59000000-0000-4000-8000-000000000001',repeat('b',64),2
  )->'events'->1->'payload',
  (select payload from public.obsidian_notebook_events
   where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'),
  'repeated reads return the persisted result values'
);
select ok(
  (select (payload->>'reported_at')::timestamptz is not null from public.obsidian_notebook_events
   where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'),
  'results include a report timestamp'
);
select results_eq(
  $$select payload->'standard_curve'->>'x_axis', payload->'standard_curve'->>'y_axis'
    from public.obsidian_notebook_events
    where session_id = '59000000-0000-4000-8000-000000000001' and kind = 'results'$$,
  $$values ('LogConc'::text,'LogAvgRFU'::text)$$,
  'the standard curve names its X and Y axes'
);

select * from finish();
rollback;
