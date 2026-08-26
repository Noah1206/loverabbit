-- 관리자 승인용 패스키.
--
-- 지금 승인은 긴 키를 입력창에 붙여 넣어야 하고, 그 값은 sessionStorage 에만
-- 살아서 탭을 닫으면 사라진다. 입금은 아이폰으로 확인하는데 승인은 매번 키를
-- 다시 찾아 붙여야 했다 — 그래서 승인이 늦어졌고, 한 건은 사흘이 걸렸다.
--
-- 패스키는 기기의 생체 인증(아이폰 Face ID)에 묶인 공개키다. 비밀값이 브라우저에
-- 남지 않고, 훔쳐 갈 키 자체가 없다. 서버는 공개키만 들고 서명을 검증한다.
--
-- 기존 ADMIN_APPROVAL_KEY 는 그대로 살아 있다. 등록은 그 키로 하고, 아이폰을
-- 잃어버렸을 때 돌아올 길도 그 키다.

create table if not exists public.lr_admin_passkeys (
  -- 인증기가 준 credential id (base64url). 기기마다 다르다.
  credential_id text primary key,
  -- SPKI DER 를 base64 로. 브라우저의 getPublicKey() 가 이 꼴로 준다.
  public_key text not null,
  -- COSE 알고리즘 번호. -7 = ES256(대부분), -257 = RS256
  algorithm integer not null,
  -- 사람이 알아볼 이름. "아이폰" 처럼.
  label text,
  -- 인증기가 세는 사용 횟수. 뒤로 가면 복제를 의심한다.
  sign_count bigint not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.lr_admin_passkeys enable row level security;
alter table public.lr_admin_passkeys force row level security;

create policy lr_admin_passkeys_server_only on public.lr_admin_passkeys
  as restrictive for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.lr_admin_passkeys from anon, authenticated;
grant select, insert, update, delete on table public.lr_admin_passkeys to service_role;

comment on table public.lr_admin_passkeys is
  'WebAuthn credentials that let the operator approve payments with Face ID instead of pasting the admin key.';
