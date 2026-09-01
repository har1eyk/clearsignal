begin;
select plan(8);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','12000000-0000-4000-8000-000000000001','authenticated','authenticated','dashboard-one@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','12000000-0000-4000-8000-000000000002','authenticated','authenticated','dashboard-two@example.test','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','12000000-0000-4000-8000-000000000003','authenticated','authenticated','dashboard-pending@example.test','',now(),'{}','{}',now(),now(),'','','','');

insert into public.laboratories(id, name, created_by)
values ('22000000-0000-4000-8000-000000000001','Dashboard Lab','12000000-0000-4000-8000-000000000001');

insert into public.lab_memberships(lab_id,user_id,role,status,created_by) values
  ('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','viewer','active','12000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002','reviewer','active','12000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000003','analyst','inactive','12000000-0000-4000-8000-000000000001');

insert into public.test_orders(id,lab_id,order_number,created_by) values
  ('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','TR-DASH-001','12000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','TR-DASH-002','12000000-0000-4000-8000-000000000002'),
  ('32000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','TR-DASH-003','12000000-0000-4000-8000-000000000002');

insert into public.samples(id,lab_id,test_order_id,external_id,matrix,status,created_by) values
  ('72000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-REGISTERED','water','registered','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-RECEIVED','water','received','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-STORAGE','water','in_storage','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000004','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-TESTING','water','in_testing','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000005','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-CONSUMED','water','consumed','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000006','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','DASH-DISPOSED','water','disposed','12000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000007','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000002','DASH-OTHER','water','received','12000000-0000-4000-8000-000000000002');

insert into public.method_versions(
  id,lab_id,method_code,name,version,status,curve_model,standard_min_eu_ml,
  standard_max_eu_ml,r2_min,replicate_cv_max_pct,ppc_recovery_min_pct,
  ppc_recovery_max_pct,blank_max_rfu,effective_at,created_by
) values (
  '42000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',
  'DASH-ENDPOINT','Endpoint rFC','1','active','log10-linear',0.1,10,0.99,25,50,200,20,now(),
  '12000000-0000-4000-8000-000000000001'
);
insert into public.instruments(id,lab_id,instrument_code,name,status,created_by)
values ('52000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','DASH-READER','Reader','active','12000000-0000-4000-8000-000000000001');
insert into public.material_lots(id,lab_id,material_type,name,lot_number,status,expires_at,created_by) values
  ('62000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','rfc_reagent','rFC','DASH-RFC','active',now()+interval '1 year','12000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','control_standard_endotoxin','CSE','DASH-CSE','active',now()+interval '1 year','12000000-0000-4000-8000-000000000001');

insert into public.assay_runs(id,lab_id,run_number,method_version_id,instrument_id,reagent_lot_id,standard_lot_id,plate_format,status,created_by) values
  ('82000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','DASH-RUN-OWN','42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002',96,'approved','12000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','DASH-RUN-OTHER','42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002',96,'approved','12000000-0000-4000-8000-000000000002'),
  ('82000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','DASH-RUN-MIXED','42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002',96,'approved','12000000-0000-4000-8000-000000000002');

insert into public.run_samples(lab_id,run_id,sample_id,planned_dilution,created_by) values
  ('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',1,'12000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002',1,'12000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000007',1,'12000000-0000-4000-8000-000000000002'),
  ('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000003',1,'12000000-0000-4000-8000-000000000002'),
  ('22000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000007',1,'12000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select is((public.get_user_dashboard_summary()->>'testingRequests')::int, 1, 'request count is isolated to the current user');
select is((public.get_user_dashboard_summary()->>'samplesInProgress')::int, 4, 'only active sample statuses are counted');
select is((public.get_user_dashboard_summary()->>'approvedResults')::int, 2, 'approved runs are distinct and include mixed-owner runs');

select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select is((public.get_user_dashboard_summary()->>'testingRequests')::int, 2, 'another member sees only their requests');
select is((public.get_user_dashboard_summary()->>'samplesInProgress')::int, 1, 'another member sees only their samples');
select is((public.get_user_dashboard_summary()->>'approvedResults')::int, 2, 'another member sees approved runs containing their sample');

select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.get_user_dashboard_summary()$$, '42501', 'active laboratory membership required', 'inactive members are rejected');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_user_dashboard_summary()$$, '42501', 'authentication required', 'unauthenticated callers are rejected');

reset role;
select * from finish();
rollback;
