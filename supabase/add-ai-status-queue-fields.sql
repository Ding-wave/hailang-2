-- Queue-state fields for asynchronous AI processing
alter table public.articles
  add column if not exists ai_status text not null default 'pending';

alter table public.articles
  add column if not exists ai_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'articles_ai_status_check'
  ) then
    alter table public.articles
      add constraint articles_ai_status_check
      check (ai_status in ('pending', 'processing', 'completed', 'failed'));
  end if;
end $$;

-- Backfill status for existing records
update public.articles
set ai_status = case
  when coalesce(deep_analysis_zh, '') <> '' then 'completed'
  else 'pending'
end
where ai_status is null
   or ai_status not in ('pending', 'processing', 'completed', 'failed');

create index if not exists idx_articles_ai_status_created_at
  on public.articles (ai_status, created_at asc);

create index if not exists idx_articles_pending_unanalyzed
  on public.articles (created_at asc)
  where ai_status = 'pending' and deep_analysis_zh is null;
