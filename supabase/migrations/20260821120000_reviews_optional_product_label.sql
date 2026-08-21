-- 베타 후기에서 상품명을 뗀다.
--
-- 베타 때 상품 이름은 그것 자체가 다른 점술가·다른 서비스를 가리킨다
-- ('정통사주', '팩폭점사.zip', '자미두수'…). 러브레빗 홈에 걸리는 후기에 그 이름이
-- 붙어 있으면 어디서 받은 후기인지가 그대로 드러난다. 그래서 아예 비운다.
--
-- 지금 사이트에서 들어오는 후기(source='live')는 그대로 우리 상품명을 들고 있어야
-- 한다. '재회 사주' 후기인지 '결혼 사주' 후기인지 모르면 후기가 반쪽이 된다.
-- 그래서 컬럼을 통째로 없애지 않고, live 에만 필수로 남긴다.

alter table public.lr_reviews
  alter column product_label drop not null;

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
    )
  );

-- 이미 들어가 있는 베타 후기의 상품명을 비운다.
update public.lr_reviews
   set product_label = null,
       product_id = null,
       updated_at = now()
 where source = 'beta';

comment on column public.lr_reviews.product_label
  is 'Product name shown with the review. Required for source=live; always null for source=beta, where the beta-era name would identify another service.';
