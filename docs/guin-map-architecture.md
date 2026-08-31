# 귀인 지도 v3 — 아키텍처와 결정 기록 (2026-08-31)

v1(guin-1, 십성 역할)·v2(관계 축 4개) 기록은 `guin-map-implementation-notes.md`.
이 문서는 v3 지시문("귀인지도 고도화") 기준의 저장소 검사 결과, 실제 구현,
그리고 지시문과 다르게 한 결정을 담는다.

## 저장소 검사 결과

| 영역 | 확인된 것 | v3 가 하는 일 |
|---|---|---|
| 프레임워크 | Next.js 15 App Router + React 19, 클라이언트 페이지 + API 라우트 | 기존 `/guin/[token]` 페이지·라우트 확장. 새 라우트 0개 |
| DB | Supabase, `lr_` 접두사, RLS force + service_role 전용 | `lr_guin_relationships` 에 열 5개 추가 (migration 1개) |
| 사주 계산 | `computeSaju`(자시·입춘 처리), 오행 생극 표 `saju-facts.ts`, 음력 `lunar.ts` | **전부 재사용. 부록 19 의 만세력 코드는 한 줄도 안 씀** (부록 자신이 그렇게 지시) |
| AI | `chatComplete`(`src/lib/ai.ts`) — Anthropic→Gemini→OpenAI 우선순위, jsonSchema 지원 | 관계 리포트 생성에 그대로 사용. 서버에서만 호출, 실패 = 템플릿 폴백 |
| 암호화 | `seal()/open()` AES-256-GCM (`crypto.ts`) | 관계 상태 자유입력 봉인에 재사용 |
| 분석 | `trackFunnel` → `lr_funnel_events`, 서버 허용목록 | 이벤트 이름 4개 추가, 파이프라인 재사용 |
| 기존 귀인지도 | v2 완성 상태: 4축·단계별 화면(0/1/2/3+)·중복 참여 방지·공유 A/B/C | 아래 4가지만 새로 얹음 |

## v3 에서 새로 얹은 것

1. **갈등 회복력 축** (5번째 축). feature 에 `communicationProxy`(지시문 19.11)가
   생기고, 케미가 5축 가중 평균(0.24/0.20/0.22/0.16/0.18)이 된다.
   `GUIN_CALC_VERSION = "guin-v3"`. 역할은 여전히 4축에서만 나온다 —
   "회복형" 역할은 관계를 갈등 전제로 읽게 해서 만들지 않았다.
2. **양방향 분석**. 참여 시 `relate(주인→참여자)` 와 `relate(참여자→주인)` 를
   **각각** 계산해 `result_json`/`reverse_json` 에 저장. 화면에는 방향이 제목으로
   명시된다 ("OOO님에게 나는" / "나에게 OOO님은").
3. **실제 관계 상태**. 참여자가 자기 관계에만 상태(썸·갈등 중 …)를 붙인다
   (`PATCH /api/guin/[token]/participants/[id]`). 상태는 축 점수를 **절대**
   바꾸지 않고 AI 해석의 초점만 바꾼다.
4. **AI 관계 리포트** (`src/lib/guin-report.ts`). 서버가 계산한 축·역할·상태만
   입력으로 받아 JSON 을 만들고, 스키마 검증(필드·길이) + 금지어 검사를 통과한
   것만 저장한다. 실패의 모든 경로가 null 하나로 접히고, 화면의 결정론 템플릿
   카드가 곧 폴백이라 별도 폴백 생성이 없다.

## 실제 적용된 파일

```
supabase/migrations/20260831190000_guin_v3.sql   reverse_json·context_status·context_note_sealed·ai_report_json·ai_report_version
src/lib/guin-map.ts        GUIN_ALL_AXES(5축)·axisKeysOf·GUIN_STATUSES·GuinAiReport·shapeMapView 역방향 점수 숨김
src/lib/guin-calc.ts       communicationProxy·conflictRecovery·5축 케미·버전 guin-v3
src/lib/guin-report.ts     (신규) 상태→해석 지시 표·프롬프트·응답 검증·생성
src/lib/guin-db.ts         양방향 저장·setGuinRelationshipContext(상태+AI 리포트 저장)
src/app/api/guin/[token]/participants/[id]/route.ts   PATCH 추가 (본인 키만, PII 필터)
src/app/guin/[token]/page.tsx   역방향 카드·상태 칩·AI 리포트 카드·5축 비교/패턴·강한 축/탐색 축 요약
src/lib/funnel-events.ts   guin_bidirectional_viewed·guin_context_status_selected·guin_ai_report_generated·guin_ai_report_fallback
tests/guin-calc.test.ts    5축 범위·방향 비대칭·회복력 방향·v2 케미 소급 불변
tests/guin-map.test.ts     역방향 점수 숨김
tests/guin-report.test.ts  (신규) 지시 표·프롬프트 무 PII·스키마/길이/금지어 검증
```

