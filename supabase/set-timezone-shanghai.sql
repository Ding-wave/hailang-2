-- Display timestamptz in Asia/Shanghai for SQL clients & Supabase SQL editor
alter database postgres set timezone to 'Asia/Shanghai';

-- Helper: current time as timestamptz in CST (+08:00)
create or replace function public.now_cst()
returns timestamptz
language sql
stable
as $$
  select (now() at time zone 'Asia/Shanghai')::timestamptz;
$$;
