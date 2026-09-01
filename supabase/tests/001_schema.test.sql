begin;
select plan(31);

select has_table('public', 'laboratories', 'laboratories exists');
select has_table('public', 'lab_memberships', 'lab memberships exist');
select has_table('public', 'samples', 'samples exist');
select has_table('public', 'test_orders', 'testing requests exist');
select has_table('public', 'sample_events', 'sample custody events exist');
select has_table('public', 'method_versions', 'method versions exist');
select has_table('public', 'assay_runs', 'assay runs exist');
select has_table('public', 'plate_wells', 'plate wells exist');
select has_table('public', 'endpoint_readings', 'endpoint readings exist');
select has_table('public', 'calculation_revisions', 'calculation revisions exist');
select has_table('public', 'sample_results', 'sample results exist');
select has_table('public', 'review_actions', 'review actions exist');
select has_table('public', 'audit_events', 'audit trail exists');

select has_function('public', 'create_sample', array['jsonb','text'], 'sample mutation RPC exists');
select has_function('public', 'create_testing_request', array['jsonb','text'], 'testing-request mutation RPC exists');
select has_function('public', 'get_user_dashboard_summary', array[]::text[], 'dashboard summary RPC exists');
select has_function('public', 'set_sample_specification', array['uuid','numeric','numeric','text'], 'sample specification RPC exists');
select has_function('public', 'complete_sample_review', array['uuid','numeric','numeric','text','text'], 'matrix and specification review RPC exists');
select has_function('public', 'create_assay_run', array['jsonb','text'], 'run mutation RPC exists');
select has_function('public', 'upsert_endpoint_readings', array['uuid','jsonb','uuid','text'], 'reading RPC exists');
select has_function('public', 'calculate_assay_run', array['uuid','text'], 'authoritative calculation RPC exists');
select has_function('public', 'review_assay_run', array['uuid','review_decision','text','text','text'], 'review RPC exists');
select has_function('public', 'build_run_report', array['uuid'], 'report RPC exists');

select has_column('public', 'test_orders', 'unit_price_cents', 'orders retain the confirmed unit price');
select has_column('public', 'test_orders', 'total_price_cents', 'orders retain the confirmed total');
select has_column('public', 'test_orders', 'quote_confirmed_at', 'orders retain the price confirmation time');
select ok(
  (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'samples' and column_name = 'matrix'),
  'sample matrix may remain pending at intake'
);

select policies_are('public', 'samples', array['read_lab_samples'], 'samples use an explicit RLS policy');
select policies_are('public', 'assay_runs', array['read_lab_assay_runs'], 'runs use an explicit RLS policy');
select policies_are('public', 'audit_events', array['read_lab_audit_events'], 'audit events use an explicit RLS policy');
select is((select public from storage.buckets where id = 'assay-raw-data'), false, 'raw-data bucket is private');

select * from finish();
rollback;
