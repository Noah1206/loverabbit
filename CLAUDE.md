# CLAUDE.md — 러브레빗 (생성기)

이 저장소는 러브레빗 사이트이자, **Threads 초안을 만드는 생성기**다.
초안을 검수·승인·발행하는 쪽은 별도 저장소다 — `../loverabbit-threads`.

---

## 이 폴더에서 무엇을 하는가

```
명리 엔진 (일진·십성·형충회합)
        ↓
규칙 표 (READING_RULES) → 승인된 사실만 뽑아 입력으로
        ↓
Claude 가 그 사실 안에서 문장을 쓴다
        ↓
가드가 검사한다 (차단 / 자문)
        ↓
.threads-drafts.json
        ↓ (콘솔 저장소가 import 로 가져간다)
```

문장을 쓰는 것은 **Claude Code 구독**이다. `AI_PROVIDER=claude-code` 로 못 박혀
있고, `src/lib/ai-claude-code.ts` 가 CLI 를 헤드리스로 부른다. `ANTHROPIC_API_KEY`
로 부르면 구독이 아니라 API 종량과금이라 일부러 그 길을 안 쓴다.

## 절대 건드리지 말 것

이 셋이 무너지면 나머지는 의미가 없다.

1. **승인된 사실 밖의 명리 주장을 만들지 않는다.**
   `approvedFacts` 에 없는 것은 쓰지 않는다. 규칙 표에 없는 주장이 필요하면
   문장을 고치는 게 아니라 `reading-rules.ts` 에 규칙을 추가하는 일이고,
   그건 사람이 근거를 갖고 할 일이다.

2. **점수·순위·날짜·간지·띠·일간을 지어내거나 바꾸지 않는다.**
   입력에 있는 값만 쓴다. 주간 랭킹이 아직 막혀 있는 이유가 이것이다 —
   산식이 없어서 순위를 만들 수 없다.

3. **가드를 우회하지 않는다.**
   초안을 손으로 고쳐 `.threads-drafts.json` 에 써넣지 마라. 그건 가드를
   건너뛴 문장이 큐에 앉는다는 뜻이다. 고쳐야 하면 재작성 요청을 남기고
   생성기를 다시 돌려라 (아래).

## 운영자 지시 채널

```
content-brief.md        상시 방향 — 톤, 강조점, 피할 표현
rewrite-requests.json   건별 재작성 — { "inner-정관": "두 번째 문단이 설명조야" }
```

둘 다 **표현과 구성에만** 닿는다. `src/lib/threads-brief.ts` 의 `operatorBlock`
이 지시문 옆에 경계를 함께 적어 보낸다 — 지시가 절대 규칙과 부딪히면 규칙이
이긴다.

재작성 요청이 있는 초안은 `--force` 없이도 다시 쓰이고, 성공하면 요청이
지워진다. 안 지우면 같은 지적이 매번 걸려 문장이 한쪽으로 계속 밀린다.

## 명령

```
npm run threads:drafts:generate                초안 생성 (기존 것은 건너뜀)
npm run threads:drafts:generate -- --force     전부 다시
npm run threads:drafts:generate -- --only inner-정관,term-chung
npm run threads:drafts:review                  큐 상태
npm run threads:drafts:preview -- --id draft-inner-정관
npm run threads:permission:status              사주시바 원문 허가 상태
npm test
```

`--only` 는 재작성용이다. 계획 전체를 돌리지 않고 지목한 것만 다시 쓴다.

## 상태의 뜻

| | |
|---|---|
| `draft` | 가드 통과. 사람이 승인하면 나갈 수 있다 |
| `needs_review` | 자문 지적이 있다. 사람이 봐야 한다 |
| `guard_failed` | 차단 위반. 다시 써야 한다 |
| `blocked_by_missing_facts` | 만들 근거가 없다 (주간 랭킹 산식 등). **지어내서 채우지 마라** |
| `needs_permission_metadata` | 사주시바 원문 인용인데 허가 증빙이 비었다 |

## 사주시바 코퍼스

`src/content/reference/sajushiba/` 에 원문 11개와 패턴 8개가 있다.
구조를 참고하는 것은 항상 열려 있고, **문장을 그대로 옮기는 것은 잠겨 있다** —
`PERMISSION.md` 의 세 항목(운영 책임자·확인일·증빙 경로)이 비어 있기 때문이다.
환경변수를 켜도 그 셋이 비면 안 열린다.

## 게시는 여기서 하지 않는다

발행 코드는 이 저장소에 없다. 일부러 뺐다 — 게시로 가는 길이 둘이면 그중
하나는 반드시 승인을 건너뛴다. `THREADS_PUBLISH_MODE` 는 `draft_only` 로
두고, 실제 발행은 `../loverabbit-threads` 가 한다.
