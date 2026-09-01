-- 환율을 100원 → 1,000원으로 바꾼다 (2026-09-01 운영자 결정).
--
-- 손님이 내는 돈은 그대로 두고 러빗 숫자만 1/10 로 접었다. 리딩은 19러빗에서
-- 2러빗이 되지만 값은 여전히 1,900원이다. 화면 쪽 상수는 src/lib/credits.ts 가
-- 들고 있고, 여기서는 **DB 안에 숫자로 박혀 있는 지급량**만 맞춘다.
--
-- 초대 가입 보상이 그것 하나다. 50 을 그대로 두면 새 환율에서 5만 원어치를
-- 주게 된다 — 같은 값어치(5,000원)인 5 로 내린다.
--
-- 함수 이름과 조건은 20260831230000_referral_credits.sql 의 것을 그대로 쓴다.
-- 이름이 어긋나면 새 함수만 생기고 트리거는 옛 값을 계속 쓴다.

create or replace function public.lr_issue_referral_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'granted' then
    -- 5러빗 = 5,000원. 환율이 바뀌기 전의 50크레딧과 같은 값어치다.
    perform public.lr_credit_apply(new.referrer_user_id, 5, 'referral_signup', new.id::text);
  end if;
  return new;
end;
$$;

comment on function public.lr_issue_referral_coupon() is
  'Grants 5 luvit (= 5,000 KRW) to the referrer on friend signup. Rescaled 2026-09-01 when 1 luvit became 1,000 KRW (was 50).';

-- 이미 쌓인 원장은 건드리지 않는다. 옛 환율로 받은 잔액은 그 사람이 그 값에
-- 산 것이고, 지금 와서 1/10 로 깎으면 산 물건을 빼앗는 셈이 된다.
-- (옛 잔액 50 은 새 환율에서 리딩 25장 값이 된다 — 그 이득은 그대로 둔다.)
