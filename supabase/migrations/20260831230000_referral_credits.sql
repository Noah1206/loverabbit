-- 추천 가입 보상을 쿠폰에서 크레딧으로 (2026-08-31).
--
-- 크레딧이 단일 화폐가 되면서(20260831210000) 5,000원 쿠폰은 쓸 곳이
-- 없어졌다 — 리딩 결제창이 원화를 받지 않는다. 보상이 닿을 수 없으면
-- 초대할 이유도 없다. 같은 값어치의 50크레딧으로 바꾼다.
--
-- 이미 나간 쿠폰 행은 지우지 않는다 — 과거의 약속을 장부에서 지우면
-- "이 쿠폰이 왜 있나"에 답할 수 없게 된다. 새 보상만 크레딧으로 나간다.

alter table public.lr_credit_ledger
  drop constraint if exists lr_credit_ledger_reason_check;
alter table public.lr_credit_ledger
  add constraint lr_credit_ledger_reason_check check (reason in (
    'signup', 'referral_click', 'referral_signup', 'purchase', 'question',
    'reading', 'refund', 'admin'
  ));

-- lr_referrals insert 트리거 — 쿠폰 대신 크레딧을 지급한다.
-- (reason, ref) unique 에 referral id 가 실리므로 이중 지급은 원장이 막는다.
create or replace function public.lr_issue_referral_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'granted' then
    perform public.lr_credit_apply(new.referrer_user_id, 50, 'referral_signup', new.id::text);
  end if;
  return new;
end;
$$;

comment on function public.lr_issue_referral_coupon() is
  'Grants 50 credits to the referrer on friend signup. Renamed behavior 2026-08-31 (was a 5,000 KRW coupon).';
