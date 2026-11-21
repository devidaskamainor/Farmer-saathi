-- Farmer Saathi Supabase schema
-- Run in the Supabase SQL Editor for the project's database.
-- Every table is protected by RLS and grants are limited to authenticated users.

create table if not exists public.farmers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  state text not null default '',
  district text not null default '',
  village text not null default '',
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'hi', 'kn')),
  farm_size numeric(12, 2) check (farm_size is null or farm_size >= 0),
  soil jsonb not null default '{}'::jsonb check (jsonb_typeof(soil) = 'object'),
  irrigation_facilities text[] not null default '{}',
  current_crops text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farming_history (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  crop text not null,
  planting_date date,
  harvest_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  recommendation_type text not null
    check (recommendation_type in ('crop', 'irrigation', 'disease', 'assistant')),
  details jsonb not null,
  related_crop text not null default '',
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists farming_history_farmer_created_idx
  on public.farming_history (farmer_id, created_at desc);
create index if not exists saved_recommendations_farmer_created_idx
  on public.saved_recommendations (farmer_id, created_at desc);

alter table public.farmers enable row level security;
alter table public.farming_history enable row level security;
alter table public.saved_recommendations enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.farmers to authenticated;
grant select, insert, update, delete on public.farming_history to authenticated;
grant select, insert, update, delete on public.saved_recommendations to authenticated;

drop policy if exists "Farmers can read their own profile" on public.farmers;
create policy "Farmers can read their own profile"
  on public.farmers for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Farmers can create their own profile" on public.farmers;
create policy "Farmers can create their own profile"
  on public.farmers for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Farmers can update their own profile" on public.farmers;
create policy "Farmers can update their own profile"
  on public.farmers for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Farmers can manage their own farming history" on public.farming_history;
create policy "Farmers can manage their own farming history"
  on public.farming_history for all to authenticated
  using ((select auth.uid()) = farmer_id)
  with check ((select auth.uid()) = farmer_id);

drop policy if exists "Farmers can manage their own recommendations" on public.saved_recommendations;
create policy "Farmers can manage their own recommendations"
  on public.saved_recommendations for all to authenticated
  using ((select auth.uid()) = farmer_id)
  with check ((select auth.uid()) = farmer_id);
