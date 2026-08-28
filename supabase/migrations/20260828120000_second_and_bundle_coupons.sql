-- 두 번째 리딩 계단과 세트 쿠폰.
--
-- 첫 리딩은 1,900원인데 두 번째는 12,000원이었다. 결제한 29명 중 다시 산
-- 사람은 한 명(2026-08-28). 그 한 명은 정가를 냈다 — 정가가 문제가 아니라
-- 1,900 → 12,000 사이에 계단이 없는 게 문제다.
--
--   second  첫 리딩 주문이 승인되는 순간 한 장. 두 번째 리딩을 4,900원에.
--   bundle  3종 세트를 산 사람에게 두 장. 나머지 두 리딩을 0원에 연다.
--           (발급은 서버 코드 — order-review.ts — 가 한다. 세트인지는 주문
--           metadata 에만 있어서 트리거가 알기 어렵다.)

alter table public.lr_coupons drop constraint if exists lr_coupons_kind_check;
alter table public.lr_coupons
  add constraint lr_coupons_kind_check check (kind in ('welcome', 'referral', 'second', 'bundle'));

-- 세트 쿠폰은 0원 정액가다. 0 을 막던 제약을 연다.
alter table public.lr_coupons drop constraint if exists lr_coupons_amount_check;
alter table public.lr_coupons
  add constraint lr_coupons_amount_check check (
    (discount is not null and discount > 0 and fixed_price is null)
    or (fixed_price is not null and fixed_price >= 0 and discount is null)
  );

-- 한 사람에게 second 는 한 장뿐이다.
create unique index if not exists lr_coupons_second_once
  on public.lr_coupons (user_id) where kind = 'second';

create or replace function public.lr_issue_second_reading_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid_readings integer;
begin
  if new.kind <> 'reading' or new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;
  select count(*) into paid_readings
  from public.lr_orders
  where user_id = new.user_id and kind = 'reading' and status = 'paid';
  -- 방금 승인된 이 주문이 첫 결제일 때만. 세트 주문(0원 쿠폰 소진)도 여기
  -- 걸리지만 unique 인덱스가 두 번째 장을 막는다.
  if paid_readings = 1 then
    insert into public.lr_coupons (user_id, kind, discount, fixed_price, expires_at)
    values (new.user_id, 'second', null, 4900, now() + interval '30 days')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists lr_orders_second_reading_coupon on public.lr_orders;
create trigger lr_orders_second_reading_coupon
  after update of status on public.lr_orders
  for each row execute function public.lr_issue_second_reading_coupon();

revoke all on function public.lr_issue_second_reading_coupon() from public, anon, authenticated;

-- 이미 한 번 산 사람들에게도 같은 계단을 놓는다 (2026-08-28 기준 28명).
insert into public.lr_coupons (user_id, kind, discount, fixed_price, expires_at)
select distinct o.user_id, 'second'::text, null::integer, 4900, now() + interval '30 days'
from public.lr_orders o
where o.kind = 'reading' and o.status = 'paid'
on conflict do nothing;
