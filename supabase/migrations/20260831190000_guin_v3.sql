-- 귀인 지도 v3 — 양방향 결과·관계 상태·AI 리포트 (2026-08-31).
--
-- guin-v2 → guin-v3: 갈등 회복력 축이 늘고(축 5개), 관계가 양방향으로 저장되며,
-- 참여자가 고른 실제 관계 상태와 검증된 AI 리포트가 관계 행에 붙는다.
-- 관계 행과 1:1(unique(map_id, participant_id))이라 별도 context 테이블을
-- 만들지 않고 열로 둔다 — 조인 하나가 준다.
--
-- 옛(guin-1/v2) 행은 소급 계산하지 않는다. 새 열은 전부 null 허용이고,
-- 화면은 값이 있는 행에서만 새 기능을 켠다.

alter table public.lr_guin_relationships
  -- 역방향(참여자에게 주인은 무엇인가). relate 를 두 번 돌린 별도 결과다.
  add column if not exists reverse_json jsonb null,
  -- 참여자가 고른 실제 관계 상태. 축 점수에는 관여하지 않는다 — AI 해석 문맥 전용.
  add column if not exists context_status text null,
  -- 참여자의 선택 자유입력 — seal()(AES-256-GCM) 봉인. 평문은 DB 에 없다.
  add column if not exists context_note_sealed text null,
  -- 검증(스키마·금지어)을 통과한 AI 리포트만 저장. 실패하면 null = 템플릿 폴백.
  add column if not exists ai_report_json jsonb null,
  add column if not exists ai_report_version text null;

alter table public.lr_guin_relationships
  drop constraint if exists lr_guin_relationships_context_status_check;
alter table public.lr_guin_relationships
  add constraint lr_guin_relationships_context_status_check check (
    context_status is null or context_status in (
      'crush', 'dating', 'conflict', 'no_contact', 'reunion',
      'friend', 'family', 'coworker', 'unclear'
    )
  );

comment on column public.lr_guin_relationships.reverse_json is
  'guin-v3 reverse direction (what the owner is to the participant). Null for older rows.';
comment on column public.lr_guin_relationships.context_status is
  'Self-reported relationship status. Interpretation context only — never feeds axis scores.';