## 지시문과 다르게 한 결정 (이유와 함께)

1. **`guin_relationship_contexts` 테이블 없음** — 관계 행이 이미
   `unique(map_id, participant_id)` 로 1:1 이라 열로 두는 게 조인 하나가 준다.
   삭제도 관계 행과 같이 사라져 별도 정리 코드가 필요 없다.
2. **`guin_ecosystem_reports` 테이블·생태계 AI(§10) 미구현** — 3명+ 화면의
   분포·축 평균·강한 축/탐색 축·축별 대표는 노드에서 결정론으로 계산되고,
   그 문구가 이미 화면을 채운다. 생태계 AI 는 참여자당이 아니라 조회당 비용이라
   캐시 테이블부터 필요해지는데, 지금 단계 가치가 비용을 못 넘는다. 필요해지면
   관계 리포트와 같은 패턴(생성→검증→저장)으로 붙인다.
3. **클러스터(§6.4) 별도 구현 없음** — 지시문의 클러스터 키(1위 축)가 역할의
   정의와 동일하다. 역할 분포 막대가 곧 클러스터 화면이다. 같은 데이터에 다른
   이름을 붙인 화면을 하나 더 만들지 않았다.
4. **compare·ecosystem 별도 API 없음** — v2 패턴 유지: 지도 GET 하나가 파생
   점수만 실어 보내고 비교·패턴은 클라이언트가 그린다. 서버 응답에는 여전히
   생년월일·원국이 없다.
5. **AI 리포트에 `evidence` 필드 없음** — AI 가 근거를 새로 쓰게 하면 입력 밖
   사실이 생기는 통로가 된다. 결정론 근거(역할·구간·강점)는 템플릿 카드에 이미
   있다. `disclaimer` 도 모델 문구 대신 서비스 표준 문구로 덮는다.
6. **4축 수식은 v2 그대로** — 지시문 19.11 수식으로 갈아타면 오늘 나간 지도의
   숫자 감각과 어긋난다. 새로 생기는 것(communicationProxy·갈등 회복력·5축
   케미)만 19.11 을 따랐고, 버전을 guin-v3 로 올려 두 세대를 갈랐다.
   옛(v2) 축이 다시 케미 계산을 타면 4축 배합으로 떨어진다 — 소급 불변.
7. **상태 목록에서 `partner` 제외** — 지시문 8.1 의 UI 칩 목록과 타입을 1:1 로
   맞췄다 (칩에 연인은 하나다).
8. **상태 PATCH 에 Idempotency-Key 없음** — 같은 입력이면 같은 상태로 수렴하는
   자연 멱등 연산이다. 참여(행 생성)와 달리 중복 행이 생길 수 없다.
9. **상태 입력 주체는 참여자 본인만** — 주인이 남의 관계 상태를 대신 정하는
   길을 열지 않았다 (participantKey 검증).

## 테스트·검증

```
node --conditions=react-server --import tsx --test tests/*.test.ts
→ 746 pass / 0 fail (guin 관련 55개 포함)

npm run build → 성공
```

참여 직후 화면은 **단계형 공개**다 — 새로 나타나는 것이 항상 하나가 되게:
① 내 역할 카드만 → "반대 방향 보기" ② 역방향 카드 → "지금 우리 관계 알려주기"
③ 상태 칩(건너뛰기 가능) → AI 리포트 → 다음 행동 버튼 + 지도 섹션 공개.
돌아온 참여자와 주인은 이미 본 사람이라 전부 펼친 채로 나온다.
`guin_bidirectional_viewed` 는 역방향이 실제로 화면에 보인 순간 찍힌다.

수동 확인 (배포 후):
1. `npm run db:push` 로 `20260831190000_guin_v3.sql` 적용
2. 참여 → 위 단계가 한 걸음씩 열리는지, 방향 제목이 맞는지
3. 상태 칩 선택 → "정리하고 있어요" → AI 리포트 카드 (키 없으면 템플릿 유지 + `guin_ai_report_fallback` 이벤트)
4. 주인 화면에서 점수 표시 off → 참여자 화면에서 정·역방향 점수 모두 숨는지
5. v2 노드(어제까지 참여)와 v3 노드가 섞인 지도에서 비교 탭에 4축만 뜨는지

환경변수: AI 리포트는 `ANTHROPIC_API_KEY`(또는 GEMINI/OPENAI) 중 하나가 서버에
있어야 생성된다. 없으면 조용히 템플릿 폴백 — 기능이 죽지 않는다.
`AI_PROVIDER=claude-code` 는 서버리스에서 오류가 아니라 폴백으로 처리된다
(generateGuinAiReport 가 모든 실패를 null 로 접는다).
