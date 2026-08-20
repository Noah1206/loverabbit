-- 유료 본문을 결제 후에 만들기 위한 재개 정보.
--
-- 발급 때는 미리보기에 필요한 만큼만 만들고, 나머지는 결제가 확인된 뒤에 만든다.
-- 그러려면 "무엇을 이어서 만들어야 하는가"가 서버에 남아 있어야 한다.
-- 클라이언트 blob에만 두면 안 된다 — 계좌이체는 관리자 승인이 며칠 뒤에 나고,
-- 그때 사용자가 기기를 바꿨거나 브라우저 저장소를 비웠으면 blob이 사라진다.
--
-- lr_readings에 컬럼을 더하지 않고 별도 테이블로 둔다. 완성되면 행을 지우므로
-- 이 테이블에는 "아직 본문을 못 만든 리딩"만 남는다.

create table if not exists public.lr_reading_resume (
  reading_id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- 오래 남은 행 = 결제까지 가지 않은 리딩. 정리할 때 훑는다.
create index if not exists lr_reading_resume_created_at_idx
  on public.lr_reading_resume (created_at);

-- 명식 계산 결과와 사용자가 쓴 고민이 들어 있다. 서버(service_role)만 닿는다.
alter table public.lr_reading_resume enable row level security;
alter table public.lr_reading_resume force row level security;
revoke all on table public.lr_reading_resume from anon, authenticated;
