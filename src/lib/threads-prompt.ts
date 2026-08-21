// Threads 초안 생성 프롬프트와 출력 파서.
//
// 지시 문서 D가 `src/content/prompts/love-rabbit-authorized-sajushiba.ts` 를 지목했지만
// "또는 동등 파일"이라고 단서를 달았고, 이 저장소는 프롬프트를 전부 src/lib 에 둔다
// (reading-prompt.ts). 관례를 따르는 쪽을 골랐다.
//
// 프롬프트의 핵심은 두 우선순위를 갈라 두는 것이다.
//   스타일은 사주시바 패턴이 정한다.
//   사실은 러브레빗 승인 입력이 정한다.
// 이 둘이 부딪히면 언제나 사실이 이긴다. 모양을 맞추려고 순위나 점수를 만들어내는
// 것이 자동화가 가장 먼저 무너지는 지점이다.

import type { SajushibaPattern, CorpusRow } from "@/lib/threads-corpus";
import { patternForPrompt, sourceBodiesForPrompt } from "@/lib/threads-patterns";
import type {
  AuthorizedReuseMode,
  DirectCopySpan,
  LoveRabbitContentInput,
  SourceTransformLog,
} from "@/lib/threads-content";
import { MAX_POST_CHARS, TRANSFORM_REASONS } from "@/lib/threads-content";

export interface ThreadDraftOut {
  patternId: string;
  benchmarkSourcePostIds: string[];
  directCopySourcePostIds: string[];
  directCopyExcerpts: Array<{ postId: string; text: string }>;
  directCopySpans: DirectCopySpan[];
  sourceTransformLog: SourceTransformLog[];
  fullReuse?: boolean;
  posts: Array<{ sequence: number; body: string }>;
  ruleIdsUsed: string[];
  claimIdsUsed: string[];
  cta: { type: string; text: string };
  explanation: string;
}

/**
 * 모드마다 원문을 어떻게 쓸지.
 *
 * pattern_only 에서는 원문을 아예 안 보여준다. 눈앞에 두고 "베끼진 마"라고 적는
 * 것보다 안 보여주는 편이 실제로 지켜진다 — reading-guard.ts 가 해요체에서 이미
 * 확인한 것이다(변환표를 주기 전까지 51%).
 *
 * 나머지 세 모드에서는 원문 전문을 준다. 대신 무엇을 반드시 바꿔야 하는지를
 * 같은 자리에서 못 박는다. 시의성 값(날짜·간지·점수·순위·색)은 원문 것을
 * 그대로 쓰면 그 순간 거짓말이 되므로, 모드와 무관하게 치환 대상이다.
 */
const MODE_RULES: Record<AuthorizedReuseMode, string> = {
  pattern_only: `
[원문 사용 모드: pattern_only]
원문 문장을 옮기지 않는다. source_posts 에는 본문 대신 structure_evidence(줄 종류와
길이)만 실린다. 그 리듬을 재현하되 문장은 새로 쓴다.
directCopySourcePostIds / directCopyExcerpts / directCopySpans 는 전부 빈 배열이다.`,

  close_adaptation: `
[원문 사용 모드: close_adaptation]
원문의 훅, 문단 순서, 문장 호흡, 목록 형태, CTA 구조를 최대한 그대로 유지한다.
문장은 러브레빗의 말로 다시 쓴다 — 원문 문장을 그대로 옮기지 않는다.
반드시 바꿔야 하는 것:
  · 날짜·간지·점수·순위·색·방향 → LOVE_RABBIT_CONTENT_INPUT 의 variables 값으로.
    입력에 없으면 그 대목을 통째로 뺀다. 원문 값을 그대로 두지 않는다.
  · 명리 주장 → approvedFacts 의 것으로.
  · 브랜드·화자 이름·앱 이름·외부 링크·테스터 모집·보상 → 러브레빗의 것으로.
바꾼 대목은 sourceTransformLog 에 {sourcePostId, sourceSection, originalText,
transformedText, reason} 으로 남긴다.
directCopySpans 는 빈 배열이다.`,

  verbatim_excerpt: `
[원문 사용 모드: verbatim_excerpt]
source_body 의 문장·문단을 그대로 골라 쓸 수 있다. 브랜드와 링크만 최소한으로 덧붙인다.
그대로 옮긴 구간은 directCopySpans 에 하나씩 남긴다:
  {sourcePostId, sourceStart, sourceEnd, text, reuseMode:"verbatim_excerpt", replacementReason?}
  sourceStart / sourceEnd 는 source_body 문자열에서의 위치다. text 는 원문과 한 글자도
  달라선 안 된다. 기록하지 않고 옮기는 것은 위반이다.
고르면 안 되는 구간:
  · 사주시바 브랜드·화자 이름·앱·외부 링크·연락처·테스터 모집·보상이 들어간 문장
  · 날짜·간지·점수·순위·색·방향 같은 시의성 값이 들어간 문장
  이런 대목이 필요하면 발췌하지 말고 새로 쓰거나 뺀다.
그 postId 를 directCopySourcePostIds 에도 넣는다.`,

  verbatim_full_post: `
[원문 사용 모드: verbatim_full_post]
source_body 의 전체 문단 순서를 보존한다. 금지·시의성·브랜드 치환 지점만 승인
입력값으로 바꾼다. 옮긴 구간 전부를 directCopySpans 에 남기고 fullReuse 를 true 로 둔다.
바꾼 자리는 각 span 의 replacementReason 에 이유를 적는다.
그 postId 를 directCopySourcePostIds 에도 넣는다.`,
};

