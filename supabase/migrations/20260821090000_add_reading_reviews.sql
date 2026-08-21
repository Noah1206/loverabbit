-- 후기 — 실제로 서비스를 쓴 사람이 남긴 것만 들어온다.
--
-- 출처가 둘이고, 둘을 섞지 않는다.
--
--   source = 'live'  지금 사이트에서 결제하고 리딩을 열어 본 사람이 직접 남긴 것.
--                    리딩 한 건에 후기 하나이고(reading_id unique), 저장할 때
--                    서버가 그 리딩이 정말 이 사람 것이고 해금됐는지 확인한다.
--
--   source = 'beta'  베타 테스트 때 받은 후기를 운영자가 옮겨 담은 것. 그때는
--                    상품 이름이 지금과 달랐고 별점을 받지 않아서, product_id 와
--                    rating 이 비어 있다. 없는 값을 채우지 않는다 —
--                    별점을 지어내는 순간 평균이 거짓말이 된다.
--
-- 어느 쪽이든 브라우저는 직접 접근하지 못하고 서버 키로만 다룬다.

create table if not exists public.lr_reviews (
  id bigint generated always as identity primary key,
  source text not null default 'live' check (source in ('live', 'beta')),

  -- live 에서만 채워진다. 이 둘이 "산 사람이 썼다"의 증거다.
  user_id bigint references public.lr_users(id) on delete cascade,
  reading_id uuid unique references public.lr_readings(id) on delete cascade,

  -- 표시 이름은 저장 시점에 가려서 굳힌다. 그래서 조회 경로가 이메일을 건드릴 일이 없다.
  display_name text not null,

  -- 지금 카탈로그의 상품 id. 베타 후기는 해당하는 상품이 없어서 비어 있다.
  product_id text,
  product_label text not null,

  -- 베타 원본에 별점이 없다. 없으면 없는 채로 둔다.
  rating smallint check (rating between 1 and 5),
  body text,

  purchase_count integer not null default 1 check (purchase_count >= 0),
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_reason text,

  -- 베타 후기를 다시 넣어도 두 번 쌓이지 않게 하는 열쇠 (원본 작성자+시각+본문).
  import_key text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lr_reviews_body_length
    check (body is null or char_length(btrim(body)) between 1 and 500),

  -- 내릴 때는 사유를 댈 수 있어야 한다. 아래 moderateReview 의 주석 참고.
  constraint lr_reviews_hidden_needs_reason
    check (status <> 'hidden' or char_length(btrim(coalesce(hidden_reason, ''))) >= 2),

  -- live 후기는 반드시 산 사람이 쓴 것이어야 한다. 이 제약이 풀리면
  -- 아무나 후기를 만들어 넣을 수 있고, 그러면 후기 전체가 의미를 잃는다.
  constraint lr_reviews_live_is_verified
    check (
      source <> 'live'
      or (user_id is not null and reading_id is not null and rating is not null)
    ),

  -- 베타 후기는 사람이 옮겨 담는 것이라, 어디서 왔는지 되짚을 열쇠를 반드시 들고 있어야 한다.
  constraint lr_reviews_beta_has_import_key
    check (source <> 'beta' or import_key is not null)
);

-- 홈은 노출 중인 것만 최신순으로 읽는다.
create index if not exists lr_reviews_status_created_idx
  on public.lr_reviews (status, created_at desc);

-- 상품 상세에서 그 상품 후기만 뽑을 때.
create index if not exists lr_reviews_product_idx
  on public.lr_reviews (product_id, status, created_at desc);

create index if not exists lr_reviews_user_idx
  on public.lr_reviews (user_id, created_at desc);

alter table public.lr_reviews enable row level security;

create policy lr_reviews_server_only on public.lr_reviews
  as restrictive for all to anon, authenticated
  using (false) with check (false);

comment on table public.lr_reviews
  is 'Reading reviews. source=live is written only by the buyer of an unlocked reading; source=beta is imported from the beta test (no rating in the source). Server-key access only.';
