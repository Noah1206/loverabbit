-- 주인이 대신 넣은 참여자 (2026-09-08)
--
-- 초대 링크만으로는 지도가 채워지지 않았다 — 지도 6개에 참여자 0명이었다.
-- 그래서 주인이 친구의 생일을 대신 넣는 길을 열었다. 그 행은 **본인 동의 없이**
-- 들어온 것이라 같은 표에 섞어 두면 구분할 수 없다.
--
-- true 인 행은 화면에서 임시(점선)로 그린다. 그 친구가 나중에 초대 링크로 직접
-- 들어오면 false 로 바뀌며 정식 참여로 승격된다.
alter table public.lr_guin_participants
  add column if not exists added_by_owner boolean not null default false;

comment on column public.lr_guin_participants.added_by_owner is
  '주인이 대신 넣은 사람. 본인 동의 없이 들어온 행이라 화면이 임시로 표시하고, 본인이 직접 들어오면 false 로 승격된다.';
