begin;
select plan(17);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000001','authenticated','authenticated','admin@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000002','authenticated','authenticated','analyst@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000003','authenticated','authenticated','reviewer@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000004','authenticated','authenticated','viewer@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000005','authenticated','authenticated','outsider@example.test','',now(),'{}','{}',now(),now(),'','','','');

insert into public.laboratories(id, name, created_by)
values ('20000000-0000-4000-8000-000000000001', 'Test Lab', '10000000-0000-4000-8000-000000000001');
insert into public.lab_memberships(lab_id, user_id, role, created_by) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','admin','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','analyst','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','reviewer','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','viewer','10000000-0000-4000-8000-000000000001');
insert into public.samples(
  id, lab_id, external_id, matrix, endotoxin_limit_eu_ml,
  maximum_valid_dilution, created_by
) values (
  '30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  'VISIBLE-SAMPLE','biologic',2,4,'10000000-0000-4000-8000-000000000001'
);

select ok(has_table_privilege('authenticated', 'public.samples', 'select'), 'authenticated users receive SELECT before RLS filtering');
select ok(not has_table_privilege('authenticated', 'public.samples', 'insert'), 'authenticated users cannot bypass RPCs with INSERT');
select ok(not has_table_privilege('anon', 'public.samples', 'select'), 'anonymous users have no sample access');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select results_eq('select count(*) from public.samples', array[1::bigint], 'admin reads laboratory samples');
select lives_ok(
  $$select public.create_testing_request_draft('{"lab_id":"20000000-0000-4000-8000-000000000001","project_name":"Admin request","purpose":"Role verification","samples":[{"external_id":"ADMIN-REQUESTED","kind":"original","matrix":"biologic"}]}'::jsonb)$$,
  'admin can create an unpriced testing request draft'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select results_eq('select count(*) from public.samples', array[1::bigint], 'analyst reads laboratory samples');
select lives_ok(
  $$select public.create_sample('{"lab_id":"20000000-0000-4000-8000-000000000001","external_id":"ANALYST-CREATED","kind":"original","matrix":"biologic","endotoxin_limit_eu_ml":2,"maximum_valid_dilution":4}'::jsonb,'analyst-create-0001')$$,
  'analyst creates a sample only through the controlled RPC'
);
select lives_ok(
  $$select public.create_testing_request_draft('{"lab_id":"20000000-0000-4000-8000-000000000001","project_name":"Analyst request","purpose":"Role verification","samples":[{"external_id":"ANALYST-REQUESTED","kind":"original","matrix":"biologic"}]}'::jsonb)$$,
  'analyst can create an unpriced testing request draft'
);
select results_eq(
  $$select count(*) > 0 from public.audit_events where entity_type = 'samples' and actor_id = '10000000-0000-4000-8000-000000000002'$$,
  array[true],
  'analyst mutation is attributable in the audit trail'
);
select throws_ok(
  $$delete from public.samples where external_id = 'ANALYST-CREATED'$$,
  '42501', 'permission denied for table samples', 'analyst cannot hard-delete samples'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select results_eq('select count(*) from public.samples', array[2::bigint], 'reviewer reads laboratory samples');
select lives_ok(
  $$select public.create_testing_request_draft('{"lab_id":"20000000-0000-4000-8000-000000000001","project_name":"Reviewer request","purpose":"Role verification","samples":[{"external_id":"REVIEWER-REQUESTED","kind":"original","matrix":"biologic"}]}'::jsonb)$$,
  'reviewer can create an unpriced testing request draft'
);
select throws_ok(
  $$select public.create_sample('{"lab_id":"20000000-0000-4000-8000-000000000001","external_id":"REVIEWER-CREATED","kind":"original","matrix":"biologic","endotoxin_limit_eu_ml":2,"maximum_valid_dilution":4}'::jsonb,'reviewer-create-0001')$$,
  '42501', 'not authorized for laboratory', 'reviewer cannot create samples'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select results_eq('select count(*) from public.samples', array[2::bigint], 'viewer reads laboratory samples');
select lives_ok(
  $$select public.create_testing_request_draft('{"lab_id":"20000000-0000-4000-8000-000000000001","project_name":"Viewer request","purpose":"Role verification","samples":[{"external_id":"VIEWER-REQUESTED","kind":"original","matrix":"biologic"}]}'::jsonb)$$,
  'viewer can create an unpriced testing request draft'
);
select throws_ok(
  $$select public.create_sample('{"lab_id":"20000000-0000-4000-8000-000000000001","external_id":"VIEWER-CREATED","kind":"original","matrix":"biologic","endotoxin_limit_eu_ml":2,"maximum_valid_dilution":4}'::jsonb,'viewer-create-0001')$$,
  '42501', 'not authorized for laboratory', 'viewer cannot create samples'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select results_eq('select count(*) from public.samples', array[0::bigint], 'non-member cannot read laboratory samples');
reset role;

select * from finish();
rollback;
