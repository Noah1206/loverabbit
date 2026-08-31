# 귀인 지도 — 구현 노트 (2026-08-30)

## 저장소 점검 결과

| 영역 | 확인된 것 | 귀인지도가 하는 일 |
|---|---|---|
| 프레임워크 | Next.js App Router (`src/app`), 클라이언트 페이지 + API 라우트 | 같은 구조로 `/guin` 페이지 2개 + `/api/guin` 라우트 추가 |
| DB | Supabase, 테이블 전부 `lr_` 접두사, RLS force + service_role 전용 (예: `20260830090000_question_credits.sql`) | `lr_guin_*` 3개 테이블, 같은 RLS 패턴 |
| 인증 | 소셜 로그인 → `lr_users`, 토큰은 `seal()`(AES-256-GCM, `src/lib/crypto.ts`) | 로그인 **강제하지 않음**. 소유권은 ownerKey(랜덤)로, 로그인 시 `owner_user_id` 연결 |
| 사주 계산 | `computeSaju`(자시·입춘 처리 포함, `src/lib/saju.ts`), `tenGodOf`·`HEAVENLY_COMBOS`·`BRANCH_CLASHES`·육합·삼합 (`src/lib/saju-facts.ts`), 음력 변환 `src/lib/lunar.ts` | **전부 재사용, 중복 구현 0.** 관계 계산은 이 프리미티브 조합만 |
| 분석 | 자체 퍼널: `trackFunnel`(`src/lib/funnel.ts`) → `/api/events` → `lr_funnel_events`. 서버가 이름 허용목록(`funnel-events.ts`)으로 거른다 | **별도 `guin_events` 테이블 안 만듦.** 허용목록에 `guin_*` 이름 추가, 같은 파이프라인 사용 |
| 공유 이미지 | `downloadShareImage`(canvas, `src/lib/share-image.ts`) | 같은 파일에 귀인지도 카드 변형 추가 |
| 스타일 | `globals.css` 클래스 + 토큰(`--bg`, `--accent`, `--gold` 등) | 기존 `.card`/`.btn`/`.badge` 재사용 |

## 명세와 다르게 한 결정 (이유와 함께)

1. **테이블 이름**: `guin_maps` → `lr_guin_maps` 등. 저장소 네이밍 규칙(전부 `lr_`)을 따른다 — 명세 7항이 "기존 네이밍 규칙에 맞춰"라고 허용.
2. **`guin_events` 테이블 없음**: 기존 `lr_funnel_events` 파이프라인이 세션·유저·attribution까지 이미 처리한다. 파이프가 둘이면 대시보드도 둘이 된다. 이벤트 이름만 허용목록에 추가.
   - 메타데이터 매핑: 역할 → `product` 칸, 지도 크기 버킷 → `landing` 칸. `score_bucket` 은 안 보낸다 — 점수는 `lr_guin_relationships` 에 있어 서버에서 조인하면 된다.
   - `guin_map_node_added` 는 따로 안 쏜다 — `guin_participant_submitted` 성공과 같은 사실이다.
3. **암호화**: 명세의 `*_ciphertext` 는 기존 `seal()/open()` 재사용. 새 키·새 방식 없음. 생년월일 평문은 DB·로그·URL·이벤트 어디에도 안 남는다.
4. **관계 계산은 모델 호출 없음**: 역할·강점·주의점·대화 질문은 역할별 템플릿 + 관계 사실(합·충)로 결정론적으로 만든다. 10항 금지 표현은 템플릿에 애초에 없고 테스트가 지킨다.
5. **참여 전 지도 숨김(3.5항)은 서버가 강제**: GET 이 ownerKey/participantKey 없으면 요약(주인 별명·인원·역할 분포)만 돌려준다. 화면 조건부가 아니라 응답 자체가 다르다.

## 계산 모델 (guin-1)

- 삼주(연·월·일) 중심. 시간은 입력돼도 관계 점수에 안 들어가고 개인 캐릭터 라벨에만 쓴다 (명세 6항).
- 역할 = 상대 일간이 내 일간에게 무슨 십성인가 (`tenGodOf`):
  - 정인·편인 → 귀인 / 정재·편재 → 오른팔 / 정관·편관 → 성장형 선생
  - 비견 → 거울형 / 겁재·상관 → 자극형 / 식신 → 안식처
- 점수 = 50 + 역할 기본치 + 일간 천간합(+12) + 일지 육합(+10)·삼합(+8)·충(−12) + 연지 육합(+4)·충(−4) + 오행 보완(상대 기둥이 내 일간을 생하는 오행 하나당 +2, 최대 +6). 5~99 로 clamp — 0/100 같은 절대값을 만들지 않는다.
- 방향성: A→B 와 B→A 는 다른 결과다. 지도에는 "주인에게 상대가 무엇인가"를 싣는다.

## 데이터 모델

`lr_guin_maps`(share_token unique, owner_key_hash, owner_birth_sealed, show_scores, status) /
`lr_guin_participants`(map_id FK, participant_key_hash, birth_sealed, idempotency_key — `unique(map_id, idempotency_key)` 로 더블클릭·새로고침 중복 차단) /
`lr_guin_relationships`(map_id+participant_id unique, score, role, result_json, calculation_version).

키는 저장 전 sha256. 원문 키는 만든 브라우저 localStorage 에만 산다
(`lr_guin_own`, `lr_guin_joined:<token>`).

## 미구현 / 수동 확인 필요

