# Meta 전환 퍼널 v1 — 구현 기록과 광고 초안 명세

브랜치: `feat/meta-conversion-funnel-v1`
작성일: 2026-08-19

원본 지시문의 랜딩 URL은 경쟁사(foxbunny.io)였다. 남의 도메인은 수정할 수 없으므로
**퍼널 구조만 참고해 러브레빗 자사 사이트에 구현**했다. 상품 매핑은 아래와 같다.

| 지시문 랜딩 | 러브레빗 라우트 | 연결 상품 | 가격 |
|---|---|---|---|
| 이별결정 (`breakup_decision`) | `/saju/breakup-decision` | `ibyeol` 이별 부검 리포트 | 29,900원 |
| 속마음 (`inner_mind`) | `/saju/inner-mind` | `sseom` 썸 해부 사주 | 12,900원 |

`inner_mind`는 폭스바니의 '심안(속마음)'에 1:1 대응하는 상품이 없어 **상대 심리 추적** 티어에서
가장 가까운 `sseom`으로 붙였다. 다른 상품이 맞다면 `src/lib/meta-events.ts`의
`LANDING_BY_PRODUCT` 한 줄만 고치면 된다.

---

## 1. 구현된 것

### 이벤트 (`src/lib/meta-events.ts`)

| 이벤트 | 발화 지점 | 파라미터 |
|---|---|---|
| `PageView` | 모든 화면 (SPA 라우팅 포함) | 없음 |
| `ViewContent` | 두 랜딩 진입 | `content_name` |
| `PreviewStarted` | 랜딩 CTA 클릭 | `landing_type` |
| `CompleteRegistration` | `auth/complete` 로그인 완료 | `method` (제공자명만) |
| `SajuFormCompleted` | `/reading` 제출 → 생성 시작 | `landing_type` |
| `PreviewGenerated` | `/reading/generating` 생성 완료 | `landing_type` |
| `ResultUnlockClicked` | `/reading/[id]` 잠금 해제 CTA | `landing_type` |
| `InitiateCheckout` | 결제 모달 진입 | `value`, `currency`, `landing_type` |
| `Purchase` | 결제 승인 성공 | `value`, `currency`, `transaction_id`, `event_id` |

`SajuFormStarted`는 헬퍼에 함수만 두고 아직 호출부를 붙이지 않았다. 첫 입력 시점을 어디로
볼지(카테고리 선택 / 첫 글자 입력) 정해지면 `/reading` 폼에 한 줄 추가하면 된다.

`landing_type`은 광고 랜딩과 연결된 상품(`ibyeol`, `sseom`)일 때만 붙는다. 자연 유입 리딩은
커스텀 이벤트를 발송하지 않아 광고 데이터가 오염되지 않는다.

### 중복 제거
`Purchase`는 클라이언트 Pixel과 서버 CAPI(`/api/meta/capi`)가 **같은 `event_id`**로 각각 한 번씩
보낸다. Pixel이 차단된 브라우저에서도 전환이 남는다.

### 개인정보 보호
- 광고로 나가는 값은 금액·통화·주문번호·`landing_type`·로그인 제공자명뿐이다.
- 생년월일·출생시간·출생지·성별·상대방 정보·관계 상황 원문·사주 결과·결제수단은 전송하지 않는다.
  CAPI 라우트는 화이트리스트 밖 필드를 요청에서 받아도 버린다.
- 속마음 랜딩의 상황 선택값은 `sessionStorage`에만 남고 URL·이벤트에 들어가지 않는다.
- 쿠키 동의 전에는 Pixel `<script>` 자체가 주입되지 않는다.

### 신규 화면
- `/saju/breakup-decision` — 지시문 카피 그대로. 히어로 CTA + 하단 고정 CTA + 결과물 카드 4종.
- `/saju/inner-mind` — 도입 연출 → 상황 선택 → 미리보기. 자동재생 오디오 없음, 스킵 버튼이
  같은 설문에 도달. 접근성용 `h1` 유지.
- `/privacy` — 개인정보처리방침. **사업자 정보·연락처는 운영자가 채워야 한다.**

### 검증 완료
- `npx tsc --noEmit` 통과, `npm run build` 통과.
- 동의 전: `fbq` 미정의, Pixel 스크립트 미주입, 배너 노출 확인.
- 동의 후: 배너 사라짐. Pixel ID 미설정이라 스크립트는 여전히 미주입(의도된 동작).
- CAPI 미설정 시 `{"skipped":"not_configured"}` 200 반환 — 결제 플로우를 막지 않음.
- 375px / 768px 가로 오버플로 없음.

---

## 2. 광고 초안 — 아직 만들지 못한 이유

Ads Manager 접근은 확인했다(`act=1501156981218798`, 활성 캠페인 2개).
그러나 두 캠페인 모두 목표가 **Sales / 전환 위치 Website**라 **Pixel(Dataset)이 반드시 필요한데,
현재 이 광고 계정에 연결된 Pixel이 코드에도 환경변수에도 없다.**

지시문의 "새 Pixel을 임의 생성하지 않는다" 제약에 따라 Pixel 생성은 하지 않았다.
아래 순서로 사람이 한 번만 처리하면 광고 초안 생성으로 넘어갈 수 있다.

