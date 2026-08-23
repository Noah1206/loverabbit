-- 모델 호출의 값을 남긴다.
--
-- 어제부터 오늘까지 청구서가 $1.84 였는데, 저장소가 셀 수 있는 것은 $0.35 였다.
-- 다섯 배 차이인데 어디서 났는지 알 방법이 없었다 - usage 는 응답에서 받아 쓰면서
-- 어디에도 남기지 않았기 때문이다. 재생성인지, 가드 재작성인지, 실패한 호출인지
-- 사후에 가릴 수가 없다.
--
-- 그래서 부를 때마다 한 줄 남긴다. 리딩 하나가 여러 줄을 갖는다(머리 + 조각들 +
-- 다시 쓴 절). 그 합이 곧 그 리딩의 원가고, 하루치를 더하면 청구서와 맞춰볼 수 있다.
--
-- reading_id 를 참조로 걸지 않는다. 무료 미리보기처럼 리딩이 아직 저장되기 전에
-- 부르는 자리가 있고, 리딩이 지워져도 값은 나간 것이라 기록은 남아야 한다.

create table if not exists public.lr_ai_usage (
  id bigint generated always as identity primary key,
  -- 어느 리딩의 값인가. 리딩 밖에서 부른 것(채팅 등)은 비어 있다.
  reading_id uuid,
  -- 어느 길에서 났는가: free_preview | reading | unlock | rewrite | chat
  stage text not null check (length(btrim(stage)) > 0),
  category text,
  provider text,
  model text,
  -- 이 줄이 대표하는 호출 수. 조각을 묶어 한 줄로 남길 때가 있다.
  calls integer not null default 1 check (calls >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- 단가표로 환산한 값. 단가를 모르는 모델이면 비어 있다.
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

-- 하루치를 더하는 것이 이 표의 주된 쓰임이다.
create index if not exists lr_ai_usage_created_idx on public.lr_ai_usage (created_at desc);
create index if not exists lr_ai_usage_reading_idx on public.lr_ai_usage (reading_id) where reading_id is not null;

-- 다른 표와 같은 규칙 - 서버(service_role)만 읽고 쓴다.
alter table public.lr_ai_usage enable row level security;
