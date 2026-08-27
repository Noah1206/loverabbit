-- 첫 리딩 값 4,900원 → 1,900원 (2026-08-27 저녁, 운영자 결정).
--
-- 4,900원으로 올린 뒤 결제 화면 전환이 51% → 21% 로 떨어졌다. 990원의
-- "거의 공짜" 심리를 살리면서 매출은 두 배로 — 1,900원.
-- 안 쓴 환영 쿠폰도 새 값으로. 대기 중 주문에 붙은 쿠폰은 건드리지 않는다.

update public.lr_coupons
set fixed_price = 1900
where kind = 'welcome'
  and used_at is null
  and reserved_at is null
  and fixed_price in (990, 4900);

create or replace function public.lr_issue_welcome_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lr_coupons (user_id, kind, discount, fixed_price, expires_at)
  values (new.id, 'welcome', null, 1900, now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;
