-- One server-owned profile row per LoveRabbit member.
-- The browser stores the signed application token only; profile reads and writes
-- are resolved by Next.js and executed through the server-side service role.

create table public.lr_user_profiles (
  user_id bigint primary key
    references public.lr_users(id) on delete cascade,
  display_name text,
  theme text not null default 'dark'
    check (theme in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lr_user_profiles_display_name_length
    check (display_name is null or length(btrim(display_name)) between 1 and 40)
);

alter table public.lr_user_profiles enable row level security;
alter table public.lr_user_profiles force row level security;

revoke all on table public.lr_user_profiles from anon, authenticated;
grant select, insert, update on table public.lr_user_profiles to service_role;

create policy lr_user_profiles_server_only on public.lr_user_profiles
  as restrictive for all to anon, authenticated
  using (false) with check (false);

insert into public.lr_user_profiles (user_id)
select id from public.lr_users
on conflict (user_id) do nothing;

create function public.lr_ensure_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lr_user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.lr_ensure_user_profile() from public, anon, authenticated;

create trigger lr_users_create_profile
after insert on public.lr_users
for each row execute function public.lr_ensure_user_profile();

comment on table public.lr_user_profiles is
  'Server-owned LoveRabbit profile preferences linked one-to-one with lr_users.';
comment on column public.lr_user_profiles.theme is
  'Saved visual theme. Black/dark is the default.';
