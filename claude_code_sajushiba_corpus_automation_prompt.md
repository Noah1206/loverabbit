# Claude Code 실행 스크립트: 사주시바 허가 코퍼스 기반 러브레빗 Threads 자동화

> 아래 전체 블록을 Claude Code에 붙여 넣으세요. 함께 제공되는 파일은 다음 두 개입니다.
>
> - `sajushiba_authorized_threads_corpus_v1.jsonl`
> - `sajushiba_authorized_pattern_library_v1.json`
>
> Claude Code가 원문을 다시 Threads에서 수집할 필요가 없도록, 두 파일을 프로젝트 루트에 먼저 넣은 뒤 실행하세요.

```text
# 최우선 명령

프로젝트 루트에 다음 두 파일이 존재한다.

1. `sajushiba_authorized_threads_corpus_v1.jsonl`
2. `sajushiba_authorized_pattern_library_v1.json`

이 두 파일은 사주시바 측의 명시적 허락 아래 러브레빗 콘텐츠에 직접 벤치마킹·재사용할 수 있도록 준비된 원문 코퍼스와 패턴 라이브러리다.

이 작업에서는 사주시바 원문을 일반화하거나 문체를 희석하지 마라. 허가된 코퍼스의 소재, 훅, 문장 리듬, 줄바꿈, 반말, 순위·점수·희소성, 명리 용어의 현실 번역, CTA 전개를 **러브레빗 Threads의 직접적인 스타일 기준**으로 사용하라.

단, 사주시바 코퍼스는 ‘글의 스타일과 소재 운영’을 정하고, 러브레빗의 명리 엔진은 ‘명리 사실·점수·순위·날짜’를 정한다. 스타일을 맞추기 위해 계산 사실을 지어내지 마라.

# 목표

러브레빗에 아래 6단계 파이프라인을 구현하라.

```text
[허가 원문 코퍼스]
  → [스타일/패턴 선택]
  → [러브레빗 명리 엔진의 승인 입력]
  → [GPT API 또는 설정된 LLM의 초안 생성]
  → [결정론적 가드 + LLM 톤 검수]
  → [승인 대기열]
  → [선택적으로 예약 게시]
```

기본 모드는 반드시 `DRAFT_ONLY`다. 실제 Threads 게시, OAuth 권한 요청, 토큰 저장, 예약 발행은 **이번 작업에서 구현 가능한 인터페이스·상태까지만** 만들고, 환경변수 `THREADS_PUBLISH_MODE=approved_manual`이 아닌 한 외부 게시 요청을 하지 마라.

# A. 소스 파일 검증과 프로젝트 배치

1. 두 입력 파일이 존재하는지 확인한다.
2. JSONL의 모든 행을 파싱하고 `post_id`, `body`, `permission_scope`, `source_method`, `extraction_status`가 있는지 검사한다.
3. 패턴 라이브러리의 모든 `source_post_ids`가 코퍼스에 존재하는지 검사한다.
4. 실패한 행을 무시하지 말고 `docs/content/sajushiba-corpus-validation.md`에 정확한 오류를 기록한다.
5. 성공하면 원문을 아래 경로로 복사하거나 프로젝트 관례에 맞는 동등 경로에 넣는다.

```text
src/content/reference/sajushiba/corpus.v1.jsonl
src/content/reference/sajushiba/pattern-library.v1.json
src/content/reference/sajushiba/PERMISSION.md
```

`PERMISSION.md`에는 아래 내용을 명시한다.

```md
# 사주시바 레퍼런스 사용 범위

- 상태: 사용자 확인에 따른 허가 코퍼스
- 사용 가능: 원문 카피, 소재, 문체, 시리즈 구성, CTA, 전환 구조의 러브레빗 콘텐츠 재사용 및 자동 생성 참조
- 소스 범위: corpus.v1.jsonl에 들어 있는 게시물만
- 금지: 코퍼스에 없는 제3자 계정 콘텐츠 수집·사용
- 추적: 생성 초안마다 source post ID 및 pattern ID 저장
- 운영 기본값: 외부 게시 전 사람 승인 필요
```

# B. 데이터 모델

프로젝트 타입·DB 관례를 따르되, 아래 데이터 필드를 빠뜨리지 마라.

```ts
type ThreadPublishMode = "draft_only" | "approved_manual" | "scheduled";

