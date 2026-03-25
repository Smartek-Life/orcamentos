-- WiFi Planner / Orcamentos Codex
-- Schema inicial para uso no Supabase
-- Aplicar no SQL Editor do projeto Supabase

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'seller' check (role in ('seller', 'manager', 'admin')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_key text not null,
  file_name text not null,
  file_hash text,
  title text,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_user_project_key_unique unique (user_id, project_key)
);

create table if not exists public.price_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_name text not null,
  category text not null,
  unit text not null,
  cost numeric(12, 2) not null default 0,
  markup numeric(12, 4) not null default 0,
  sale_price numeric(12, 2) generated always as (round((cost * markup)::numeric, 2)) stored,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text,
  product_name text not null,
  quantity numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null default 0,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute procedure public.set_updated_at();

drop trigger if exists set_price_catalog_updated_at on public.price_catalog;
create trigger set_price_catalog_updated_at
before update on public.price_catalog
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.price_catalog enable row level security;
alter table public.project_items enable row level security;
alter table public.reports enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects
for select
using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects
for delete
using (auth.uid() = user_id);

drop policy if exists "price_catalog_select_authenticated" on public.price_catalog;
create policy "price_catalog_select_authenticated"
on public.price_catalog
for select
using (auth.role() = 'authenticated');

drop policy if exists "price_catalog_manage_admin" on public.price_catalog;
create policy "price_catalog_manage_admin"
on public.price_catalog
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('manager', 'admin')
  )
);

drop policy if exists "project_items_select_own" on public.project_items;
create policy "project_items_select_own"
on public.project_items
for select
using (auth.uid() = user_id);

drop policy if exists "project_items_insert_own" on public.project_items;
create policy "project_items_insert_own"
on public.project_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "project_items_update_own" on public.project_items;
create policy "project_items_update_own"
on public.project_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_items_delete_own" on public.project_items;
create policy "project_items_delete_own"
on public.project_items
for delete
using (auth.uid() = user_id);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
on public.reports
for select
using (auth.uid() = user_id);

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
on public.reports
for insert
with check (auth.uid() = user_id);

drop policy if exists "reports_update_own" on public.reports;
create policy "reports_update_own"
on public.reports
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
on public.reports
for delete
using (auth.uid() = user_id);
