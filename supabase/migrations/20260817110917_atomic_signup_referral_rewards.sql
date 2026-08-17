-- Create-or-return the member and grant a referral reward in one transaction.
-- The function runs with the caller's privileges and is callable only by service_role.
create or replace function public.lr_signup_with_referral(
  p_email text,
  p_birthdate date,
  p_marketing_consent boolean default false,
  p_adult_verified_at timestamptz default now(),
  p_referral_code text default null,
  p_reward_type text default null,
  p_reward_reading_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user public.lr_users%rowtype;
  v_is_new boolean := false;
  v_referrer_id bigint;
  v_referral_id bigint;
  v_reward_reading_id uuid;
  v_referral_claimed boolean := false;
begin
  insert into public.lr_users (
    email,
    birthdate,
    marketing_consent,
    adult_verification_method,
    adult_verified_at,
    updated_at
  )
  values (
    lower(trim(p_email)),
    p_birthdate,
    coalesce(p_marketing_consent, false),
    'self_attested',
    p_adult_verified_at,
    now()
  )
  on conflict (email) do nothing
  returning * into v_user;

  if found then
    v_is_new := true;
  else
    update public.lr_users as target
    set
      birthdate = p_birthdate,
      marketing_consent = coalesce(p_marketing_consent, target.marketing_consent),
      adult_verification_method = 'self_attested',
      adult_verified_at = coalesce(p_adult_verified_at, target.adult_verified_at),
      updated_at = now()
    where target.email = lower(trim(p_email))
    returning * into v_user;
  end if;

  if v_user.id is null then
    raise exception 'member could not be created or loaded';
  end if;

  -- Only the first successful creation can produce a referral reward.
  if v_is_new
    and nullif(trim(p_referral_code), '') is not null
    and p_reward_type in ('reading_unlock', 'chat_credits')
  then
    select id
    into v_referrer_id
    from public.lr_users
    where referral_code = upper(trim(p_referral_code))
      and id <> v_user.id;

    if v_referrer_id is not null then
      if p_reward_type = 'reading_unlock' then
        select id
        into v_reward_reading_id
        from public.lr_readings
        where id = p_reward_reading_id
          and user_id = v_referrer_id
          and unlocked = false;
      end if;

      if p_reward_type = 'chat_credits' or v_reward_reading_id is not null then
        insert into public.lr_referrals (
          referrer_user_id,
          referred_user_id,
          reward_type,
          reward_reading_id,
          reward_amount
        )
        values (
          v_referrer_id,
          v_user.id,
          p_reward_type,
          v_reward_reading_id,
          case when p_reward_type = 'chat_credits' then 10 else 0 end
        )
        on conflict (referred_user_id) do nothing
        returning id into v_referral_id;

        if v_referral_id is not null then
          if p_reward_type = 'reading_unlock' then
            update public.lr_readings
            set
              unlocked = true,
              payment = jsonb_build_object(
                'method', 'referral',
                'referredUserId', v_user.id,
                'at', now()
              ),
              updated_at = now()
            where id = v_reward_reading_id
              and user_id = v_referrer_id;
          else
            update public.lr_users
            set
              chat_credits = chat_credits + 10,
              updated_at = now()
            where id = v_referrer_id;
          end if;

          v_referral_claimed := true;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'birthdate', v_user.birthdate,
    'marketingConsent', v_user.marketing_consent,
    'referralCode', v_user.referral_code,
    'chatCredits', v_user.chat_credits,
    'isNew', v_is_new,
    'referralClaimed', v_referral_claimed
  );
end;
$$;

revoke all on function public.lr_signup_with_referral(
  text,
  date,
  boolean,
  timestamptz,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.lr_signup_with_referral(
  text,
  date,
  boolean,
  timestamptz,
  text,
  text,
  uuid
) to service_role;

comment on function public.lr_signup_with_referral(
  text,
  date,
  boolean,
  timestamptz,
  text,
  text,
  uuid
) is 'Atomically upserts a member and rewards only a genuinely new referred signup.';
