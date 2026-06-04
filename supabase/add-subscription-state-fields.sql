-- Add subscription lifecycle fields used by payment webhook/cancel flow.
alter table public.profiles
  add column if not exists is_subscribed boolean not null default false,
  add column if not exists subscription_start timestamptz,
  add column if not exists subscription_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

-- Backfill from legacy fields when present.
update public.profiles
set
  is_subscribed = coalesce(is_subscribed, false) or subscription_status = 'active',
  subscription_end = coalesce(subscription_end, subscription_end_at),
  subscription_start = coalesce(subscription_start, created_at)
where true;
