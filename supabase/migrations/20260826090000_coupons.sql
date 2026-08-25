-- 쿠폰함. 가입 환영 쿠폰과 친구 초대 쿠폰이 여기 앉는다.
--
-- 발급은 트리거가 한다 - 회원 행이 생기면 환영 쿠폰, 추천 보상 행이 생기면
-- 추천인에게 초대 쿠폰. 가입 경로가 셋(이메일·소셜·뒤늦은 추천 보상)이라
-- 애플리케이션 코드에 발급을 두면 그중 하나는 반드시 빠진다.
--
-- 금액은 여기 상수로 둔다. 바꾸려면 아래 두 함수를 다시 만든다.
--   환영  3,000원 · 30일
--   초대  5,000원 · 30일 (초대받은 친구 한 명당 한 장)

create table if not exists public.lr_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.lr_users(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'referral')),
  discount integer not null check (discount > 0),
  -- 어느 초대로 생긴 쿠폰인지. 같은 초대로 두 장이 나가지 않게 유일하다.
  referral_id bigint references public.lr_referrals(id) on delete set null,
  -- 결제창에서 골라 주문에 붙인 순간. 주문이 취소되면 풀린다.
  order_id bigint references public.lr_orders(id) on delete set null,
  reserved_at timestamptz,
  -- 주문이 실제로 결제된 순간. 이게 차면 끝난 쿠폰이다.
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists lr_coupons_welcome_once
  on public.lr_coupons (user_id) where kind = 'welcome';
create unique index if not exists lr_coupons_referral_once
  on public.lr_coupons (referral_id) where referral_id is not null;
create index if not exists lr_coupons_user_idx
  on public.lr_coupons (user_id, created_at desc);

alter table public.lr_coupons enable row level security;
alter table public.lr_coupons force row level security;

create policy lr_coupons_server_only on public.lr_coupons
  as restrictive for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.lr_coupons from anon, authenticated;
grant select, insert, update on table public.lr_coupons to service_role;

-- 환영 쿠폰: 회원 행이 처음 생길 때 한 장.
create or replace function public.lr_issue_welcome_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lr_coupons (user_id, kind, discount, expires_at)
  values (new.id, 'welcome', 3000, now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists lr_users_welcome_coupon on public.lr_users;
create trigger lr_users_welcome_coupon
  after insert on public.lr_users
  for each row execute function public.lr_issue_welcome_coupon();

-- 초대 쿠폰: 추천 보상이 실제로 지급된 행마다 추천인에게 한 장.
create or replace function public.lr_issue_referral_coupon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'granted' then
    insert into public.lr_coupons (user_id, kind, discount, referral_id, expires_at)
    values (new.referrer_user_id, 'referral', 5000, new.id, now() + interval '30 days')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists lr_referrals_referral_coupon on public.lr_referrals;
create trigger lr_referrals_referral_coupon
  after insert on public.lr_referrals
  for each row execute function public.lr_issue_referral_coupon();

revoke all on function public.lr_issue_welcome_coupon() from public, anon, authenticated;
revoke all on function public.lr_issue_referral_coupon() from public, anon, authenticated;

comment on table public.lr_coupons is 'Signup and referral discount coupons, issued by triggers, redeemed at checkout.';
