-- 신당 대화 이력 — 서버가 정본이 된다.
--
-- 지금까지 대화는 localStorage 에만 있었다. 두 가지가 깨진다:
--   1. 답이 오는 중에 새로고침·이탈하면, 서버는 질문권을 깎고 답을 만들었는데
--      클라이언트가 못 받아 그 답이 허공에 사라진다. 돈 낸 질문이 증발한다.
--   2. 기기를 바꾸면 대화가 처음부터다.
--
-- 답이 만들어지는 순간 서버가 문답을 여기 남긴다. 클라이언트는 다시 열 때
-- 서버 이력을 받아 이어 본다.

create table if not exists public.lr_shrine_messages (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.lr_users(id) on delete cascade,
  character_id text not null check (length(btrim(character_id)) > 0),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists lr_shrine_messages_user_char_idx
  on public.lr_shrine_messages (user_id, character_id, created_at);

-- 서비스 키로만 접근한다. 다른 lr_* 표와 같은 규칙.
alter table public.lr_shrine_messages enable row level security;
alter table public.lr_shrine_messages force row level security;
revoke all on table public.lr_shrine_messages from anon, authenticated;
