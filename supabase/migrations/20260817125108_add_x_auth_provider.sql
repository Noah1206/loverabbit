-- Extend the verified social-provider allowlist for Supabase's X OAuth 2.0 provider.
alter table public.lr_users
  drop constraint if exists lr_users_auth_provider_check;

alter table public.lr_users
  add constraint lr_users_auth_provider_check
  check (auth_provider is null or auth_provider in ('google', 'kakao', 'x'));
