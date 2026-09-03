-- 오늘의 액션 AI 개인화 문구 캐시.
--
-- 같은 사람이 같은 날 같은 (흐름, 영역) 조합을 다시 열면 AI 를 다시 부르지
-- 않고 여기 것을 준다 — 비용과 지연이 하루 유저당 몇 건으로 고정된다.
-- 지난 날 것은 다시 읽을 일이 없어 지우지 않고 그냥 둔다 (행이 작다).

create table if not exists public.lr_daily_action_texts (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users (id) on delete cascade,
  action_date date not null,
  -- "흐름:영역" — 예: "재성:money". 오방기 뽑기가 흐름을 정하므로 날짜당
  -- 여러 조합이 생길 수 있다.
  cache_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, action_date, cache_key)
);

create index if not exists lr_daily_action_texts_user_date_idx
  on public.lr_daily_action_texts (user_id, action_date desc);

alter table public.lr_daily_action_texts enable row level security;

revoke all on public.lr_daily_action_texts from public, anon, authenticated;
grant select, insert on public.lr_daily_action_texts to service_role;

comment on table public.lr_daily_action_texts is
  '오늘의 사주 액션 AI 개인화 문구 캐시 (유저·날짜·흐름·영역별 1회 생성)';
