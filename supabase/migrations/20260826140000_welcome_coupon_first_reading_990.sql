-- 가입 환영 쿠폰 = 첫 전문 리딩 990원.
--
-- 전에는 3,000원 정액 할인이었다. 상품가가 9,900원부터 49,900원까지 벌어져 있어
-- 같은 쿠폰이 사람마다 다른 문턱을 만들었다 - 결혼 사주를 보러 온 사람에게
-- 3,000원 쿠폰은 "46,900원을 내라"는 말이었다.
--
-- 그래서 깎을 금액이 아니라 **낼 금액**을 못박는다. 어떤 사주든 첫 한 장은 990원.
-- 990 은 이미 광고 오퍼(src/lib/ad-offers.ts)가 쓰는 값이고, 그 경로로 PG 결제가
-- 실제로 통과하고 있다 - 새 가격대를 여는 게 아니다.

alter table public.lr_coupons
  add column if not exists fixed_price integer;

-- 두 값 중 하나만 산다. 할인 쿠폰이면 discount, 정액가 쿠폰이면 fixed_price.
-- 둘 다 채우면 어느 쪽이 이기는지가 코드에 숨고, 그건 결제 금액이 숨는다는 뜻이다.
alter table public.lr_coupons alter column discount drop not null;
alter table public.lr_coupons drop constraint if exists lr_coupons_discount_check;
alter table public.lr_coupons drop constraint if exists lr_coupons_amount_check;
alter table public.lr_coupons
  add constraint lr_coupons_amount_check check (
    (discount is not null and discount > 0 and fixed_price is null)
    or (fixed_price is not null and fixed_price > 0 and discount is null)
  );

-- 이미 나가 있는 환영 쿠폰도 같은 규칙으로 맞춘다. 아직 안 쓴 것만 -- 쓴 쿠폰의
-- 금액은 그때 실제로 계산된 값이라, 바꾸면 주문 기록과 어긋난다.
update public.lr_coupons
set fixed_price = 990, discount = null
where kind = 'welcome' and used_at is null and fixed_price is null;

create or replace function public.lr_issue_welcome_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lr_coupons (user_id, kind, discount, fixed_price, expires_at)
  values (new.id, 'welcome', null, 990, now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.lr_issue_welcome_coupon() from public, anon, authenticated;

comment on column public.lr_coupons.fixed_price is
  'When set, redeeming the coupon makes the order cost exactly this amount instead of subtracting a discount.';