- 카카오톡 SDK 공유 버튼: Web Share API 가 모바일에서 카카오톡을 포함하므로 v1 은 그걸로 간다. SDK 직접 연동은 카카오 JS 키가 생기면.
- force layout 그래프: 20명+ 검색·필터 포함 원형 배치(SVG)로 시작. d3 등 의존성 추가 안 함.
- E2E(브라우저)·DB 통합 테스트: 운영 Supabase 없이 못 돈다. 수동 확인 절차를 이 문서 하단에 둔다.
- 지도 신고 기능: 삭제·나가기·비활성화까지 구현, 신고 접수는 기존 문의(/api/inquiry)로 안내.

## 수동 확인 절차 (배포 후)

1. `npm run db:push` 로 `20260831…_guin_map.sql` 적용
2. 시크릿 창 A: `/guin` → 지도 생성 → 링크 복사
3. 시크릿 창 B: 링크 열기 → **지도 노드가 안 보이고 참여 화면만 보이는지** → 별명+생일 입력 → 관계 카드 확인 → "나도 만들기"
4. 창 A 새로고침: 참여자 노드 추가 확인, 설정에서 점수 표시 끄기 → B 화면에서 점수 사라짐
5. B 에서 내 기록 삭제 → A 지도에서 노드 사라짐
6. Supabase `lr_funnel_events` 에서 `name like 'guin_%'` 확인

---

# v2 — 관계 축 알고리즘과 단계별 화면 (2026-08-31)

## 계산 모델 교체: guin-1 → guin-v2

- **역할이 십성이 아니라 관계 축에서 나온다.** 일간 오행의 생극 관계에서 feature 5개
  (sameElement·supportToOwner·practicalComplement·tension·polarityHarmony)를 뽑고,
  네 축(편안함·현실적 도움·대화·새로운 자극)을 지시문 8.4 수식 그대로 채점한다.
  역할 = 1위 축 (안식처형·오른팔형·대화형·성장형). 1·2위 차이가 5점 미만이면 보조 역할.
  케미 = 네 축 가중 평균(0.30/0.25/0.25/0.20).
- **guin-1 결과는 소급하지 않는다.** role check 에 옛 역할을 남기고, axes 없는 노드는
  비교·패턴 화면에서 제외된다. calculation_version 이 두 세대를 가른다.
- seasonalHarmony 는 아직 중립 0.60 고정 — 기존 엔진의 계절 강도(johu)를 잇는 건 P1.
- 시간 미상 무감점: 일간 오행·음양은 날짜만으로 확정되므로 축 계산에 시간이 아예 없다.

## 단계별 화면 (0/1/2/3+)

한 페이지(`/guin/[token]`) 안에서 단계로 자란다 — 라우트를 늘리지 않았다
(지시문 3항 "현재 라우팅 규칙이 있으면 그 규칙을 따른다").

- 0명: empty state + "첫 번째 인연까지 1명 남았어요"
- 1명: 관계 카드 (역할·케미·가장 강한 축·구간 표현·힌트·대화 질문)
- 2명: 축별 비교 탭 4개, 최고만 굵게 + 상대 점수 병기, guin_axis_comparison_viewed
- 3명+: 역할 분포 가로 막대(색+라벨 병기), 집단 해석, 축별 대표(동점=공동 1위),
  guin_pattern_report_viewed
- "가장 닮은 관계" 칩은 **"대화가 가장 강한 관계"로 대체** — 축이 4개로 고정돼
  닮음을 따로 계산하지 않는다. 데이터에 없는 라벨을 붙이지 않는 쪽을 골랐다.

## 공유 카피 A/B/C

- 배정: A 50% / B 25% / C 25%, localStorage 에 고정 (한 사람이 항상 같은 안).
- 공유 URL 에 `?v=A` 로 실려, 초대 랜딩이 같은 안의 카피를 보여준다.
- 계측: 관련 이벤트의 `product` 칸에 `copy-A` 형태로 남는다 → 카피별 퍼널 비교 가능.

## 중복 참여 (지시문 9·10항)

- 그물 둘: idempotency_key(같은 브라우저 재제출) + participant_fingerprint
  (HMAC(지도id:생년월일:별명), 다른 기기에서 같은 사람).
- **지문에 별명을 넣은 이유**: 생일만으로 접으면 생일이 같은 두 친구(쌍둥이)를 한
  사람으로 오인해 두 번째 참여를 막는다. 명세의 fingerprint 정의에서 의도적으로 벗어난 지점.
- 걸리면 새 행 없이 기존 관계를 돌려주고 참여 키를 갈아 끼운다 + "이미 참여한 기록이
  있어요" 안내.

## 참여자 → 자기 지도 전환

- 결과 카드의 "내 귀인 지도도 만들어보기" → 방금 입력값을 sessionStorage 에 담아
  `/guin?from=invite` 로 — 폼이 채워진 채 열리고 **동의는 새로 받는다**.
- 계측: guin_second_map_cta_clicked(클릭) → guin_second_map_created(완료).

## 이벤트 이름 매핑 (명세 14항 → 실제)

명세 이름과 다른 것만: owner_form_* → guin_form_*, invite_link_copied →
guin_share_link_copied, share_card_saved → guin_share_image_downloaded,
participant_form_submitted → guin_participant_submitted,
relationship_calculation_started 는 계산이 제출과 한 요청이라 따로 없음,
kakao_share_clicked 는 Web Share 로 합쳐짐(SDK 미연동).

---

# v3 — 5축·양방향·관계 상태·AI 리포트 (2026-08-31)

기록 위치가 바뀌었다: v3 의 저장소 검사·구현 파일·지시문과 다르게 한 결정은
`guin-map-architecture.md`, 부록 19(만세력 기준 구현) 대비 결정은
`saju-calculation-decision-log.md` 에 있다.
