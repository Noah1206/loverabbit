-- 초대 가입 보상을 5러빗 → 3러빗으로 (2026-09-01 운영자 결정).
--
-- 3러빗 = 3,000원. 첫 사주 한 장(2러빗)을 열고도 한 러빗이 남는 값이라,
-- 받은 사람이 그 자리에서 쓸 수 있다.
--
-- 화면 상수는 src/lib/credits.ts 의 REFERRAL_SIGNUP_CREDITS 가 들고 있다.
-- 둘이 어긋나면 화면이 약속한 값과 실제로 꽂히는 값이 달라진다 — 이 파일과
-- 그 상수는 같이 움직여야 한다.
--
-- 함수 이름과 조건은 앞의 두 마이그레이션(20260831230000, 20260901120000)의
-- 것을 그대로 쓴다. 이름이 어긋나면 새 함수만 생기고 트리거
-- (lr_referrals_referral_coupon) 는 옛 값을 계속 쓴다.
--
-- 이미 나간 5러빗은 건드리지 않는다. 그 값에 초대한 사람이 받은 것이고,
-- 지금 와서 깎으면 준 것을 빼앗는 셈이다.

create or replace function public.lr_issue_referral_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'granted' then
    -- 3러빗 = 3,000원 (2026-09-01, 5에서 내림)
    perform public.lr_credit_apply(new.referrer_user_id, 3, 'referral_signup', new.id::text);
  end if;
  return new;
end;
$$;

comment on function public.lr_issue_referral_coupon() is
  'Grants 3 luvit (= 3,000 KRW) to the referrer on friend signup. Lowered from 5 on 2026-09-01.';