type ReferenceSource = {
  postId: string;
  url: string;
  directCopyAllowed: boolean;
  extractionStatus: "complete" | "partial_parent_unavailable";
};

type LoveRabbitContentInput = {
  id: string;
  contentLane:
    | "daily_zodiac"
    | "weekly_ranking"
    | "inner_world"
    | "warning_card"
    | "free_reading"
    | "app_story"
    | "individual_reading";
  goal: "reach" | "save" | "engagement" | "conversion";
  selectedPatternId: string;
  approvedFacts: Array<{
    ruleId: string;
    claimId: string;
    safePhrasing: string;
    scope: string;
  }>;
  variables: {
    date?: string;
    ganji?: string;
    zodiacs?: string[];
    dayStems?: string[];
    dayPillars?: string[];
    ranking?: Array<{ rank: number; label: string; score?: number }>;
    colors?: Array<{ target: string; avoid: string[]; recommended: string[] }>;
    cta: { type: "comment" | "follow" | "link" | "share"; text: string };
  };
};

type GeneratedThreadDraft = {
  id: string;
  status: "draft" | "guard_failed" | "needs_review" | "approved" | "scheduled" | "published";
  inputId: string;
  patternId: string;
  benchmarkSourcePostIds: string[];
  directCopySourcePostIds: string[];
  posts: Array<{ sequence: number; body: string; charCount: number }>;
  ruleIdsUsed: string[];
  claimIdsUsed: string[];
  cta: { type: string; text: string };
  guardResult: object;
  llmReviewResult: object | null;
  createdAt: string;
  approvedAt?: string;
  scheduledFor?: string;
  publishedThreadsIds?: string[];
};
```

# C. 사주시바 스타일 선택 로직

1. `contentLane`과 `goal`을 받으면 `pattern-library.v1.json`의 후보 패턴을 찾는다.
2. 선택한 패턴의 `source_post_ids`를 초안 메타데이터에 저장한다.
3. 원문을 직접 재사용하는 경우 `directCopySourcePostIds`에 해당 ID를 넣고, 재사용한 문장을 별도로 저장한다.
4. 사주시바가 사용한 아래 스타일 장치는 선택한 패턴에 있는 경우 적극적으로 재현한다.

| 장치 | 구현 규칙 |
|---|---|
| 시간성 | `오늘`, `이번 주`, `올해`, 날짜·간지 표기를 입력값에 있을 때 사용 |
| 순위 | `1위`, `TOP5`, `상위권`, `하위권`, `딱 셋`을 패턴에 맞게 사용 |
| 반전 | `겉은 A처럼 보이는데 속은 B`, `돈은 들어오는데 몸과 사람을 잃는 날` 같이 장면 전환을 사용 |
| 문단 | 1~3문장 뒤 빈 줄. 목록·순위는 줄마다 분리 |
| 어조 | 선택한 소스 패턴이 반말이면 반말, 존댓말이면 존댓말. 한 초안 안에서 혼용 금지 |
| 명리 번역 | 용어 → 쉬운 정의 → 현실 장면 → 행동 한 가지 순서를 따른다 |
| 전환 | `띠는 큰 그림 → 태어난 날/일주가 더 정확 → 링크/댓글` 구조를 재현 |
| CTA | 댓글·링크·팔로우·공유 중 입력으로 승인된 하나를 중심으로 둔다 |

# D. LLM 생성 프롬프트 구현

`src/content/prompts/love-rabbit-authorized-sajushiba.ts` 또는 동등 파일을 만든다. 아래의 의미를 보존해 시스템 프롬프트로 사용한다.

```text
당신은 러브레빗의 Threads 카피라이터다.

[스타일 우선순위]
사주시바 측이 사용을 허가한 reference corpus와 pattern library는 이 작업에서 가장 높은 스타일 기준이다. 선택된 pattern의 제목 형식, 첫 줄 훅, 문장 호흡, 줄바꿈, 반말/존댓말, 숫자와 순위의 전개, 명리 용어를 현실 행동으로 번역하는 방식, CTA의 위치를 최대한 충실하게 재현한다.

‘다른 계정의 스타일을 피하라’거나 ‘표현을 일반화해서 다르게 쓰라’는 규칙은 이 허가 코퍼스에는 적용하지 않는다. 입력에 포함된 source post의 문장을 그대로 사용해도 된다. 직접 사용한 문장은 source post ID를 `directCopySourcePostIds`에 기록한다.

