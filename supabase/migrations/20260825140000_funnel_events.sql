-- 사람이 어디서 그만뒀는가.
--
-- 지금까지 남는 것은 끝까지 온 사람뿐이다. 리딩이 만들어졌거나 결제됐거나 —
-- 둘 다 퍼널의 맨 끝이다. 어제 12명이 리딩을 만들었는데 그 앞에서 몇 명이
-- 폼을 열었다 닫았는지, 어느 칸에서 손을 놨는지는 어디에도 없다.
--
-- Meta 픽셀이 같은 단계를 이미 찍고 있지만 그 자료는 두 가지가 안 된다.
-- 마케팅 동의를 안 한 사람은 통째로 빠지고, 우리 주문·리딩과 조인이 안 된다.
-- 여기는 1차 자료다 — 우리 서버가 받아 우리 DB 에 적고 우리가 질의한다.
--
-- **개인정보는 넣지 않는다.** 단계의 이름은 남기고 단계에 적은 값은 남기지
-- 않는다. 생년월일·출생시간·성별·상대방 정보·고민 원문·사주 결과는 이 표에
-- 닿지 않는다. 서버가 허용 목록으로 한 번 더 거른다(events/route.ts).
--
-- session_id 는 sessionStorage 에 있다 — 탭을 닫으면 사라진다. 기기를 가로질러
-- 사람을 따라다니는 식별자가 아니다. 광고 쿠키가 아니라 접속 기록이고,
-- 개인정보처리방침 1조의 "이용 기록"이 이것이다.

create table if not exists public.lr_funnel_events (
  id bigint generated always as identity primary key,
  -- 한 탭에서의 방문. 익명이고 탭이 닫히면 끝난다.
  session_id uuid not null,
  -- 로그인한 뒤의 사건이면 채워진다. 그 앞의 사건은 비어 있다.
  user_id bigint references public.lr_users(id) on delete set null,
  -- 허용 목록 안의 이름만. 자유 문자열이 아니다.
  name text not null check (length(btrim(name)) > 0),
  -- 리딩 폼의 몇 번째 칸인가. 폼 사건에만 있다.
  step text,
  -- 경로만. 쿼리는 뺀다. 동적 구간은 [id] 로 접는다 — 안 접으면 리딩 하나가
  -- 각자 다른 페이지가 되어 "어느 페이지에서 나갔나"를 셀 수 없다.
  path text,
  product text,
  landing text,
  -- 이 화면에 머문 시간(ms). page_exit 에만 있다.
  dwell_ms integer check (dwell_ms is null or dwell_ms >= 0),
  -- 세션 안에서의 순서. 같은 밀리초에 둘이 들어와도 앞뒤가 정해진다.
  seq integer not null default 0 check (seq >= 0),
  -- 어느 광고가 데려왔는가. lr_orders 에 적는 것과 같은 모양.
  attribution jsonb,
  created_at timestamptz not null default now()
);

-- 한 사람의 발자국을 순서대로 따라가는 질의.
create index if not exists lr_funnel_events_session_idx
  on public.lr_funnel_events (session_id, seq);
-- 기간으로 자르는 질의.
create index if not exists lr_funnel_events_created_idx
  on public.lr_funnel_events (created_at desc);
-- 단계별 집계.
create index if not exists lr_funnel_events_name_idx
  on public.lr_funnel_events (name, created_at desc);

alter table public.lr_funnel_events enable row level security;
alter table public.lr_funnel_events force row level security;
revoke all on table public.lr_funnel_events from anon, authenticated;
