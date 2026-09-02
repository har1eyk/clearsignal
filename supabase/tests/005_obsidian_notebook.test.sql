begin;
select plan(23);

select has_table('public', 'obsidian_notebook_sessions', 'notebook sessions exist');
select has_table('public', 'obsidian_notebook_events', 'immutable notebook events exist');
select has_type('public', 'obsidian_event_kind', 'notebook event kind exists');
select has_function('public', 'create_obsidian_notebook_session', array['uuid','text','text','text'], 'session creation RPC exists');
select has_function('public', 'read_obsidian_notebook_events', array['uuid','text','bigint'], 'incremental read RPC exists');
select has_function('public', 'append_obsidian_public_event', array['uuid','text','uuid','obsidian_event_kind','jsonb'], 'public event RPC exists');
select has_function('public', 'append_obsidian_order_event', array['uuid','text','uuid','uuid'], 'canonical order event RPC exists');
select has_function('public', 'close_obsidian_notebook_session', array['uuid','text'], 'session close RPC exists');
select ok(not has_table_privilege('anon', 'public.obsidian_notebook_sessions', 'select'), 'anonymous clients cannot read session rows');
select ok(not has_table_privilege('authenticated', 'public.obsidian_notebook_events', 'insert'), 'authenticated clients cannot insert event rows directly');
select ok(not has_function_privilege('anon', 'public.append_obsidian_order_event(uuid,text,uuid,uuid)', 'execute'), 'notebook browser capabilities cannot record orders');
select ok(has_function_privilege('authenticated', 'public.append_obsidian_order_event(uuid,text,uuid,uuid)', 'execute'), 'authenticated order flow can record an order');

set local role anon;
select is(
  (public.create_obsidian_notebook_session(
    '50000000-0000-4000-8000-000000000001', repeat('a',64), repeat('b',64), repeat('c',64)
  )->>'status'), 'open', 'anonymous plugin creates an open paired session'
);
select is(
  (public.get_obsidian_browser_session('50000000-0000-4000-8000-000000000001', repeat('c',64))->>'request_sha256'),
  repeat('a',64), 'the browser capability reads only pairing metadata'
);
select lives_ok(
  $$select public.append_obsidian_public_event(
    '50000000-0000-4000-8000-000000000001', repeat('c',64),
    '51000000-0000-4000-8000-000000000001', 'quote', '{"total":750}'::jsonb
  )$$, 'browser capability appends a quote'
);
select is(
  (public.append_obsidian_public_event(
    '50000000-0000-4000-8000-000000000001', repeat('c',64),
    '51000000-0000-4000-8000-000000000001', 'quote', '{"total":750}'::jsonb
  )->>'sequence')::bigint, 1::bigint, 'an operation retry returns the original sequence'
);
select is(
  (public.append_obsidian_public_event(
    '50000000-0000-4000-8000-000000000001', repeat('c',64),
    '51000000-0000-4000-8000-000000000002', 'guidance', '{"status":"needs_human_review"}'::jsonb
  )->>'sequence')::bigint, 2::bigint, 'event sequence is monotonic'
);
select is(
  jsonb_array_length(public.read_obsidian_notebook_events(
    '50000000-0000-4000-8000-000000000001', repeat('b',64), 0
  )->'events'), 2, 'read capability polls both events'
);
select is(
  jsonb_array_length(public.read_obsidian_notebook_events(
    '50000000-0000-4000-8000-000000000001', repeat('b',64), 1
  )->'events'), 1, 'incremental polling filters by sequence'
);
select is(
  (public.close_obsidian_notebook_session(
    '50000000-0000-4000-8000-000000000001', repeat('b',64)
  )->>'status'), 'closed', 'read capability closes and revokes the session'
);
select throws_ok(
  $$select public.read_obsidian_notebook_events(
    '50000000-0000-4000-8000-000000000001', repeat('b',64), 0
  )$$, '55000', 'notebook session is closed', 'closed sessions cannot be read'
);
select throws_ok(
  $$select public.append_obsidian_public_event(
    '50000000-0000-4000-8000-000000000001', repeat('c',64),
    '51000000-0000-4000-8000-000000000003', 'quote', '{}'::jsonb
  )$$, '55000', 'notebook session is closed', 'closed sessions cannot be written'
);
reset role;

select is(
  (select status::text from public.obsidian_notebook_sessions where id = '50000000-0000-4000-8000-000000000001'),
  'closed', 'closed status is immutable notebook state'
);

select * from finish();
rollback;
