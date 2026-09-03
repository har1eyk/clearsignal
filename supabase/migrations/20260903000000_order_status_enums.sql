create type public.test_order_status as enum (
  'pending_laboratory_review',
  'preparing_samples',
  'in_testing',
  'in_analysis',
  'in_review',
  'complete'
);

alter type public.obsidian_event_kind add value if not exists 'order_status';

alter table public.test_orders
  add column status public.test_order_status not null default 'pending_laboratory_review',
  add column status_updated_at timestamptz not null default now();
