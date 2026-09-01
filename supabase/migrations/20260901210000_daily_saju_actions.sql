-- 오늘의 사주 액션 — 완료 기록.
--
-- 두 가지만 한다: (1) 오늘 것을 완료했는지, (2) 최근 며칠 어느 영역이 나갔는지.
-- 행동 문구 자체는 저장하지 않는다 — 생년월일과 날짜에서 결정론적으로 다시
-- 나오므로(daily-action.ts) 여기 복사해 두면 두 개의 진실이 생긴다.

create table if not exists public.lr_daily_actions (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users(id) on delete cascade,
  -- Asia/Seoul 기준의 그 날. 서버 지역과 무관하게 앱이 계산해 넣는다.
  action_date date not null,
  domain text not null,
  -- daily-action.ts 가 만든 id ("2026-09-01:money:재성"). 같은 날 같은 영역이면
  -- 같은 값이라, 나중에 어떤 행동이었는지 되짚을 수 있다.
  action_id text not null,
  completed_at timestamptz not null default now(),
  note text,
  -- 하루에 한 영역은 한 번만. 더블탭·새로고침 재제출이 여기서 걸린다.
  unique (user_id, action_date, domain)
);

alter table public.lr_daily_actions
  add constraint lr_daily_actions_domain_check
    check (domain in (
      'love', 'money', 'study', 'career',
      'business', 'relationship', 'health', 'growth'
    ));

-- "최근 3일 안에 어느 영역이 나갔나" 가 유일한 조회 형태다.
create index if not exists lr_daily_actions_user_date_idx
  on public.lr_daily_actions (user_id, action_date desc);

alter table public.lr_daily_actions enable row level security;

-- 앱은 service_role 로만 붙는다 (supabase-admin.ts). anon/authenticated 에게는
-- 정책을 열지 않는다 — 열어 두면 토큰 검증을 거치지 않는 두 번째 길이 생긴다.
revoke all on public.lr_daily_actions from public, anon, authenticated;
grant select, insert, delete on public.lr_daily_actions to service_role;

comment on table public.lr_daily_actions is
  'Completion log for the daily saju action. Copy of the wording is deliberately absent — it is derived.';
