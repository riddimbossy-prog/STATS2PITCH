create table if not exists public.prediction_snapshots (
  snapshot_date date primary key,
  generated_at timestamptz not null default now(),
  payload jsonb not null
);
