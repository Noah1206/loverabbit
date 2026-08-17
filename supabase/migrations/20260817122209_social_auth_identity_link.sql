-- Link LoveRabbit's server-owned member row to a verified Supabase Auth user.
-- Existing email-only members remain valid and are linked on their first social login.
alter table public.lr_users
  add column if not exists auth_user_id uuid,
  add column if not exists auth_provider text;

alter table public.lr_users
  add constraint lr_users_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete set null;

alter table public.lr_users
  add constraint lr_users_auth_provider_check
  check (auth_provider is null or auth_provider in ('google', 'kakao'));

alter table public.lr_users
  add constraint lr_users_auth_identity_complete_check
  check (
    (auth_user_id is null and auth_provider is null)
    or (auth_user_id is not null and auth_provider is not null)
  );

create unique index if not exists lr_users_auth_user_id_key
  on public.lr_users (auth_user_id)
  where auth_user_id is not null;

comment on column public.lr_users.auth_user_id is
  'Verified Supabase Auth user linked to this server-owned member.';
comment on column public.lr_users.auth_provider is
  'Most recently confirmed OAuth provider for the linked Supabase Auth user.';
