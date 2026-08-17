-- LoveRabbit server-owned persistence.
-- The browser never talks to these tables directly; only the server-side
-- Supabase client using SUPABASE_SECRET_KEY may access them.

create table if not exists public.lr_users (
  id bigint generated always as identity primary key,
  email text not null unique,
  birthdate date not null,
  marketing_consent boolean not null default false,
  adult_verification_method text not null default 'self_attested'
    check (adult_verification_method in ('self_attested', 'pass')),
  adult_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lr_users_email_normalized check (email = lower(btrim(email)))
);

create table if not exists public.lr_readings (
  id uuid primary key,
  user_id bigint references public.lr_users(id) on delete set null,
  category text not null check (length(btrim(category)) > 0),
  teaser text not null,
  full_text text not null,
  chart jsonb not null default '{}'::jsonb,
  provider text not null,
  price integer not null check (price >= 0),
  score smallint check (score between 0 and 100),
  score_label text,
  unlocked boolean not null default false,
  payment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lr_readings_chart_object check (jsonb_typeof(chart) = 'object')
);

create table if not exists public.lr_orders (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users(id) on delete restrict,
  reading_id uuid references public.lr_readings(id) on delete set null,
  kind text not null check (kind in ('reading', 'membership')),
  method text not null check (method in ('transfer', 'toss-pg', 'membership', 'mock')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount integer not null check (amount >= 0),
  provider_order_id text unique,
  depositor_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint lr_orders_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.lr_memberships (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users(id) on delete restrict,
  order_id bigint unique references public.lr_orders(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lr_memberships_valid_period check (expires_at > starts_at)
);

create index if not exists lr_readings_user_id_idx
  on public.lr_readings (user_id);
create index if not exists lr_readings_created_at_idx
  on public.lr_readings (created_at desc);
create index if not exists lr_readings_unlocked_idx
  on public.lr_readings (unlocked, created_at desc);

create index if not exists lr_orders_user_id_idx
  on public.lr_orders (user_id);
create index if not exists lr_orders_reading_id_idx
  on public.lr_orders (reading_id);
create index if not exists lr_orders_status_created_at_idx
  on public.lr_orders (status, created_at desc);
create unique index if not exists lr_orders_paid_reading_key
  on public.lr_orders (reading_id)
  where reading_id is not null and kind = 'reading' and status = 'paid';

create index if not exists lr_memberships_user_id_idx
  on public.lr_memberships (user_id);
create index if not exists lr_memberships_active_lookup_idx
  on public.lr_memberships (user_id, expires_at desc)
  where status = 'active';

alter table public.lr_users enable row level security;
alter table public.lr_readings enable row level security;
alter table public.lr_orders enable row level security;
alter table public.lr_memberships enable row level security;

alter table public.lr_users force row level security;
alter table public.lr_readings force row level security;
alter table public.lr_orders force row level security;
alter table public.lr_memberships force row level security;

revoke all on table public.lr_users from anon, authenticated;
revoke all on table public.lr_readings from anon, authenticated;
revoke all on table public.lr_orders from anon, authenticated;
revoke all on table public.lr_memberships from anon, authenticated;
revoke all on sequence public.lr_users_id_seq from anon, authenticated;
revoke all on sequence public.lr_orders_id_seq from anon, authenticated;
revoke all on sequence public.lr_memberships_id_seq from anon, authenticated;

grant select, insert, update on table public.lr_users to service_role;
grant select, insert, update on table public.lr_readings to service_role;
grant select, insert, update on table public.lr_orders to service_role;
grant select, insert, update on table public.lr_memberships to service_role;
grant usage, select on sequence public.lr_users_id_seq to service_role;
grant usage, select on sequence public.lr_orders_id_seq to service_role;
grant usage, select on sequence public.lr_memberships_id_seq to service_role;

comment on table public.lr_users is 'LoveRabbit signed-email users; PASS verification will replace self-attestation.';
comment on table public.lr_readings is 'Server-owned generated readings and unlock state.';
comment on table public.lr_orders is 'Reading and membership payment ledger.';
comment on table public.lr_memberships is 'Membership validity periods linked to orders.';