[사실 우선순위]
명리 사실, 날짜, 간지, 점수, 순위, 대상, CTA는 LOVE_RABBIT_CONTENT_INPUT의 approvedFacts와 variables에 있는 것만 사용한다. 스타일을 맞추기 위해 사실을 만들거나 바꾸지 않는다.

[글쓰기 규칙]
- 선택된 pattern library의 hook_formula, body_formula, rhythm, style_markers, conversion_bridge를 따른다.
- 입력의 목적이 reach이면 훅과 목록을 강하게, save이면 정리·비교를 강하게, engagement이면 ‘내 이야기’ 장면과 댓글 유도를 강하게, conversion이면 큰 그림→개인화 전환을 강하게 한다.
- Threads 단일 포스트는 500자 이내다. 긴 원문 패턴은 스레드 체인으로 분할한다.
- 출력은 JSON만 반환한다.

[출력 JSON]
{
  "patternId": "...",
  "benchmarkSourcePostIds": ["..."],
  "directCopySourcePostIds": ["..."],
  "posts": [{"sequence": 1, "body": "..."}],
  "ruleIdsUsed": ["..."],
  "claimIdsUsed": ["..."],
  "cta": {"type": "...", "text": "..."},
  "explanation": "선택한 허가 패턴과 입력 사실을 어떻게 결합했는지"
}
```

# E. 검수

## blocking: 코드로 차단

아래는 허가 코퍼스에 직접 재사용하더라도 반드시 차단한다.

1. 각 Threads 본문이 500자 초과
2. `ruleIdsUsed`, `claimIdsUsed`가 입력의 승인 목록 밖
3. 순위·점수·날짜·간지·대상 값이 입력과 다름
4. 사용자 생년월일시·상담 내용이 평문 로그·fixture에 저장됨
5. 코퍼스 밖의 제3자 콘텐츠가 reference source로 들어감
6. Threads 게시 모드가 `draft_only`인데 외부 publish API를 호출하려 함

## advisory: LLM + 사람 검토

아래는 차단하지 말고 리뷰 큐에 올린다.

1. 사주시바 스타일을 강하게 재현했지만 러브레빗의 현재 브랜드명·CTA와 부딪힘
2. 코퍼스 내 같은 문장을 지나치게 반복
3. 관계·재회·이별·재물 표현이 지나치게 단정적으로 읽힐 수 있음
4. 실제 명리 근거는 맞지만 글이 길어져 모바일 스크롤에서 약함

`reading-guard.ts`가 존재하면 재사용하되, 허가된 사주시바 문체와 일치한다는 이유로 모방·유사도 차단을 하지 마라. 모방 차단 규칙은 코퍼스 밖 제3자 소스에만 적용한다.

# F. 자동화 모드와 게시 안전장치

구현할 상태 전이는 아래와 같다.

```text
draft → guard_failed
      → needs_review → approved → scheduled → published
