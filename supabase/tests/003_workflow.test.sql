begin;
select plan(10);

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000','11000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','workflow@example.test','',now(),
  '{}','{}',now(),now(),'','','',''
);
insert into public.laboratories(id, name, created_by)
values ('21000000-0000-4000-8000-000000000001','Workflow Lab','11000000-0000-4000-8000-000000000001');
insert into public.lab_memberships(lab_id,user_id,role,created_by)
values ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','analyst','11000000-0000-4000-8000-000000000001');
insert into public.method_versions(
  id,lab_id,method_code,name,version,status,curve_model,standard_min_eu_ml,
  standard_max_eu_ml,r2_min,replicate_cv_max_pct,ppc_recovery_min_pct,
  ppc_recovery_max_pct,blank_max_rfu,effective_at,created_by
) values (
  '41000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',
  'RFC-ENDPOINT','Endpoint rFC','1','active','log10-linear',0.1,10,0.99,25,50,200,20,now(),
  '11000000-0000-4000-8000-000000000001'
);
insert into public.instruments(id,lab_id,instrument_code,name,status,created_by)
values ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','READER-1','Reader','active','11000000-0000-4000-8000-000000000001');
insert into public.instrument_events(lab_id,instrument_id,event_type,performed_at,due_at,outcome,created_by)
values ('21000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','calibration',now(),now()+interval '1 year','acceptable','11000000-0000-4000-8000-000000000001');
insert into public.material_lots(id,lab_id,material_type,name,lot_number,status,expires_at,created_by) values
  ('61000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','rfc_reagent','rFC reagent','RFC-LOT','active',now()+interval '1 year','11000000-0000-4000-8000-000000000001'),
  ('61000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','control_standard_endotoxin','CSE','CSE-LOT','active',now()+interval '1 year','11000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select lives_ok(
  $$select public.create_sample('{"lab_id":"21000000-0000-4000-8000-000000000001","external_id":"RFC-SAMPLE-1","kind":"original","matrix":"biologic","endotoxin_limit_eu_ml":2,"maximum_valid_dilution":4}'::jsonb,'workflow-sample-0001')$$,
  'sample is registered'
);
select lives_ok(
  $$select public.create_assay_run(jsonb_build_object(
    'lab_id','21000000-0000-4000-8000-000000000001','run_number','RFC-RUN-1',
    'method_version_id','41000000-0000-4000-8000-000000000001',
    'instrument_id','51000000-0000-4000-8000-000000000001',
    'reagent_lot_id','61000000-0000-4000-8000-000000000001',
    'standard_lot_id','61000000-0000-4000-8000-000000000002','plate_format',96,
    'samples',jsonb_build_array(jsonb_build_object('sample_id',(select id from public.samples where external_id='RFC-SAMPLE-1'),'planned_dilution',2))
  ),'workflow-run-0001')$$,
  'assay run is created from current controlled resources'
);
select lives_ok(
  $$select public.register_raw_artifact(
    (select id from public.assay_runs where run_number='RFC-RUN-1'),
    '{"storage_path":"21000000-0000-4000-8000-000000000001/run/raw.csv","storage_version":"1","original_filename":"raw.csv","mime_type":"text/csv","byte_size":500,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb,
    'workflow-import-0001'
  )$$,
  'immutable raw artifact metadata is registered'
);
select lives_ok(
  $$select public.upsert_endpoint_readings(
    (select id from public.assay_runs where run_number='RFC-RUN-1'),
    jsonb_build_array(
      jsonb_build_object('well','A1','role','blank','sample_id',null,'replicate',1,'dilution_factor',1,'standard_eu_ml',null,'spike_eu_ml',null,'fluorescence_rfu',10),
      jsonb_build_object('well','A2','role','blank','sample_id',null,'replicate',2,'dilution_factor',1,'standard_eu_ml',null,'spike_eu_ml',null,'fluorescence_rfu',10),
      jsonb_build_object('well','B1','role','standard','sample_id',null,'replicate',1,'dilution_factor',1,'standard_eu_ml',0.1,'spike_eu_ml',null,'fluorescence_rfu',110),
      jsonb_build_object('well','B2','role','standard','sample_id',null,'replicate',2,'dilution_factor',1,'standard_eu_ml',0.1,'spike_eu_ml',null,'fluorescence_rfu',110),
      jsonb_build_object('well','C1','role','standard','sample_id',null,'replicate',1,'dilution_factor',1,'standard_eu_ml',1,'spike_eu_ml',null,'fluorescence_rfu',1010),
      jsonb_build_object('well','C2','role','standard','sample_id',null,'replicate',2,'dilution_factor',1,'standard_eu_ml',1,'spike_eu_ml',null,'fluorescence_rfu',1010),
      jsonb_build_object('well','D1','role','standard','sample_id',null,'replicate',1,'dilution_factor',1,'standard_eu_ml',10,'spike_eu_ml',null,'fluorescence_rfu',10010),
      jsonb_build_object('well','D2','role','standard','sample_id',null,'replicate',2,'dilution_factor',1,'standard_eu_ml',10,'spike_eu_ml',null,'fluorescence_rfu',10010),
      jsonb_build_object('well','E1','role','sample','sample_id',(select id from public.samples where external_id='RFC-SAMPLE-1'),'replicate',1,'dilution_factor',2,'standard_eu_ml',null,'spike_eu_ml',null,'fluorescence_rfu',510),
      jsonb_build_object('well','E2','role','sample','sample_id',(select id from public.samples where external_id='RFC-SAMPLE-1'),'replicate',2,'dilution_factor',2,'standard_eu_ml',null,'spike_eu_ml',null,'fluorescence_rfu',510),
      jsonb_build_object('well','F1','role','ppc','sample_id',(select id from public.samples where external_id='RFC-SAMPLE-1'),'replicate',1,'dilution_factor',2,'standard_eu_ml',null,'spike_eu_ml',1,'fluorescence_rfu',1510),
      jsonb_build_object('well','F2','role','ppc','sample_id',(select id from public.samples where external_id='RFC-SAMPLE-1'),'replicate',2,'dilution_factor',2,'standard_eu_ml',null,'spike_eu_ml',1,'fluorescence_rfu',1510)
    ),
    (select id from public.raw_artifacts where run_id=(select id from public.assay_runs where run_number='RFC-RUN-1')),
    'workflow import'
  )$$,
  'endpoint wells are recorded'
);
select lives_ok(
  $$select public.calculate_assay_run((select id from public.assay_runs where run_number='RFC-RUN-1'),'workflow-calc-0001')$$,
  'database calculates the assay from stored raw readings'
);
select results_eq(
  $$select is_valid from public.calculation_revisions where run_id=(select id from public.assay_runs where run_number='RFC-RUN-1')$$,
  array[true], 'calculation passes configured validity criteria'
);
select lives_ok(
  $$select public.submit_assay_run((select id from public.assay_runs where run_number='RFC-RUN-1'),'ready for review')$$,
  'calculated run is submitted'
);
select lives_ok(
  $$select public.review_assay_run((select id from public.assay_runs where run_number='RFC-RUN-1'),'approve','Scientific review and approval','Self-review permitted for prototype','workflow-review-0001')$$,
  'creating analyst can perform the configured self-review'
);
select results_eq(
  $$select status = 'approved' and report_snapshot is not null from public.assay_runs where run_number='RFC-RUN-1'$$,
  array[true], 'approval locks an immutable report snapshot'
);
select results_eq(
  $$select count(*) > 10 from public.audit_events where lab_id='21000000-0000-4000-8000-000000000001'$$,
  array[true], 'workflow is reconstructable from attributable audit events'
);

reset role;
select * from finish();
rollback;
