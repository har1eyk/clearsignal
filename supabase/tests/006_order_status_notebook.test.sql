begin;
select plan(31);

select has_type('public', 'test_order_status', 'order status enum exists');
select has_column('public', 'test_orders', 'status', 'orders persist their status');
select has_column('public', 'test_orders', 'status_updated_at', 'orders retain the status update time');
select has_table('public', 'obsidian_notebook_order_links', 'notebook sessions link to orders');
select has_function('public', 'set_test_order_status', array['uuid','test_order_status','text'], 'status update RPC exists');
select ok('order_status' = any(enum_range(null::public.obsidian_event_kind)::text[]), 'notebook event enum includes order status');

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','16000000-0000-4000-8000-000000000001','authenticated','authenticated','status-analyst@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','16000000-0000-4000-8000-000000000002','authenticated','authenticated','status-admin@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','16000000-0000-4000-8000-000000000003','authenticated','authenticated','status-reviewer@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','16000000-0000-4000-8000-000000000004','authenticated','authenticated','status-viewer@example.test','',now(),'{}','{}',now(),now(),'','','','');

insert into public.laboratories(id, name, created_by)
values ('26000000-0000-4000-8000-000000000001','Order Status Lab','16000000-0000-4000-8000-000000000002');

insert into public.lab_memberships(lab_id,user_id,role,created_by) values
  ('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','analyst','16000000-0000-4000-8000-000000000002'),
  ('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000002','admin','16000000-0000-4000-8000-000000000002'),
  ('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000003','reviewer','16000000-0000-4000-8000-000000000002'),
  ('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000004','viewer','16000000-0000-4000-8000-000000000002');

insert into public.test_orders(id, lab_id, order_number, created_by)
values ('36000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','TR-STATUS-1','16000000-0000-4000-8000-000000000001');

insert into public.obsidian_notebook_sessions(
  id, request_sha256, read_token_sha256, browser_token_sha256, status, closed_at
) values
  ('56000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),repeat('c',64),'open',null),
  ('56000000-0000-4000-8000-000000000002',repeat('d',64),repeat('e',64),repeat('f',64),'closed',now()),
  ('56000000-0000-4000-8000-000000000003',repeat('1',64),repeat('2',64),repeat('3',64),'open',null);

insert into public.obsidian_notebook_order_links(session_id, test_order_id)
values ('56000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000001');

select is(
  (select status::text from public.test_orders where id='36000000-0000-4000-8000-000000000001'),
  'pending_laboratory_review', 'orders default to pending laboratory review'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok(
  $$select public.append_obsidian_order_event(
    '56000000-0000-4000-8000-000000000001',repeat('c',64),
    '66000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000001'
  )$$, 'the canonical order event establishes the notebook link'
);
select is(
  (select count(*) from public.obsidian_notebook_order_links where session_id='56000000-0000-4000-8000-000000000001'),
  1::bigint, 'the order event stores one normalized link'
);
select is(
  (select payload->>'status' from public.obsidian_notebook_events where session_id='56000000-0000-4000-8000-000000000001' and kind='order'),
  'pending_laboratory_review', 'the initial notebook order event reads the persisted status'
);

select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','preparing_samples','Samples entered preparation')$$,
  'analysts can update an order status'
);
select is(
  (select status::text from public.test_orders where id='36000000-0000-4000-8000-000000000001'),
  'preparing_samples', 'the status is persisted'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='56000000-0000-4000-8000-000000000001' and kind='order_status'),
  1::bigint, 'a real status change appends one notebook event'
);
select results_eq(
  $$select payload->>'previous_status', payload->>'status', payload->>'reason'
    from public.obsidian_notebook_events
    where session_id='56000000-0000-4000-8000-000000000001' and kind='order_status'$$,
  $$values ('pending_laboratory_review'::text,'preparing_samples'::text,'Samples entered preparation'::text)$$,
  'the event records the transition and audit reason'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='56000000-0000-4000-8000-000000000002'),
  0::bigint, 'closed linked sessions receive no status event'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='56000000-0000-4000-8000-000000000003'),
  0::bigint, 'unrelated open sessions receive no status event'
);
select is(
  (public.set_test_order_status('36000000-0000-4000-8000-000000000001','preparing_samples','No change')->>'changed')::boolean,
  false, 'setting the current status is a no-op'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='56000000-0000-4000-8000-000000000001' and kind='order_status'),
  1::bigint, 'a no-op creates no duplicate notebook event'
);

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000003',true);
select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','in_testing','Testing started')$$,
  'reviewers can update an order status'
);

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000002',true);
select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','in_analysis','Analysis started')$$,
  'administrators can update an order status'
);

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','in_review','Review started')$$,
  'in-review status is accepted'
);
select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','complete','Review complete')$$,
  'complete status is accepted'
);
select lives_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','preparing_samples','Reopened for preparation')$$,
  'backward status movement is accepted'
);
select is(
  (select status::text from public.test_orders where id='36000000-0000-4000-8000-000000000001'),
  'preparing_samples', 'the backward status is persisted'
);
select results_eq(
  $$select sequence_number from public.obsidian_notebook_events
    where session_id='56000000-0000-4000-8000-000000000001' order by sequence_number$$,
  $$values (1::bigint),(2::bigint),(3::bigint),(4::bigint),(5::bigint),(6::bigint),(7::bigint)$$,
  'order and status events retain unique monotonic sequences'
);

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000004',true);
select throws_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','complete','Viewer attempt')$$,
  '42501', 'not authorized for laboratory', 'viewers cannot update an order status'
);

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','complete','   ')$$,
  'P0001', 'a status change reason is required', 'blank reasons are rejected'
);
select is(
  (select reason from public.audit_events where entity_type='test_orders' and entity_id='36000000-0000-4000-8000-000000000001' order by occurred_at desc limit 1),
  'Reopened for preparation', 'the audit trail retains the latest status reason'
);
select ok(
  has_function_privilege('authenticated','public.set_test_order_status(uuid,public.test_order_status,text)','execute'),
  'authenticated callers can invoke the guarded status RPC'
);
select ok(
  not has_function_privilege('anon','public.set_test_order_status(uuid,public.test_order_status,text)','execute'),
  'anonymous callers cannot invoke the status RPC'
);

set local role anon;
select throws_ok(
  $$select public.set_test_order_status('36000000-0000-4000-8000-000000000001','complete','Anonymous attempt')$$,
  '42501', 'permission denied for function set_test_order_status', 'anonymous callers are denied at the function boundary'
);

select * from finish();
rollback;
