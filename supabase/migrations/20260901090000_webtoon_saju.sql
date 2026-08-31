-- 웹툰 사주 문장 캐시 (2026-09-01).
--
-- 명식으로 쓴 웹툰 문장을 담는다. 문장 한 편에 AI 호출이 한 번 드는데, 화면은
-- 탭을 옮길 때마다 열린다 - 캐시가 없으면 같은 문장을 매번 다시 사게 된다.
--
-- 열쇠는 (리딩, 운세) 다. 사람이 아니라 리딩에 붙는다: 같은 사람이라도 리딩이
-- 다르면 다른 편이고, 같은 리딩의 세 운세는 서로 다른 세 편이다.
--
-- prompt_version 을 같이 둔다. 프롬프트를 고치면 값이 달라져 옛 문장이 자동으로
-- 비켜난다 - 지우러 다니지 않아도 된다.
--
-- **해금 상태는 여기 없다.** 그것은 크레딧 원장이 정본이다
-- (reason='reading', ref='webtoon:{리딩id}:{운세}'). 두 곳에 두면 어긋난다.

create table if not exists public.lr_webtoon_contents (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.lr_readings(id) on delete cascade,
  fortune_type text not null check (fortune_type in ('money', 'love', 'breakup')),
  -- 만들어 둔 문장 한 편 (패널 오버레이·미리보기·상세 분석)
  content jsonb not null,
  -- 명식으로 쓴 것인가. false 면 프로필이 없거나 가드에 걸려 고정 카피로 나간 것이다.
  personalized boolean not null default false,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  unique (reading_id, fortune_type, prompt_version)
);

create index if not exists lr_webtoon_contents_reading_idx
  on public.lr_webtoon_contents (reading_id);

-- 서버(service_role)만 만진다 — 다른 lr_ 테이블과 같은 규칙.
alter table public.lr_webtoon_contents enable row level security;
alter table public.lr_webtoon_contents force row level security;
create policy lr_webtoon_contents_server_only on public.lr_webtoon_contents
  as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on table public.lr_webtoon_contents from anon, authenticated;
grant select, insert, update, delete on table public.lr_webtoon_contents to service_role;

comment on table public.lr_webtoon_contents is
  'Webtoon saju sentences per (reading, fortune). Unlock state lives in the credit ledger, not here.';
