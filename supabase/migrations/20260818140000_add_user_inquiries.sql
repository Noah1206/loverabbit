-- 사용자 문의함 — 앱 하단의 원버튼에서 들어오고, 관리자 화면에서만 읽는다.
-- 다른 lr_* 테이블과 같이 브라우저는 직접 접근하지 못하고 서버 키로만 다룬다.

create table if not exists public.lr_inquiries (
  id bigint generated always as identity primary key,
  user_id bigint references public.lr_users(id) on delete set null,
  email text,
  category text not null default 'etc'
    check (category in ('payment', 'reading', 'chat', 'account', 'bug', 'etc')),
  message text not null,
  page_path text,
  status text not null default 'open' check (status in ('open', 'done')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lr_inquiries_message_length check (char_length(btrim(message)) between 5 and 2000),
  constraint lr_inquiries_reachable check (user_id is not null or email is not null)
);

-- 관리자 화면은 미처리 건을 위로, 최신순으로 읽는다.
create index if not exists lr_inquiries_status_created_idx
  on public.lr_inquiries (status, created_at desc);

-- 같은 사람이 짧은 시간에 여러 번 보내는지 확인할 때 쓴다.
create index if not exists lr_inquiries_user_created_idx
  on public.lr_inquiries (user_id, created_at desc);

alter table public.lr_inquiries enable row level security;

create policy lr_inquiries_server_only on public.lr_inquiries
  as restrictive for all to anon, authenticated
  using (false) with check (false);

comment on table public.lr_inquiries
  is 'User-submitted inquiries from the in-app contact button. Server-key access only.';
