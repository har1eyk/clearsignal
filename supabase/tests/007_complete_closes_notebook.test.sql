begin;
select plan(27);

select ok('closing' = any(enum_range(null::public.obsidian_session_status)::text[]), 'notebook session enum includes closing');

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','17000000-0000-4000-8000-000000000001','authenticated','authenticated','closing-analyst@example.test','',now(),'{}','{}',now(),now(),'','','','');

insert into public.laboratories(id, name, created_by)
values ('27000000-0000-4000-8000-000000000001','Notebook Closing Lab','17000000-0000-4000-8000-000000000001');

insert into public.lab_memberships(lab_id,user_id,role,created_by)
values ('27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000001','analyst','17000000-0000-4000-8000-000000000001');

insert into public.test_orders(id, lab_id, order_number, created_by)
values ('37000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','TR-CLOSING-1','17000000-0000-4000-8000-000000000001');

insert into public.obsidian_notebook_sessions(
  id, request_sha256, read_token_sha256, browser_token_sha256, status, closed_at
) values
  ('57000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),repeat('c',64),'open',null),
  ('57000000-0000-4000-8000-000000000002',repeat('d',64),repeat('e',64),repeat('f',64),'open',null),
  ('57000000-0000-4000-8000-000000000003',repeat('1',64),repeat('2',64),repeat('3',64),'closed',now()),
  ('57000000-0000-4000-8000-000000000004',repeat('4',64),repeat('5',64),repeat('6',64),'open',null);

insert into public.obsidian_notebook_order_links(session_id, test_order_id) values
  ('57000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000001'),
  ('57000000-0000-4000-8000-000000000002','37000000-0000-4000-8000-000000000001'),
  ('57000000-0000-4000-8000-000000000003','37000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok(
  $$select public.set_test_order_status('37000000-0000-4000-8000-000000000001','in_review','Review started')$$,
  'a non-complete status change succeeds'
);
select is(
  (select count(*) from public.obsidian_notebook_events where kind='order_status' and session_id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  )), 2::bigint, 'both linked open sessions receive the non-complete event'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions where id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  ) and status='open'), 2::bigint, 'non-complete events leave linked sessions open'
);

select lives_ok(
  $$select public.set_test_order_status('37000000-0000-4000-8000-000000000001','complete','Review completed')$$,
  'completion succeeds'
);
select results_eq(
  $$select payload->>'previous_status', payload->>'status', payload->>'reason'
    from public.obsidian_notebook_events
    where session_id='57000000-0000-4000-8000-000000000001' and sequence_number=2$$,
  $$values ('in_review'::text,'complete'::text,'Review completed'::text)$$,
  'the final event contains the complete transition and reason'
);
select results_eq(
  $$select sequence_number from public.obsidian_notebook_events
    where session_id='57000000-0000-4000-8000-000000000001' order by sequence_number$$,
  $$values (1::bigint),(2::bigint)$$,
  'the final event receives the next monotonic sequence'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions where id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  ) and status='closing'), 2::bigint, 'every linked open session enters closing'
);
select is(
  (select status::text from public.obsidian_notebook_sessions where id='57000000-0000-4000-8000-000000000004'),
  'open', 'an unrelated session remains open'
);
select is(
  (select status::text from public.obsidian_notebook_sessions where id='57000000-0000-4000-8000-000000000003'),
  'closed', 'an already-closed linked session stays closed'
);
select is(
  (public.read_obsidian_notebook_events('57000000-0000-4000-8000-000000000001',repeat('b',64),1)->>'status'),
  'closing', 'the plugin may poll a closing session'
);
select is(
  jsonb_array_length(public.read_obsidian_notebook_events(
    '57000000-0000-4000-8000-000000000001',repeat('b',64),1
  )->'events'), 1, 'the closing poll returns the unread final event'
);
select is(
  (public.get_obsidian_browser_session('57000000-0000-4000-8000-000000000001',repeat('c',64))->>'status'),
  'closing', 'the ChatGPT connection can display the closing state'
);
select throws_ok(
  $$select public.append_obsidian_public_event(
    '57000000-0000-4000-8000-000000000001',repeat('c',64),
    '67000000-0000-4000-8000-000000000001','quote','{}'::jsonb
  )$$, '55000', 'notebook session is closed', 'closing sessions reject new public events'
);

select lives_ok(
  $$select public.set_test_order_status('37000000-0000-4000-8000-000000000001','in_analysis','Returned for analysis')$$,
  'the completed order may move backward'
);
select is(
  (select status::text from public.test_orders where id='37000000-0000-4000-8000-000000000001'),
  'in_analysis', 'the backward order status is persisted'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='57000000-0000-4000-8000-000000000001'),
  2::bigint, 'closing sessions receive no later order events'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions where id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  ) and status='closing'), 2::bigint, 'backward movement does not reopen notebook sessions'
);

select is(
  (public.close_obsidian_notebook_session('57000000-0000-4000-8000-000000000001',repeat('b',64))->>'status'),
  'closed', 'the plugin acknowledges and closes a closing session'
);
select is(
  (public.close_obsidian_notebook_session('57000000-0000-4000-8000-000000000001',repeat('b',64))->>'status'),
  'closed', 'closing acknowledgement is idempotent'
);
select throws_ok(
  $$select public.read_obsidian_notebook_events(
    '57000000-0000-4000-8000-000000000001',repeat('b',64),2
  )$$, '55000', 'notebook session is closed', 'closed sessions reject further polling'
);
select is(
  (public.close_obsidian_notebook_session('57000000-0000-4000-8000-000000000002',repeat('e',64))->>'status'),
  'closed', 'every linked plugin can acknowledge its own session'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions where id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  ) and status='closed'), 2::bigint, 'all linked active sessions finish closed'
);
select is(
  (select count(*) from public.obsidian_notebook_sessions where id in (
    '57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002'
  ) and closed_at is not null), 2::bigint, 'closed sessions record closure timestamps'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='57000000-0000-4000-8000-000000000002'),
  2::bigint, 'the second linked session retained its final event before closure'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='57000000-0000-4000-8000-000000000003'),
  0::bigint, 'the previously closed linked session received no events'
);
select is(
  (select count(*) from public.obsidian_notebook_events where session_id='57000000-0000-4000-8000-000000000004'),
  0::bigint, 'the unrelated session received no events'
);

select * from finish();
rollback;
