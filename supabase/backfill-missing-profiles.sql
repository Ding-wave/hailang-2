-- Backfill missing rows in public.profiles from auth.users
-- Safe to run multiple times.

insert into public.profiles (id, email, subscription_status)
select
  u.id,
  u.email,
  'free'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do update
set email = excluded.email;
