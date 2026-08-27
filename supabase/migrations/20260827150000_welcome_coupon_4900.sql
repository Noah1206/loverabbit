-- 첫 리딩 값을 990원에서 4,900원으로 (2026-08-27 운영자 결정).
--
-- 코드 쪽(coupons.ts FIRST_READING_PRICE, ad-offers.ts)과 같은 날 함께 바뀐다.
-- 아직 안 쓴 환영 쿠폰도 새 값으로 맞춘다 — 그대로 두면 이미 가입한 사람은
-- 계속 990원에 사고, 화면은 4,900원을 말해 둘이 어긋난다.
-- 계좌이체 승인 대기 중인 주문에 붙은 쿠폰(reserved_at 있음)은 건드리지 않는다.
-- 그 사람은 990원을 보고 이미 보냈다.

update public.lr_coupons
set fixed_price = 4900
where kind = 'welcome'
  and used_at is null
  and reserved_at is null
  and fixed_price = 990;

create or replace function public.lr_issue_welcome_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lr_coupons (user_id, kind, discount, fixed_price, expires_at)
  values (new.id, 'welcome', null, 4900, now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;