export function threadsSystemPrompt(mode: AuthorizedReuseMode): string {
  return `당신은 러브레빗의 Threads 카피라이터다.

[스타일 우선순위]
사주시바 측이 사용을 허가한 reference corpus 와 pattern library 는 이 작업에서 가장 높은
스타일 기준이다. 선택된 pattern 의 hook_formula, body_formula, rhythm, style_markers,
conversion_bridge 를 최대한 충실하게 재현한다. 첫 줄 훅, 문장 호흡, 줄바꿈, 반말/존댓말,
숫자와 순위의 전개, 명리 용어를 현실 행동으로 번역하는 방식, CTA 의 위치가 그 대상이다.
'다른 계정의 스타일을 피하라'는 일반 규칙은 이 허가 코퍼스에는 적용하지 않는다.

[사실 우선순위]
명리 사실, 날짜, 간지, 점수, 순위, 대상, CTA 는 LOVE_RABBIT_CONTENT_INPUT 의
approvedFacts 와 variables 에 있는 것만 쓴다. 스타일을 맞추려고 사실을 만들거나 바꾸지 않는다.
- approvedFacts 에 없는 명리 주장을 하지 않는다.
- variables 에 ranking 이 없으면 순위를 붙이지 않는다. "1위", "TOP5", "상위권"도 쓰지 않는다.
- variables 에 colors 가 없으면 행운색·방향을 말하지 않는다.
- variables 에 ganji 가 없으면 간지를 쓰지 않는다.
없는 것을 자연스럽게 채우는 것이 이 작업에서 가장 큰 실패다. 비어 있으면 비운 채로 쓴다.

[말하지 않는 것]
- 반드시·무조건·틀림없이·100%
- 재회한다·이별한다·헤어진다·결혼한다 같은 결과 단정
- 상대의 속마음·외도·임신·질병·법률·투자에 대한 확정
- 공포로 몰아가는 경고. 경고 훅을 쓰더라도 끝은 반드시 할 수 있는 행동 하나로 닫는다.
approvedFacts 의 safePhrasing 은 그 규칙이 허락한 표현의 폭이다. 그보다 세게 말하지 않는다.

[글 구조]
- 첫 줄에서 멈추게 한다. 시간성·숫자·반전·관계 장면 중 pattern 이 쓰는 것으로.
- 명리 근거는 한 문장. 바로 일상 감정이나 행동으로 옮긴다.
- 끝에 오늘 또는 이번 주에 해 볼 행동을 하나만 둔다.
- CTA 는 입력이 지정한 하나만 쓴다. 두 개를 넣지 않는다.
- 포스트 하나는 ${MAX_POST_CHARS}자 이내다. 넘으면 스레드 체인으로 나눈다(최대 5개).
- 한 초안 안에서 반말과 존댓말을 섞지 않는다.
${MODE_RULES[mode]}

[출력]
설명 없이 JSON 객체 하나만 출력한다.
{
  "patternId": "...",
  "benchmarkSourcePostIds": ["..."],
  "directCopySourcePostIds": ["..."],
  "directCopyExcerpts": [{"postId": "...", "text": "..."}],
  "directCopySpans": [{"sourcePostId": "...", "sourceStart": 0, "sourceEnd": 0, "text": "...", "reuseMode": "...", "replacementReason": "..."}],
  "sourceTransformLog": [{"sourcePostId": "...", "sourceSection": "...", "originalText": "...", "transformedText": "...", "reason": "approved_fact_swap|brand_swap|cta_swap|time_sensitive_value|privacy", "note": "무엇을 왜 바꿨는지 한 문장"}],
  "fullReuse": false,
  "posts": [{"sequence": 1, "body": "..."}],
  "ruleIdsUsed": ["..."],
  "claimIdsUsed": ["..."],
  "cta": {"type": "...", "text": "..."},
  "explanation": "선택한 허가 패턴과 입력 사실을 어떻게 결합했는지 두 문장 이내"
}`;
}

