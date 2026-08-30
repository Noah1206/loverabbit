-- 귀인 지도 v2 — 관계 축과 중복 참여 방지 (2026-08-31).
--
-- guin-1(십성 역할)에서 guin-v2(관계 축 4개)로 계산이 바뀐다. 이미 저장된
-- guin-1 결과는 소급해 다시 계산하지 않는다 — calculation_version 이 그걸
-- 위해 있다. 그래서 옛 역할 값도 check 에 그대로 남긴다.

-- 1. 역할에 '대화형(communicator)' 이 추가된다. 옛 값(guin-1)도 유효해야 한다.
alter table public.lr_guin_relationships
  drop constraint if exists lr_guin_relationships_role_check;
alter table public.lr_guin_relationships
  add constraint lr_guin_relationships_role_check check (role in (
    -- guin-v2
    'comforter', 'right_hand', 'communicator', 'growth_teacher',
    -- guin-1 (소급 변경 안 함)
    'benefactor', 'mirror', 'stimulator', 'neutral'
  ));

-- 2. 축 점수와 보조 역할. guin-1 행에는 없으므로 null 허용 —
--    비교·패턴 화면은 축이 있는 행만 쓴다.
alter table public.lr_guin_relationships
  add column if not exists axes_json jsonb null,
  add column if not exists secondary_role text null;

-- 3. 같은 사람의 중복 참여 방지.
--
-- idempotency_key 는 같은 브라우저의 재제출만 잡는다. 같은 사람이 링크를
-- 다시 받아 새 탭·새 기기에서 또 넣으면 노드가 둘이 된다. 그래서 서버 비밀로
-- HMAC 한 지문(지도id:생년월일:별명)을 두 번째 그물로 친다.
--
-- 생년월일만으로 지문을 만들지 않는다 — 생일이 같은 두 친구(쌍둥이 포함)가
-- 실제로 있고, 그 둘을 한 사람으로 접으면 두 번째 친구가 참여를 못 한다.
-- 별명까지 넣으면 "같은 사람이 같은 이름으로 다시 넣은" 경우만 접힌다.
alter table public.lr_guin_participants
  add column if not exists participant_fingerprint text null;
create unique index if not exists lr_guin_participants_fingerprint_once
  on public.lr_guin_participants (map_id, participant_fingerprint)
  where participant_fingerprint is not null;

comment on column public.lr_guin_relationships.axes_json is
  'guin-v2 axis scores {comfort, practicalHelp, communication, stimulation}, 0..100. Null for guin-1 rows.';
