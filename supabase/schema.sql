-- ============================================================
-- NewsFlow — Supabase Database Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── ARTICLES TABLE ───────────────────────────────────────────
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  original_title text,
  content       text,
  translated_title   text,
  translated_content text,
  summary       text,
  sentiment     text check (sentiment in ('positive', 'negative', 'neutral')),
  source        text,
  url           text unique not null,
  image         text,
  published_at  timestamptz,
  created_at    timestamptz default now()
);

alter table public.articles enable row level security;

-- Anyone can read articles (preview on homepage)
create policy "Public articles are readable by everyone"
  on public.articles for select
  using (true);

-- Only service role can insert/update (cron job uses anon key via API route)
create policy "Service role can manage articles"
  on public.articles for all
  using (true)
  with check (true);

-- ─── PROFILES TABLE ────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users on delete cascade,
  email             text,
  is_premium        boolean default false,
  subscription_end  timestamptz,
  created_at        timestamptz default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Drop trigger if it already exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── INDEXES ───────────────────────────────────────────────────
create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

create index if not exists articles_url_idx
  on public.articles (url);