/** 목적에 따라 어디를 세게 쓸지 — 지시 문서 D의 요구 */
const GOAL_EMPHASIS: Record<string, string> = {
  reach: "훅과 목록을 강하게. 첫 줄에서 대상을 빨리 찾게 한다.",
  save: "정리와 비교를 강하게. 다시 꺼내 볼 만한 기준이 남게 쓴다.",
  engagement: "'내 이야기' 장면을 강하게. 댓글로 자기 경우를 말하고 싶게 만든다.",
  conversion: "큰 그림에서 개인화로 넘어가는 다리를 강하게. 링크는 마지막 한 번만.",
};

export function buildThreadsInput(
  input: LoveRabbitContentInput,
  pattern: SajushibaPattern,
  rows: CorpusRow[],
  mode: AuthorizedReuseMode,
  /** 운영자 지시 — 표현에만 닿는다. threads-brief.ts 가 경계까지 함께 적어 준다. */
  operator = ""
): string {
  const payload = {
    LOVE_RABBIT_CONTENT_INPUT: {
      id: input.id,
      content_lane: input.contentLane,
      goal: input.goal,
      goal_emphasis: GOAL_EMPHASIS[input.goal] ?? "",
      approved_facts: input.approvedFacts.map((f) => ({
        rule_id: f.ruleId,
        claim_id: f.claimId,
        safe_phrasing: f.safePhrasing,
        scope: f.scope,
      })),
      variables: input.variables,
    },
    SELECTED_PATTERN: patternForPrompt(pattern),
    SOURCE_POSTS: sourceBodiesForPrompt(pattern, rows, mode),
  };
  return `아래 입력으로 Threads 초안 하나를 써.\n\n${JSON.stringify(payload, null, 2)}`;
}

/**
 * 변형 사유를 다섯 갈래 중 하나로.
 *
 * 모델은 여기에 한 문장짜리 설명을 적어 낸다. 유니온 타입은 그걸 막지 못하고
 * (런타임에는 그냥 문자열이다), as 로 캐스팅하면 타입만 맞고 값은 틀린 상태가
 * 조용히 저장된다. 그래서 낱말로 분류하고 원문은 note 에 남긴다.
 */
function classifyReason(raw: unknown): { reason: SourceTransformLog["reason"]; note?: string } {
  const text = typeof raw === "string" ? raw : "";
  const exact = TRANSFORM_REASONS.find((r) => r === text);
  if (exact) return { reason: exact };

  const rules: [RegExp, SourceTransformLog["reason"]][] = [
    [/브랜드|계정|화자|이름|앱|링크/, "brand_swap"],
    [/CTA|댓글|링크 유도|공유|팔로우/, "cta_swap"],
    [/생년월일|개인정보|프라이버시/, "privacy"],
    [/날짜|간지|점수|순위|색|시의|오늘|이번 주/, "time_sensitive_value"],
  ];
  for (const [pattern, reason] of rules) {
    if (pattern.test(text)) return { reason, note: text || undefined };
  }
  // 나머지는 전부 명리 사실 교체로 본다 — close_adaptation 에서 가장 흔한 변형이다.
  return { reason: "approved_fact_swap", note: text || undefined };
}

