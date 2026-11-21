create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null check (type in ('feature', 'event', 'holiday', 'general')),
  action_url text not null default '/dashboard',
  icon text not null default 'sparkles',
  created_at timestamptz not null default now()
);

create table if not exists user_notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null unique,
  device_type text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fcm_tokens_user_id on fcm_tokens(user_id);
create index if not exists idx_notifications_type on notifications(type);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
