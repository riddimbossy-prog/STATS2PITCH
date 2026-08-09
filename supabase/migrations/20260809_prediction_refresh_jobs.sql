create table if not exists public.prediction_refresh_jobs (
  job_date date primary key,
  status text not null check (status in ('running','complete','failed','idle')),
  owner_id text,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  finished_at timestamptz,
  progress jsonb,
  error text
);

alter table public.prediction_refresh_jobs enable row level security;

create or replace function public.claim_prediction_refresh_job(
  p_job_date date,
  p_owner_id text,
  p_stale_after_seconds integer default 300
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
begin
  insert into public.prediction_refresh_jobs(job_date,status,owner_id,started_at,updated_at,heartbeat_at,finished_at,progress,error)
  values(p_job_date,'running',p_owner_id,now(),now(),now(),null,'{"phase":"queued","message":"Refresh queued."}'::jsonb,null)
  on conflict (job_date) do nothing;
  get diagnostics changed = row_count;
  if changed > 0 then return true; end if;

  update public.prediction_refresh_jobs
     set status='running',owner_id=p_owner_id,started_at=now(),updated_at=now(),heartbeat_at=now(),finished_at=null,progress='{"phase":"queued","message":"Refresh queued."}'::jsonb,error=null
   where job_date=p_job_date
     and (status <> 'running' or heartbeat_at < now() - make_interval(secs => greatest(30,p_stale_after_seconds)));
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.claim_prediction_refresh_job(date,text,integer) from public, anon, authenticated;
grant execute on function public.claim_prediction_refresh_job(date,text,integer) to service_role;
