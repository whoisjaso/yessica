-- Title Desk: her dealers and the sales on her list.
-- Add-only. Nothing here drops, rewrites or bulk-updates a row.
-- Every row belongs to the signed-in agent (owner_id = auth.uid()), and
-- row-level security keeps each agent to her own rows.

create table if not exists public.title_dealers (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id),
  gdn text not null,
  name text not null,
  last_used_at timestamptz not null default now(),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists title_dealers_owner_idx on public.title_dealers (owner_id, last_used_at desc);

create table if not exists public.title_sales (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id),
  dealer_id uuid not null references public.title_dealers (id),
  sale_date date not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'filed')),
  buyer_name text,
  car text,
  filed_number text,
  filed_by text,
  filed_at timestamptz,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists title_sales_owner_idx on public.title_sales (owner_id, status, due_on);

alter table public.title_dealers enable row level security;
alter table public.title_sales enable row level security;

drop policy if exists "agent reads own dealers" on public.title_dealers;
create policy "agent reads own dealers" on public.title_dealers
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "agent adds own dealers" on public.title_dealers;
create policy "agent adds own dealers" on public.title_dealers
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "agent updates own dealers" on public.title_dealers;
create policy "agent updates own dealers" on public.title_dealers
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "agent reads own sales" on public.title_sales;
create policy "agent reads own sales" on public.title_sales
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "agent adds own sales" on public.title_sales;
create policy "agent adds own sales" on public.title_sales
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (select 1 from public.title_dealers d where d.id = dealer_id and d.owner_id = auth.uid())
  );
drop policy if exists "agent updates own sales" on public.title_sales;
create policy "agent updates own sales" on public.title_sales
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.title_sales_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists title_sales_touch on public.title_sales;
create trigger title_sales_touch before update on public.title_sales
  for each row execute function public.title_sales_touch();
