create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null check (plan_id in ('monthly', 'yearly')),
  amount text,
  status text not null default 'pending',
  out_trade_no text not null unique,
  alipay_trade_no text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_out_trade_no_idx on public.orders (out_trade_no);

alter table public.orders enable row level security;

create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);
