-- 카카오 로그인 사용자의 카카오 토큰.
--
-- 입금이 승인되는 시각은 결제 요청보다 몇 시간 뒤라, 그때 손님은 화면 앞에 없다.
-- 알릴 길이 없어서 승인된 리딩 18건 중 3건은 한 번도 열리지 않았다 (2026-08-27).
--
-- 카카오 로그인에 "카카오톡 메시지 전송"(talk_message) 동의를 받으면 그 사람의
-- '나와의 채팅'에 우리가 메시지를 보낼 수 있다. 그러려면 로그인 때 받은 카카오
-- 토큰을 서버가 들고 있어야 한다 — Supabase 는 교환 직후 한 번만 내주고 저장하지
-- 않는다.
--
-- 토큰은 곧 그 사람의 카카오 권한이다. 서버(service_role)만 읽고 쓴다.

create table if not exists public.lr_kakao_tokens (
  -- Supabase auth 사용자 id. lr_users.auth_user_id 와 같은 값.
  auth_user_id uuid primary key,
  access_token text not null,
  refresh_token text,
  -- access 만료 예상 시각. 지나면 refresh 로 새로 받는다.
  access_expires_at timestamptz not null,
  -- refresh 만료 예상 시각(카카오 기본 2개월). 지나면 다시 로그인해야 한다.
  refresh_expires_at timestamptz,
  -- 로그인 때 받은 동의 항목. talk_message 가 없으면 보낼 수 없다.
  scopes text,
  -- 마지막 발송 실패 이유. 동의 철회·토큰 만료를 여기서 본다.
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lr_kakao_tokens enable row level security;
alter table public.lr_kakao_tokens force row level security;

create policy lr_kakao_tokens_server_only on public.lr_kakao_tokens
  as restrictive for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.lr_kakao_tokens from anon, authenticated;
grant select, insert, update, delete on table public.lr_kakao_tokens to service_role;

comment on table public.lr_kakao_tokens is
  'Kakao OAuth tokens kept so the server can message a customer (talk_message) when their deposit is approved.';
