// 목차가 약속한 것과 데이터가 감당하는 것을 맞춘다.
//
// 감사에서 나온 두 가지가 같은 뿌리였다.
//   "3장 01. 연락이 다시 올 확률, 그리고 그 시기"
//   "4장 02. 앞으로 6개월, 두 사람의 흐름"
//   "4장 03. 이번 재회가 마지막 기회인지, 다음 기회가 또 오는지"
// 세 절이 앞날을 팔았는데 계산된 앞날은 이번 달 하나였다. 모델은 없는 달을
// 지어내지 않는 쪽을 골랐고 — 그건 옳다 — 그래서 스물일곱 번 같은 달로 끝났다.
//
// 속궁합 12절은 검수 규칙 4개 위에 서 있었고 그중 하나가 열한 절의 뼈대였다.
//
// 둘 다 프롬프트로 못 고친다. 모델에게 더 잘 쓰라고 말할 문제가 아니라,
// **팔기 전에 무엇을 팔 수 있는지 세는 문제**다. 여기서 센다.

import { productCoverage, MIN_UNIQUE_RULES, COVERAGE_THRESHOLD_SECTIONS } from "@/lib/reading-coverage";
import type { ReadingRule } from "@/lib/reading-rules";
import type { SajuFacts } from "@/lib/saju-facts";

/**
 * 규칙이 모자랄 때 무엇을 할 것인가.
 *
 * "annotate" 목차는 그대로 두고 좁아진 범위를 밝힌다. **기본값.**
 * "trim"     절을 잘라낸다.
 *
 * 기본값을 annotate 로 둔 이유: 절을 자르는 것은 산 사람이 받을 것을 줄이는
 * 일이라 코드가 혼자 정할 일이 아니다. 다만 모자란 채로 조용히 나가서도 안 되므로,
 * 밝히기는 반드시 한다. 자르는 쪽을 택하려면 READING_SCOPE_POLICY=trim.
 */
export type ScopePolicy = "annotate" | "trim";

export const DEFAULT_SCOPE_POLICY: ScopePolicy = "annotate";

export function scopePolicy(): ScopePolicy {
  const raw = process.env.READING_SCOPE_POLICY;
  if (raw === "annotate" || raw === "trim") return raw;
  return DEFAULT_SCOPE_POLICY;
}

/** 앞날을 파는 문구와, 데이터가 없을 때 대신 쓸 말 */
const NARROWING: [RegExp, string][] = [
  [/(앞으로|향후)\s*\d+\s*(개월|달)/g, "이번 달"],
  [/다음 기회가 또 오는지/g, "지금 구간이 어떤 자리인지"],
  [/마지막 기회인지/g, "지금이 어떤 자리인지"],
  [/내년/g, "지금 구간"],
];

const PROMISES_AHEAD = /(앞으로|향후)\s*\d+\s*(개월|달)|다음 기회|또 오는지|마지막 기회|내년/;

export interface ScopeResult {
  outline: string[];
  /** 잘라낸 절 — 사용자에게 못 드린다고 말해야 할 것 */
  dropped: string[];
  /**
   * 좁아진 범위. confidence_note 에 그대로 실을 수 있는 한국어 한 줄씩.
   * 비어 있으면 목차가 약속한 것을 다 감당한다는 뜻이다.
   */
  notes: string[];
}

export interface ScopeInput {
  product: string;
  outline: string[];
  facts: SajuFacts;
  matchedRules: ReadingRule[];
}

export function scopeOutline(input: ScopeInput): ScopeResult {
  const notes: string[] = [];
  const dropped: string[] = [];
  const upcoming = input.facts.luckContext.upcoming;
  const hasAhead = upcoming.months.length >= 6 && Boolean(upcoming.nextYear);

  // ── 시기 ──
  let outline = input.outline.map((item) => {
    if (hasAhead || !PROMISES_AHEAD.test(item)) return item;
    let narrowed = item;
    for (const [pattern, replacement] of NARROWING) narrowed = narrowed.replace(pattern, replacement);
    if (narrowed !== item) {
      notes.push(`"${item}" 은 계산된 앞날이 ${upcoming.months.length}개월뿐이라 "${narrowed}" 로 좁혔어요`);
      return narrowed;
    }
    // 바꿔 쓸 말이 없으면 파는 것을 그만둔다 — 못 지킬 약속을 남기지 않는다.
    dropped.push(item);
    return item;
  });
  outline = outline.filter((item) => !dropped.includes(item));

  // ── 규칙 커버리지 ──
  const coverage = productCoverage({
    product: input.product,
    matchedRules: input.matchedRules,
    // 아직 절이 없으므로 목차만으로 센다. 여기서 보는 것은 규칙 쪽 숫자뿐이다.
    sections: outline.map((title) => ({ id: title, ruleIds: [], factsUsed: [] })),
  });

  if (outline.length >= COVERAGE_THRESHOLD_SECTIONS && coverage.uniqueRuleCount < MIN_UNIQUE_RULES) {
    // 규칙 하나가 절 두 개까지는 서로 다른 얼굴로 설 수 있다고 본다. 그 이상은 되풀이다.
    const affordable = Math.max(6, coverage.uniqueRuleCount * 2);
    if (scopePolicy() === "trim" && affordable < outline.length) {
      dropped.push(...outline.slice(affordable));
      outline = outline.slice(0, affordable);
      notes.push(
        `이 명식에서 켜진 해석은 ${coverage.uniqueRuleCount}가지라, 서로 다른 이야기가 되는 ` +
          `${affordable}절까지만 썼어요`
      );
    } else {
      notes.push(
        `이 명식에서 켜진 해석은 ${coverage.uniqueRuleCount}가지예요. ` +
          `${outline.length}절이 그 안에서 갈라져 나오니, 비슷하게 읽히는 대목이 있을 수 있어요`
      );
    }
  }

  return { outline, dropped, notes };
}
