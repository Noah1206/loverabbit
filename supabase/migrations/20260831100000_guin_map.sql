-- 귀인 지도 (2026-08-31).
--
-- 친구가 참여해야 완성되는 관계 그래프. 지도 주인이 링크를 보내고, 친구가
-- 링크에서 **자기** 생년월일을 직접 넣으면 주인의 지도에 관계 노드가 생긴다.
--
-- 개인정보 원칙:
--   생년월일·출생시간은 seal()(AES-256-GCM) 로 잠가서만 저장한다. 평문은
--   DB·로그·URL·이벤트 어디에도 없다. 지도에 보이는 것은 별명·역할·점수뿐이다.
--
-- 소유권 원칙:
--   로그인 없이 만들 수 있어야 한다(게스트 모드). 그래서 소유권은 계정이 아니라
--   만들 때 발급한 무작위 키가 정본이다 — DB 에는 sha256 만 두고, 원문 키는
--   만든 브라우저의 localStorage 에만 산다. 로그인하면 owner_user_id 를 이어
--   붙여 기기를 옮겨도 찾을 수 있게 한다.

create table if not exists public.lr_guin_maps (
  id uuid primary key default gen_random_uuid(),
  -- 공유 주소에 실리는 값. 순번이면 남의 지도를 훑을 수 있어 무작위로 만든다.
  share_token text not null unique check (length(share_token) between 20 and 64),
  owner_key_hash text not null,
  owner_user_id bigint null references public.lr_users(id) on delete set null,
  owner_nickname text not null check (length(owner_nickname) between 1 and 20),
  owner_birth_sealed text not null,
  -- 점수 표시 여부 — 주인이 끄면 참여자 화면에서도 숨는다.
  show_scores boolean not null default true,
  -- disabled = 링크 잠금(참여·조회 차단), deleted = 소프트 삭제.
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lr_guin_participants (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.lr_guin_maps(id) on delete cascade,
  participant_key_hash text not null,
  participant_user_id bigint null references public.lr_users(id) on delete set null,
  nickname text not null check (length(nickname) between 1 and 20),
  birth_sealed text not null,
  -- 브라우저가 만든 무작위 키. 더블클릭·새로고침 재제출이 같은 키로 오므로
  -- 아래 unique 가 두 번째 줄을 막는다.
  idempotency_key text not null check (length(idempotency_key) between 8 and 64),
  consented_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  unique (map_id, idempotency_key)
);

create index if not exists lr_guin_participants_map_idx
  on public.lr_guin_participants (map_id, created_at);

create table if not exists public.lr_guin_relationships (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.lr_guin_maps(id) on delete cascade,
  participant_id uuid not null references public.lr_guin_participants(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  role text not null check (role in (
    'benefactor', 'right_hand', 'growth_teacher', 'mirror', 'stimulator', 'comforter', 'neutral'
  )),
  -- 강점·주의점·대화 질문 등 화면에 그대로 나가는 전부. 여기 없는 것은 안 나간다.
  result_json jsonb not null,
  -- 배합을 고치면 버전을 올린다. 옛 지도의 점수를 소급해 바꾸지 않기 위한 표식.
  calculation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (map_id, participant_id)
);

-- 서버(service_role)만 만진다 — 다른 lr_ 테이블과 같은 규칙.
do $$
declare v_table text;
begin
  foreach v_table in array array['lr_guin_maps', 'lr_guin_participants', 'lr_guin_relationships'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      v_table || '_server_only', v_table
    );
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end $$;

comment on table public.lr_guin_maps is 'Guin (benefactor) relationship maps. Birth data sealed, ownership via hashed random key.';