1. Events Manager → 데이터 소스 → Pixel 생성 (또는 기존 Pixel ID 확인)
2. Vercel 환경변수에 `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` 입력
3. 이 브랜치 배포 후 Events Manager 테스트 이벤트로 퍼널 발화 확인
4. 그 다음에 아래 초안 스펙대로 캠페인 생성

> **경고:** 현재 활성 캠페인 2개가 전환 이벤트 없이 구매 목표로 집행 중이다.
> 최적화 신호가 없는 상태라 예산이 학습 없이 소모된다. Pixel 연결을 최우선으로 볼 것.

### 2-A. 초안 캠페인 1 — 이별결정 신규 획득

| 항목 | 값 |
|---|---|
| 캠페인 | `KR_WEB_SALES_BREAKUP_V1_DRAFT` / Auction / Sales / Website |
| 광고세트 | `COLD_BROAD_KR_20_44_ALL_V1_DRAFT` |
| 전환 이벤트 | `PreviewGenerated` (최근 14일 Purchase 50건 이상이면 `Purchase`로 교체) |
| 타겟 | 대한민국 / 20–44세 / 전체 성별 / 언어 미설정 / broad |
| 제외 | Purchase 180일 (해당 Custom Audience가 있을 때만) |
| 일일 예산 | ₩35,000 (초안값 — 운영자 승인 필요) |
| 게재 일정 | 설정하지 않음 |
| 게재 위치 | Advantage+ Placements |

광고 `BRK_STATIC_DECISION_01_DRAFT`
- 최종 URL: `https://www.loverebbit.xyz/saju/breakup-decision`
- 헤드라인: `관계의 갈림길, 판단 기준을 정리해 보세요`
- 기본 문구: `두 사람의 사주 흐름과 관계 질문을 바탕으로, 관계를 이어갈지 정리할지 생각해 볼 기준을 리포트로 정리합니다. 무료 미리보기로 먼저 확인해 보세요.`
- 설명: `무료 관계 판정 미리보기` / CTA: `Learn More`
- 크리에이티브: `이별결정_정적_1080x1350_v1` — **자산 없음, 제작 필요**

광고 `BRK_VIDEO_DECISION_02_DRAFT`
- 문구·URL 동일. 크리에이티브 `이별결정_릴스_1080x1920_10초_v1` — **자산 없음**
- 사양: 9:16 / 1080x1920 / 8–12초 / 첫 2초에 '관계의 갈림길'과 '무료 미리보기'가 읽힐 것

### 2-B. 초안 캠페인 2 — 고의도 리타게팅

| 항목 | 값 |
|---|---|
| 캠페인 | `KR_WEB_SALES_RETARGETING_V1_DRAFT` / Auction / Sales / Website |
| 광고세트 | `RT_PREVIEW_30D_NO_PURCHASE_V1_DRAFT` |
| 전환 이벤트 | `Purchase` |
| 일일 예산 | ₩15,000 (초안값) |

대상 (Custom Audience 3종을 합쳐 하나의 세트로):
1. `PreviewGenerated` 또는 `SajuFormCompleted` 30일
2. `InitiateCheckout` 30일
3. 두 랜딩 방문자 14일

제외: Purchase 180일.
**세 대상 모두 이벤트가 쌓이기 전에는 만들 수 없다.** Pixel 연결 후 최소 며칠 데이터가 필요하다.

광고 `RT_BREAKUP_UNLOCK_01_DRAFT`
- URL: `https://www.loverebbit.xyz/saju/breakup-decision`
- 헤드라인: `무료 미리보기에서 확인한 관계 흐름, 이어서 정리해 보세요`
- 기본 문구: `전체 리포트에서는 관계의 반복 원인과 다음 대화의 기준을 더 자세히 확인할 수 있습니다.`
- 크리에이티브: `이별결정_리타게팅_1080x1350_v1` — **자산 없음**

광고 `RT_INNER_MIND_UNLOCK_02_DRAFT`
- URL: `https://www.loverebbit.xyz/saju/inner-mind`
- 헤드라인: `속마음 미리보기에서 멈춘 해석을 이어서 확인해 보세요`
- 기본 문구: `전체 리포트에서 관계 흐름과 질문 가이드를 더 자세히 확인할 수 있습니다.`
- 크리에이티브: `속마음_리타게팅_1080x1920_v1` — **자산 없음**

---

## 3. 사람이 처리해야 하는 것

| # | 항목 | 이유 |
|---|---|---|
| 1 | Pixel 생성 + 환경변수 3개 입력 | 광고 초안 생성의 전제. 현재 전환 추적이 전무 |
| 2 | 활성 캠페인 2개 점검 | 전환 이벤트 없이 구매 목표로 집행 중 |
| 3 | `/privacy` 사업자 정보·연락처 | 법정 기재사항이 비어 있음 |
| 4 | 크리에이티브 4종 제작 | 자산 라이브러리에 없음 |
| 5 | 예산 승인 (₩35,000 / ₩15,000) | 초안값일 뿐, 목표 CAC 기준 재산정 필요 |
| 6 | `inner_mind` 상품 매핑 확정 | `sseom`이 맞는지 확인 |
| 7 | 프로덕션 배포 | 이 브랜치는 미배포 상태 |
