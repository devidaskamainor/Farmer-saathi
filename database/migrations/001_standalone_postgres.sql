create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_lower_unique
  on app_users (lower(email));

create table if not exists farmers (
  id uuid primary key references app_users (id) on delete cascade,
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

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users (id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_expires_idx
  on auth_sessions (user_id, expires_at);

create table if not exists farming_history (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers (id) on delete cascade,
  crop text not null,
  planting_date date,
  harvest_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists farming_history_farmer_created_idx
  on farming_history (farmer_id, created_at desc);

create table if not exists saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers (id) on delete cascade,
  recommendation_type text not null
    check (recommendation_type in ('crop', 'irrigation', 'disease', 'assistant')),
  details jsonb not null,
  related_crop text not null default '',
  sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists saved_recommendations_farmer_created_idx
  on saved_recommendations (farmer_id, created_at desc);
