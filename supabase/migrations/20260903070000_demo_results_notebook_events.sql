create or replace function public.append_obsidian_order_status_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_sample record;
  v_sequence bigint;
  v_sample_index integer := 0;
  v_result numeric;
  v_sample_results jsonb := '[]'::jsonb;
  v_results_payload jsonb;
  v_results_operation_id uuid := gen_random_uuid();
  v_reason text := nullif(current_setting('app.change_reason', true), '');
begin
  if old.status is not distinct from new.status then return new; end if;

  if new.status = 'complete' then
    for v_sample in
      select s.external_id
      from public.samples s
      where s.test_order_id = new.id
      order by s.created_at, s.id
    loop
      v_sample_index := v_sample_index + 1;
      v_result := round((
        0.01 + random() * case when v_sample_index = 1 then 0.04 else 0.24 end
      )::numeric, 3);
      v_sample_results := v_sample_results || jsonb_build_array(jsonb_build_object(
        'sample_id', v_sample.external_id,
        'endotoxin_eu_ml', v_result,
        'qualitative_result', case when v_result <= 0.05 then 'negative' else 'positive' end
      ));
    end loop;

    v_results_payload := jsonb_build_object(
      'order_id', new.id,
      'order_number', new.order_number,
      'simulated', true,
      'units', 'EU/mL',
      'negative_cutoff_eu_ml', 0.05,
      'sample_results', v_sample_results,
      'standard_curve', jsonb_build_object(
        'x_axis', 'LogConc',
        'y_axis', 'LogAvgRFU',
        'points', jsonb_build_array(
          jsonb_build_object('log_conc', 0.698970004, 'log_avg_rfu', 5.494701294),
          jsonb_build_object('log_conc', -0.301029996, 'log_avg_rfu', 4.581733538),
          jsonb_build_object('log_conc', -1.301029996, 'log_avg_rfu', 3.573161809),
          jsonb_build_object('log_conc', -2.301029996, 'log_avg_rfu', 2.457124626)
        )
      ),
      'reported_at', new.status_updated_at
    );
  end if;

  for v_session in
    select s.id
    from public.obsidian_notebook_order_links l
    join public.obsidian_notebook_sessions s on s.id = l.session_id
    where l.test_order_id = new.id and s.status = 'open'
    order by s.id
    for update of s
  loop
    select coalesce(max(sequence_number), 0) + 1 into v_sequence
    from public.obsidian_notebook_events
    where session_id = v_session.id;

    insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload)
    values (v_session.id, v_sequence, 'order_status', gen_random_uuid(), jsonb_build_object(
      'order_id', new.id,
      'order_number', new.order_number,
      'previous_status', old.status,
      'status', new.status,
      'reason', v_reason,
      'changed_at', new.status_updated_at
    ));

    if new.status = 'complete' then
      insert into public.obsidian_notebook_events(session_id, sequence_number, kind, operation_id, payload)
      values (v_session.id, v_sequence + 1, 'results', v_results_operation_id, v_results_payload);

      update public.obsidian_notebook_sessions
      set status = 'closing'
      where id = v_session.id;
    end if;
  end loop;
  return new;
end;
$$;
