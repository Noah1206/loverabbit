-- 베타 후기에서 구매 횟수를 뗀다.
--
-- '442번 구매'는 베타 플랫폼에서 그 사람이 산 횟수다. 러브레빗에서 산 횟수가
-- 아니다. 상품명을 뗀 것과 같은 이유로 여기 붙으면 사실이 아닌 말이 되고,
-- 이제 막 연 사이트에 400번 넘게 산 사람이 있다는 것도 앞뒤가 맞지 않는다.
--
-- 여기서 결제하고 남기는 후기(source='live')는 그대로 센다. 그 숫자는 우리
-- 주문 기록에서 나온 실제 값이라 붙일 근거가 있다.

alter table public.lr_reviews
  alter column purchase_count drop not null,
  alter column purchase_count drop default;

alter table public.lr_reviews
  drop constraint if exists lr_reviews_live_is_verified;

alter table public.lr_reviews
  add constraint lr_reviews_live_is_verified
  check (
    source <> 'live'
    or (
      user_id is not null
      and reading_id is not null
      and rating is not null
      and product_label is not null
      and purchase_count is not null
    )
  );

update public.lr_reviews
   set purchase_count = null,
       updated_at = now()
 where source = 'beta';

comment on column public.lr_reviews.purchase_count
  is 'How many paid orders the writer had here when they wrote it. Required for source=live; always null for source=beta, where the count belongs to the beta platform.';