/**
 * 모델 출력 파싱.
 *
 * reading-prompt.ts 와 같은 세 번의 시도를 쓴다 — 그대로, 코드펜스 안, 중괄호 사이.
 * 모델이 JSON만 내라는 지시를 어기는 방식이 이 셋을 벗어나지 않았다.
 */
export function parseThreadDraft(text: string): ThreadDraftOut | null {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
    const posts = Array.isArray(raw.posts) ? raw.posts : [];
    if (posts.length === 0) continue;

    const strings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

    const cta = (raw.cta ?? {}) as Record<string, unknown>;
    return {
      patternId: typeof raw.patternId === "string" ? raw.patternId : "",
      benchmarkSourcePostIds: strings(raw.benchmarkSourcePostIds),
      directCopySourcePostIds: strings(raw.directCopySourcePostIds),
      directCopyExcerpts: Array.isArray(raw.directCopyExcerpts)
        ? (raw.directCopyExcerpts as Record<string, unknown>[])
            .filter((e) => typeof e?.postId === "string" && typeof e?.text === "string")
            .map((e) => ({ postId: e.postId as string, text: e.text as string }))
        : [],
      posts: (posts as Record<string, unknown>[])
        .filter((p) => typeof p?.body === "string")
        .map((p, i) => ({
          sequence: typeof p.sequence === "number" ? p.sequence : i + 1,
          body: (p.body as string).trim(),
        })),
      directCopySpans: Array.isArray(raw.directCopySpans)
        ? (raw.directCopySpans as Record<string, unknown>[])
            .filter((e) => typeof e?.sourcePostId === "string" && typeof e?.text === "string")
            .map((e) => ({
              sourcePostId: e.sourcePostId as string,
              // 오프셋을 안 준 모델도 있다. 없으면 -1 로 두고, 가드가 원문 대조로 잡는다.
              sourceStart: typeof e.sourceStart === "number" ? e.sourceStart : -1,
              sourceEnd: typeof e.sourceEnd === "number" ? e.sourceEnd : -1,
              text: e.text as string,
              reuseMode:
                e.reuseMode === "verbatim_full_post" ? "verbatim_full_post" : "verbatim_excerpt",
              replacementReason: e.replacementReason as DirectCopySpan["replacementReason"],
            }))
        : [],
      sourceTransformLog: Array.isArray(raw.sourceTransformLog)
        ? (raw.sourceTransformLog as Record<string, unknown>[])
            .filter((e) => typeof e?.sourcePostId === "string")
            .map((e) => ({
              sourcePostId: e.sourcePostId as string,
              sourceSection: String(e.sourceSection ?? ""),
              originalText: String(e.originalText ?? ""),
              transformedText: String(e.transformedText ?? ""),
              ...classifyReason(e.reason),
            }))
        : [],
      fullReuse: raw.fullReuse === true,
      ruleIdsUsed: strings(raw.ruleIdsUsed),
      claimIdsUsed: strings(raw.claimIdsUsed),
      cta: {
        type: typeof cta.type === "string" ? cta.type : "",
        text: typeof cta.text === "string" ? cta.text : "",
      },
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }
  return null;
}

/** 가드에 걸린 초안을 다시 시킬 때 붙일 지적 사항 */
export function threadsRetryPrompt(details: string[]): string {
  return `방금 출력이 아래를 어겼어. 같은 JSON 스키마로 다시 쓰되 이 부분만 고쳐.

${details.map((d) => `- ${d}`).join("\n")}

고칠 때 지킬 것:
- 입력에 없는 순위·점수·간지·색은 문장째로 뺀다.
- 단정 표현은 가능성의 언어로 바꾼다.
- 포스트 하나가 ${MAX_POST_CHARS}자를 넘으면 체인으로 나눈다.
- CTA는 입력이 지정한 하나만 남긴다.
설명 없이 JSON 객체 하나만 출력해.`;
}
