-- Viral referral rewards. All access stays server-side through the secret key.

alter table public.lr_users
  add column if not exists referral_code text,
  add column if not exists chat_credits integer not null default 0
    check (chat_credits >= 0);

update public.lr_users
set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where referral_code is null;

alter table public.lr_users
  alter column referral_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column referral_code set not null;

create unique index if not exists lr_users_referral_code_key
  on public.lr_users (referral_code);

create table if not exists public.lr_referrals (
  id bigint generated always as identity primary key,
  referrer_user_id bigint not null references public.lr_users(id) on delete cascade,
  referred_user_id bigint not null unique references public.lr_users(id) on delete cascade,
  reward_type text not null
    check (reward_type in ('reading_unlock', 'chat_credits')),
  reward_reading_id uuid references public.lr_readings(id) on delete set null,
  reward_amount integer not null default 0 check (reward_amount >= 0),
  status text not null default 'granted'
    check (status in ('granted', 'failed')),
  created_at timestamptz not null default now(),
  constraint lr_referrals_no_self_referral check (referrer_user_id <> referred_user_id),
  constraint lr_referrals_reading_reward_shape check (
    (reward_type = 'reading_unlock' and reward_reading_id is not null)
    or (reward_type = 'chat_credits' and reward_reading_id is null)
  )
);

create index if not exists lr_referrals_referrer_created_idx
  on public.lr_referrals (referrer_user_id, created_at desc);

alter table public.lr_referrals enable row level security;
alter table public.lr_referrals force row level security;

create policy lr_referrals_server_only on public.lr_referrals
  as restrictive for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.lr_referrals from anon, authenticated;
revoke all on sequence public.lr_referrals_id_seq from anon, authenticated;

grant select, insert, update on table public.lr_referrals to service_role;
grant usage, select on sequence public.lr_referrals_id_seq to service_role;

comment on column public.lr_users.referral_code is 'Share-safe code used in referral links.';
comment on column public.lr_users.chat_credits is 'Paid character-chat question credits earned through referrals.';
comment on table public.lr_referrals is 'One rewarded referral per newly referred LoveRabbit user.';
