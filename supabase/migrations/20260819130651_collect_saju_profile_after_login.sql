-- OAuth completes before the reading form. New social accounts therefore exist
-- before saju details are collected, and the reading API persists those details.
alter table public.lr_users
  alter column birthdate drop not null;

comment on column public.lr_users.birthdate is
  'Verified self-reported birth date. Null until the user completes the saju input flow.';

alter table public.lr_user_profiles
  add column saju_birthdate date,
  add column saju_birth_hour smallint,
  add column saju_birth_time_unknown boolean not null default false,
  add column saju_gender text,
  add column saju_profile_updated_at timestamptz;

alter table public.lr_user_profiles
  add constraint lr_user_profiles_saju_birth_hour_check
    check (saju_birth_hour is null or saju_birth_hour between 0 and 23),
  add constraint lr_user_profiles_saju_gender_check
    check (saju_gender is null or saju_gender in ('F', 'M')),
  add constraint lr_user_profiles_saju_unknown_hour_check
    check (not saju_birth_time_unknown or saju_birth_hour is null);

update public.lr_user_profiles as profile
set saju_birthdate = member.birthdate
from public.lr_users as member
where profile.user_id = member.id
  and profile.saju_birthdate is null;

create or replace function public.lr_save_saju_profile(
  p_user_id bigint,
  p_birthdate date,
  p_birth_hour smallint,
  p_birth_time_unknown boolean,
  p_gender text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_birthdate is null
    or p_birthdate < date '1900-01-01'
    or p_birthdate > (current_date - interval '19 years')::date
  then
    raise exception 'invalid adult birthdate';
  end if;

  if p_gender is null or p_gender not in ('F', 'M') then
    raise exception 'invalid gender';
  end if;

  if p_birth_time_unknown is null
    or (p_birth_time_unknown and p_birth_hour is not null)
    or (not p_birth_time_unknown and (p_birth_hour is null or p_birth_hour not between 0 and 23))
  then
    raise exception 'invalid birth hour';
  end if;

  update public.lr_users
  set
    birthdate = p_birthdate,
    adult_verification_method = 'self_attested',
    adult_verified_at = coalesce(adult_verified_at, now()),
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'member not found';
  end if;

  insert into public.lr_user_profiles (
    user_id,
    saju_birthdate,
    saju_birth_hour,
    saju_birth_time_unknown,
    saju_gender,
    saju_profile_updated_at,
    updated_at
  )
  values (
    p_user_id,
    p_birthdate,
    p_birth_hour,
    p_birth_time_unknown,
    p_gender,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    saju_birthdate = excluded.saju_birthdate,
    saju_birth_hour = excluded.saju_birth_hour,
    saju_birth_time_unknown = excluded.saju_birth_time_unknown,
    saju_gender = excluded.saju_gender,
    saju_profile_updated_at = excluded.saju_profile_updated_at,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.lr_save_saju_profile(
  bigint,
  date,
  smallint,
  boolean,
  text
) from public, anon, authenticated;

grant execute on function public.lr_save_saju_profile(
  bigint,
  date,
  smallint,
  boolean,
  text
) to service_role;

comment on function public.lr_save_saju_profile(
  bigint,
  date,
  smallint,
  boolean,
  text
) is 'Server-only atomic persistence for the authenticated member saju profile.';

comment on column public.lr_user_profiles.saju_birthdate is
  'Birth date supplied by the member in the saju reading flow.';
comment on column public.lr_user_profiles.saju_birth_hour is
  'Birth hour from 0 through 23; null when the member selected unknown.';
comment on column public.lr_user_profiles.saju_gender is
  'Saju calculation gender supplied by the member.';
