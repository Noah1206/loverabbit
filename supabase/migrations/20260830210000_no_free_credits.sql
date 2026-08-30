-- 무료 크레딧을 걷는다 (2026-08-30 운영자 결정).
--
-- 크레딧은 이제 **사야만 생긴다**. 가입 선물도, 초대 클릭 보상도 없다.
-- 대신 첫 구매에 큰 폭의 할인을 붙여 그 자리에서 사게 만든다
-- (src/lib/credits.ts 의 FIRST_BUY_PACKS).
--
-- 왜 트리거를 지우고 함수만 비우지 않는가. 트리거를 남기면 "왜 크레딧이
-- 생겼나" 를 찾을 때 함수 본문까지 열어봐야 한다. 지급하는 길이 없으면
-- 없는 것이 보여야 한다.

-- 1. 가입 지급 트리거를 뗀다.
drop trigger if exists lr_users_signup_credits on public.lr_users;
drop function if exists public.lr_grant_signup_credits();

-- 2. 초대 클릭 보상을 끊는다.
--
-- 함수는 남긴다 — /api/referral/click 이 부르고 있고, 없애면 그 라우트가
-- 500 을 낸다. 클릭 기록은 그대로 남기되(누가 눌렀는지는 여전히 알아야 한다)
-- 크레딧만 주지 않고 항상 false 를 돌려준다.
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
begin
  select id into v_referrer from public.lr_users
  where referral_code = upper(trim(p_referral_code));
  if v_referrer is null then return false; end if;

  -- 기록은 남긴다. 보상은 없다.
  insert into public.lr_referral_clicks (referrer_user_id, device_key)
  values (v_referrer, p_device_key)
  on conflict do nothing;

  return false;
end;
$$;
revoke all on function public.lr_reward_referral_click(text, text) from public, anon, authenticated;
grant execute on function public.lr_reward_referral_click(text, text) to service_role;

comment on function public.lr_reward_referral_click(text, text) is
  'Records a referral click. Grants no credits since 2026-08-30 — credits are purchase-only.';

-- 3. 원장의 reason 에서 지급 사유를 빼지는 않는다.
--    이미 나간 signup/referral_click 기록이 남아 있고, 그 과거를 지우면
--    "이 사람 잔액이 왜 이런가" 를 설명할 수 없게 된다.
