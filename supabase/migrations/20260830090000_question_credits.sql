-- 질문 크레딧 (2026-08-30 결정).
--
-- 크레딧은 **질문 기능 전용**이다. 리딩은 지금처럼 원화 결제 + 쿠폰 계단
-- (환영 1,900 → 두 번째 4,900 → 정가)으로 간다. 리딩에 크레딧 단가를 붙이지
-- 않는다. 두 체계가 만나는 자리가 없으므로 결제창 계산도 섞이지 않는다.
--
--   환율          100원 = 1크레딧
--   질문 1회      5크레딧
--   가입          15크레딧 (질문 3회) — 환영 쿠폰과 별개로
--   초대 클릭     초대인에게 5크레딧 (기기당 1회, 초대인 하루 5회 상한)
--   초대 가입     5,000원 쿠폰 (기존 그대로)
--
-- lr_users.chat_credits 는 캐릭터챗 시절 컬럼이다. 잔액 캐시로 계속 쓰되,
-- 정본은 아래 원장(lr_credit_ledger)이다. 컬럼 하나로는 "왜 3장이 사라졌나"에
-- 답할 수 없어서 원장을 둔다. 잔액은 원장 합계와 같아야 한다 — 증감은 전부
-- lr_credit_apply 를 거친다.

create table if not exists public.lr_credit_ledger (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users(id) on delete cascade,
  -- 양수는 지급, 음수는 소진.
  delta integer not null check (delta <> 0),
  reason text not null check (reason in (
    'signup',            -- 가입 15
    'referral_click',    -- 초대 링크 클릭 5
    'purchase',          -- 팩 구매
    'question',          -- 질문 -5
    'refund',            -- 실패한 질문 되돌림 +5
    'admin'              -- 운영자 수기
  )),
  -- 무엇 때문인지. 주문·질문·클릭 기록의 키.
  ref text,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists lr_credit_ledger_user_idx
  on public.lr_credit_ledger (user_id, created_at desc);
-- 같은 주문·같은 클릭으로 두 번 지급하지 않는다.
create unique index if not exists lr_credit_ledger_ref_once
  on public.lr_credit_ledger (reason, ref) where ref is not null;

alter table public.lr_credit_ledger enable row level security;
alter table public.lr_credit_ledger force row level security;
create policy lr_credit_ledger_server_only on public.lr_credit_ledger
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on table public.lr_credit_ledger from anon, authenticated;
grant select, insert on table public.lr_credit_ledger to service_role;

comment on table public.lr_credit_ledger is 'Question-credit ledger. lr_users.chat_credits caches the running balance.';

-- 초대 링크 클릭. 기기(쿠키) 하나가 초대인 하나에게 한 번만 준다.
create table if not exists public.lr_referral_clicks (
  id bigint generated always as identity primary key,
  referrer_user_id bigint not null references public.lr_users(id) on delete cascade,
  -- 브라우저가 받은 무작위 쿠키. 사람이 아니라 기기다.
  device_key text not null check (length(device_key) between 16 and 64),
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (referrer_user_id, device_key)
);
create index if not exists lr_referral_clicks_referrer_day_idx
  on public.lr_referral_clicks (referrer_user_id, created_at desc);

alter table public.lr_referral_clicks enable row level security;
alter table public.lr_referral_clicks force row level security;
create policy lr_referral_clicks_server_only on public.lr_referral_clicks
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on table public.lr_referral_clicks from anon, authenticated;
grant select, insert, update on table public.lr_referral_clicks to service_role;

-- 증감 한 건. 잔액 행을 잠그고, 모자라면 실패하고, 원장에 적고, 새 잔액을 돌려준다.
-- 같은 (reason, ref) 가 이미 있으면 다시 주지 않고 현재 잔액만 돌려준다.
create or replace function public.lr_credit_apply(
  p_user_id bigint,
  p_delta integer,
  p_reason text,
  p_ref text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_ref is not null and exists (
    select 1 from public.lr_credit_ledger where reason = p_reason and ref = p_ref
  ) then
    select chat_credits into v_balance from public.lr_users where id = p_user_id;
    return v_balance;
  end if;

  select chat_credits into v_balance
  from public.lr_users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_USER_NOT_FOUND';
  end if;
  if v_balance + p_delta < 0 then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  v_balance := v_balance + p_delta;
  update public.lr_users set chat_credits = v_balance, updated_at = now() where id = p_user_id;
  insert into public.lr_credit_ledger (user_id, delta, reason, ref, balance_after)
  values (p_user_id, p_delta, p_reason, p_ref, v_balance);
  return v_balance;
end;
$$;
revoke all on function public.lr_credit_apply(bigint, integer, text, text) from public, anon, authenticated;
grant execute on function public.lr_credit_apply(bigint, integer, text, text) to service_role;

-- 초대 클릭 보상. 기기당 1회, 초대인 하루 5회. 지급됐으면 true.
create or replace function public.lr_reward_referral_click(
  p_referral_code text,
  p_device_key text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_referrer bigint;
  v_today integer;
begin
  select id into v_referrer from public.lr_users
  where referral_code = upper(trim(p_referral_code));
  if v_referrer is null then return false; end if;

  insert into public.lr_referral_clicks (referrer_user_id, device_key)
  values (v_referrer, p_device_key)
  on conflict do nothing;
  if not found then return false; end if;

  select count(*) into v_today from public.lr_referral_clicks
  where referrer_user_id = v_referrer and rewarded and created_at > now() - interval '1 day';
  if v_today >= 5 then return false; end if;

  update public.lr_referral_clicks set rewarded = true
  where referrer_user_id = v_referrer and device_key = p_device_key;
  perform public.lr_credit_apply(v_referrer, 5, 'referral_click', v_referrer::text || ':' || p_device_key);
  return true;
end;
$$;
revoke all on function public.lr_reward_referral_click(text, text) from public, anon, authenticated;
grant execute on function public.lr_reward_referral_click(text, text) to service_role;

-- 가입 15크레딧. 환영 쿠폰과 같은 자리(회원 행 생성)에서 나간다.
create or replace function public.lr_grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lr_credit_apply(new.id, 15, 'signup', new.id::text);
  return new;
end;
$$;
drop trigger if exists lr_users_signup_credits on public.lr_users;
create trigger lr_users_signup_credits
  after insert on public.lr_users
  for each row execute function public.lr_grant_signup_credits();
revoke all on function public.lr_grant_signup_credits() from public, anon, authenticated;

-- 팩 구매 완료. 캐릭터챗 시절 RPC 를 원장을 거치게 다시 쓴다.
create or replace function public.lr_complete_chat_credit_order(
  p_provider_order_id text,
  p_user_id bigint
)
returns table (order_id bigint, credits_remaining integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.lr_orders%rowtype;
  v_credits integer;
  v_balance integer;
  v_now timestamptz := now();
begin
  update public.lr_orders
  set status = 'paid', paid_at = v_now, updated_at = v_now
  where provider_order_id = p_provider_order_id
    and user_id = p_user_id
    and kind = 'chat_credits'
    and method in ('toss-pg', 'portone-pg')
    and status = 'pending'
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0001', message = 'PENDING_CHAT_ORDER_NOT_FOUND';
  end if;
  v_credits := nullif(v_order.metadata ->> 'credits', '')::integer;
  if v_credits is null or v_credits < 1 or v_credits > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_CHAT_CREDITS';
  end if;
  v_balance := public.lr_credit_apply(p_user_id, v_credits, 'purchase', v_order.id::text);
  return query select v_order.id, v_balance;
end;
$$;

-- 계좌이체 승인도 원장을 거친다. 리딩 쪽 분기는 그대로.
create or replace function public.lr_review_transfer_order(
  p_order_id bigint,
  p_decision text,
  p_note text default null
)
returns table (order_id bigint, reading_id uuid, review_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.lr_orders%rowtype;
  v_now timestamptz := now();
  v_credits integer;
begin
  if p_decision not in ('paid', 'cancelled') then
    raise exception using errcode = '22023', message = 'INVALID_TRANSFER_DECISION';
  end if;
  update public.lr_orders
  set
    status = p_decision,
    paid_at = case when p_decision = 'paid' then v_now else null end,
    updated_at = v_now,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object('reviewed_at', v_now, 'review_note', nullif(left(btrim(p_note), 500), ''))
    )
  where id = p_order_id
    and kind in ('reading', 'chat_credits')
    and method = 'transfer'
    and status = 'pending'
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0001', message = 'PENDING_TRANSFER_ORDER_NOT_FOUND';
  end if;

  if p_decision = 'paid' and v_order.kind = 'reading' then
    if v_order.reading_id is null then
      raise exception using errcode = 'P0001', message = 'ORDER_READING_NOT_FOUND';
    end if;
    update public.lr_readings
    set
      unlocked = true,
      payment = jsonb_build_object('method', 'transfer', 'orderId', v_order.id, 'depositorCode', v_order.depositor_code, 'at', v_now),
      updated_at = v_now
    where id = v_order.reading_id and user_id = v_order.user_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_READING_NOT_FOUND';
    end if;
  elsif p_decision = 'paid' and v_order.kind = 'chat_credits' then
    v_credits := nullif(v_order.metadata ->> 'credits', '')::integer;
    if v_credits is null or v_credits < 1 or v_credits > 1000 then
      raise exception using errcode = '22023', message = 'INVALID_CHAT_CREDITS';
    end if;
    perform public.lr_credit_apply(v_order.user_id, v_credits, 'purchase', v_order.id::text);
  end if;
  return query select v_order.id, v_order.reading_id, p_decision;
end;
$$;

-- 가입 RPC 의 죽은 "+10" 을 뗀다. 이메일 가입으로 초대받은 건은 지금까지도 이
-- 컬럼에 10씩 쌓고 있었다 — 쿠폰 트리거와 이중 보상이었다. 보상은 쿠폰이다.
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
  insert into public.lr_users (email, birthdate, marketing_consent, adult_verification_method, adult_verified_at, updated_at)
  values (lower(trim(p_email)), p_birthdate, coalesce(p_marketing_consent, false), 'self_attested', p_adult_verified_at, now())
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

  if v_is_new
    and nullif(trim(p_referral_code), '') is not null
    and p_reward_type in ('reading_unlock', 'chat_credits')
  then
    select id into v_referrer_id from public.lr_users
    where referral_code = upper(trim(p_referral_code)) and id <> v_user.id;

    if v_referrer_id is not null then
      if p_reward_type = 'reading_unlock' then
        select id into v_reward_reading_id from public.lr_readings
        where id = p_reward_reading_id and user_id = v_referrer_id and unlocked = false;
      end if;

      if p_reward_type = 'chat_credits' or v_reward_reading_id is not null then
        insert into public.lr_referrals (referrer_user_id, referred_user_id, reward_type, reward_reading_id, reward_amount)
        values (v_referrer_id, v_user.id, p_reward_type, v_reward_reading_id, 0)
        on conflict (referred_user_id) do nothing
        returning id into v_referral_id;

        if v_referral_id is not null then
          if p_reward_type = 'reading_unlock' then
            update public.lr_readings
            set unlocked = true,
                payment = jsonb_build_object('method', 'referral', 'referredUserId', v_user.id, 'at', now()),
                updated_at = now()
            where id = v_reward_reading_id and user_id = v_referrer_id;
          end if;
          -- 쿠폰은 lr_referrals 트리거가 발행한다.
          v_referral_claimed := true;
        end if;
      end if;
    end if;
  end if;

  -- 가입 크레딧은 트리거가 이미 줬다. 여기서 다시 읽어야 새 잔액이 돌아간다.
  select chat_credits into v_user.chat_credits from public.lr_users where id = v_user.id;

  return jsonb_build_object(
    'id', v_user.id, 'email', v_user.email, 'birthdate', v_user.birthdate,
    'marketingConsent', v_user.marketing_consent, 'referralCode', v_user.referral_code,
    'chatCredits', v_user.chat_credits, 'isNew', v_is_new, 'referralClaimed', v_referral_claimed
  );
end;
$$;

-- 죽은 컬럼에 쌓인 잔액을 정리한다. 원장에 없는 잔액은 출처가 없는 돈이다 —
-- 캐릭터챗 시절 지급분과 이중 보상분이다. 0 으로 놓고 원장부터 다시 센다.
-- (팩 구매 이력은 lr_orders 에 남아 있다. 실제로 산 사람이 있으면 admin 사유로 되돌린다.)
update public.lr_users set chat_credits = 0 where chat_credits <> 0;

-- 기존 회원에게도 가입 15크레딧. 트리거는 앞으로의 행에만 걸린다.
insert into public.lr_credit_ledger (user_id, delta, reason, ref, balance_after)
select id, 15, 'signup', id::text, 15 from public.lr_users
on conflict do nothing;
update public.lr_users set chat_credits = 15;

-- 질문 기록. 답은 리딩과 달리 봉인하지 않는다 — 크레딧을 낸 사람 것이고 다시 볼 수 있어야 한다.
create table if not exists public.lr_questions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.lr_users(id) on delete cascade,
  question text not null check (length(question) between 1 and 500),
  answer text,
  -- 답이 어느 리딩을 딛고 섰는가. 없으면 사주 프로필만.
  reading_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'answered', 'failed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists lr_questions_user_idx on public.lr_questions (user_id, created_at desc);
alter table public.lr_questions enable row level security;
alter table public.lr_questions force row level security;
create policy lr_questions_server_only on public.lr_questions
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on table public.lr_questions from anon, authenticated;
grant select, insert, update on table public.lr_questions to service_role;
