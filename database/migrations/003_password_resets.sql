create table if not exists auth_password_resets (
  user_id uuid primary key references app_users (id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_password_resets_expires_idx
  on auth_password_resets (expires_at);