```

환경변수:

```env
THREADS_PUBLISH_MODE=draft_only
THREADS_TEXT_MODEL=<configured_model>
THREADS_TIMEZONE=Asia/Seoul
THREADS_MAX_POST_CHARS=500
```

- 기본 `THREADS_PUBLISH_MODE=draft_only`: 생성·검수·미리보기만 수행. 외부 API 호출 금지.
- `approved_manual`: 승인된 초안만 대시보드/CLI에서 사람이 누르면 게시 요청을 만들 수 있음. 구현만 하고 기본값을 변경하지 마라.
- `scheduled`: 승인 상태이고 예약 시각이 있는 초안만 게시 가능. 이 모드는 실제 Threads OAuth 토큰, 앱 권한, 공개 이미지 URL이 준비됐을 때만 활성화한다.
- API 토큰은 서버 환경변수에만 저장하고, 원문 코퍼스·초안 파일·로그에 절대 쓰지 마라.
- 게시 전, 콘텐츠 전문과 참조 source post ID, 직접 재사용 문장, 승인자, 예약 시각을 미리보기 화면에 표시한다.

# G. 이번 구현의 초기 산출물

1. 원문 코퍼스 검증기
2. 패턴 라이브러리 로더·선택기
3. 러브레빗 입력 스키마·생성 스키마
4. 허가 코퍼스 전용 시스템 프롬프트
5. 코드 가드와 LLM 리뷰 큐
6. 다음 20개 초안 생성 명령

```text
threads:benchmark:validate
threads:benchmark:analyze
threads:drafts:generate --count 20 --mode draft_only
threads:drafts:review --status needs_review
threads:drafts:preview --id <draft_id>
```

20개 초안의 구성은 아래대로 만든다.

| 레인 | 개수 | 우선 패턴 |
|---|---:|---|
| 오늘의 12띠/관계 온도 | 4 | SS-P02, SS-P05 |
| 주간 TOP·랭킹 | 4 | SS-P01 |
| 겉과 속·관계 기질 | 5 | SS-P03 |
| 무료 리딩/이벤트 | 2 | SS-P04 |
| 명리 용어 심층 번역 | 3 | SS-P06 |
| 서비스·웹툰 리딩 이야기 | 2 | SS-P07, SS-P08 |

랭킹·점수·일진 입력이 아직 러브레빗 엔진에 없으면 해당 레인은 비어 있는 입력으로 생성하지 마라. 대신 `blocked_by_missing_facts` 상태로 저장하고 필요한 데이터 어댑터를 보고하라.

# H. 테스트·최종 보고

다음 테스트를 작성하고 실행하라.

- 11개 코퍼스 행 파싱 및 필수 필드 검증
- 패턴 source post ID 참조 무결성
- 코퍼스 밖 source post ID 차단
- 직접 재사용 문장에 source ID가 기록되는지
- 500자 차단
- 승인 사실 밖 rule/claim ID 차단
- draft_only 모드에서 외부 publish 함수가 호출되지 않는지
- approved_manual/scheduled 모드에서 승인·예약 상태가 없으면 게시 불가인지

최종 보고에는 다음 표를 포함한다.

1. 코퍼스 검증 결과와 접근 범위
2. 구현 파일
3. 패턴별 생성된 초안 수
4. 직접 재사용한 소스와 패턴만 사용한 소스의 구분
5. blocking/advisory 결과
6. 현재 자동화 가능한 단계와 실제 게시를 위해 사용자가 준비해야 할 권한·토큰·도메인
7. 원문 코퍼스의 제한: v1은 공개 접근으로 수집된 11개 고유 게시물이며, 계정 전체 원문이 필요한 경우 사용자가 직접 내보낸 추가 원문을 같은 JSONL 형식으로 합쳐야 함

실제 Threads에 게시하거나 외부 API 권한을 연결하기 전에는 반드시 멈추고, 사용자에게 게시 대상·예약 시각·계정 권한 확인을 요청하라.
```

## 코퍼스 범위

현재 수집 파일에는 공개적으로 원문 접근이 가능했던 **11개 고유 Threads 게시물**이 있습니다. 공개 색인에서 계정은 더 많은 Threads를 보유한 것으로 보이지만, 프로필 전체 목록은 비로그인 환경에서 제한되어 전체 원문을 자동 열람할 수 없었습니다. 따라서 이 파일은 **바로 스타일 분석과 초안 자동화에 쓸 수 있는 V1 코퍼스**이며, 계정 전체 스타일을 완전히 덮으려면 사주시바 측에서 게시물 내보내기나 추가 원문을 같은 JSONL 포맷으로 제공받아 합치면 됩니다.

## 자동화 방식 선택

| 방식 | 작동 방식 | 장점 | 트레이드오프 | 비용 | 설정 난이도 |
|---|---|---|---|---|---|
| **초안·승인 자동화** | 코퍼스·명리 입력으로 매일 초안을 만들고, 사용자가 승인한 글만 직접 게시 | 지금 바로 시작 가능하고 스타일·명리 품질을 통제하기 쉬움 | 게시 직전 사람 확인 필요 | 낮음 | 중간 |
| **승인 후 예약 게시 자동화** | 승인된 초안을 정한 시각에 계정으로 자동 발행 | 운영 시간이 가장 적게 듦 | Threads 앱 권한·토큰·미디어 URL·실패 재시도 관리가 필요 | 중간 | 높음 |

처음에는 첫 방식을 사용해 코퍼스와 명리 규칙이 원하는 결과를 내는지 확인하고, 이후 둘째 방식을 활성화하면 됩니다. 실제 게시·결제·외부 계정 권한 연결은 사용자의 확인 없이 실행하지 않습니다.
