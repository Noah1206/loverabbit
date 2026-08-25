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
//
// 2026-08-25: "년" 단위 약속을 더했다. 결혼 상품이 "3년 흐름"을 파는데 계산된
// 앞날은 일곱 달과 다음 해 한 줄이다. 예전 정규식은 "개월·내년"만 알아서 "3년"이
// 그대로 지나갔고, 모델은 없는 해를 지어내지 않는 쪽을 고르니 그 절은 올해
// 이야기로 끝났다. 이제 약속한 길이를 달로 환산해 계산이 감당하는 길이와 대조한다.

import { productCoverage, MIN_UNIQUE_RULES, COVERAGE_THRESHOLD_SECTIONS } from "@/lib/reading-coverage";
import type { ReadingRule } from "@/lib/reading-rules";
import type { SajuFacts, UpcomingLuck } from "@/lib/saju-facts";

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

/**
 * 해 단위 약속을 좁힐 때 쓰는 말.
 *
 * "1년차, 2년차, 3년차 흐름" 처럼 해를 늘어놓은 것은 "첫 해"로, "3년 흐름" 처럼
 * 길이를 말한 것은 "지금 구간"으로 받는다. 계산이 다음 해까지는 보므로 첫 해는
 * 지킬 수 있는 약속이다.
 */
const YEAR_NARROWING: [RegExp, string][] = [
  [/\d+\s*년차(?:\s*,\s*\d+\s*년차)*/g, "첫 해"],
  [/\d+\s*년\s*(?:후|뒤)/g, "앞으로의"],
  [/\d+\s*년(?!차)/g, "지금 구간"],
];

const PROMISES_AHEAD = /(앞으로|향후)\s*\d+\s*(개월|달)|다음 기회|또 오는지|마지막 기회|내년/;

/**
 * 문구가 약속하는 앞날의 길이(달). 숫자가 없으면 null.
 *
 * "앞으로 6개월" → 6, "3년 흐름" → 36, "1년차, 2년차, 3년차" → 36, "내년" → 12.
 * 이 값이 계산된 앞날보다 길면 그 약속은 지킬 수 없다.
 */
export function promiseHorizonMonths(text: string): number | null {
  let longest: number | null = null;
  const take = (months: number) => {
    if (longest === null || months > longest) longest = months;
  };
  for (const m of text.matchAll(/(앞으로|향후)\s*(\d+)\s*(개월|달)/g)) take(Number(m[2]));
  for (const m of text.matchAll(/(\d+)\s*년/g)) take(Number(m[1]) * 12);
  if (/내년/.test(text)) take(12);
  return longest;
}

/** 계산이 실제로 감당하는 앞날의 길이(달). 다음 해 기둥이 있으면 열두 달로 친다. */
export function computedHorizonMonths(upcoming: UpcomingLuck): number {
  return upcoming.months.length + (upcoming.nextYear ? 12 : 0);
}

function narrowYears(text: string): string {
  let out = text;
  for (const [pattern, replacement] of YEAR_NARROWING) out = out.replace(pattern, replacement);
  return out;
}

export interface ScopeResult {
  outline: string[];
  /**
   * 모델이 보는 리포트 이름. 목차와 같은 규칙으로 좁힌다 — 목차만 좁히고 이름이
   * 여전히 "3년 흐름"을 말하면 모델은 이름 쪽을 믿는다.
   */
  label: string | null;
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
  /** 모델에 실리는 리포트 이름(promptLabel). 있으면 같은 규칙으로 좁힌다. */
  label?: string;
}

export function scopeOutline(input: ScopeInput): ScopeResult {
  const notes: string[] = [];
  const dropped: string[] = [];
  const upcoming = input.facts.luckContext.upcoming;
  const hasAhead = upcoming.months.length >= 6 && Boolean(upcoming.nextYear);
  const horizon = computedHorizonMonths(upcoming);

  /** 한 줄을 계산 범위 안으로 들인다. 못 들이면 null. */
  const fit = (item: string, kind: "절" | "이름"): string | null => {
    // 해 단위 — 길이를 세어 대조한다.
    const promised = promiseHorizonMonths(item);
    if (promised !== null && promised > horizon) {
      const narrowed = narrowYears(item);
      if (narrowed !== item) {
        notes.push(
          `${kind} "${item}" 은 ${promised}개월을 약속하는데 계산된 앞날은 ${horizon}개월이라 "${narrowed}" 로 좁혔어요`
        );
        return narrowed;
      }
    }
    // 달 단위·기회 — 예전 그대로.
    if (hasAhead || !PROMISES_AHEAD.test(item)) return item;
    let narrowed = item;
    for (const [pattern, replacement] of NARROWING) narrowed = narrowed.replace(pattern, replacement);
    if (narrowed !== item) {
      notes.push(`"${item}" 은 계산된 앞날이 ${upcoming.months.length}개월뿐이라 "${narrowed}" 로 좁혔어요`);
      return narrowed;
    }
    return null;
  };

  // ── 시기 ──
  let outline = input.outline.map((item) => {
    const fitted = fit(item, "절");
    if (fitted !== null) return fitted;
    // 바꿔 쓸 말이 없으면 파는 것을 그만둔다 — 못 지킬 약속을 남기지 않는다.
    dropped.push(item);
    return item;
  });
  outline = outline.filter((item) => !dropped.includes(item));

  // 이름은 자르지 않는다. 좁힐 수 있으면 좁히고, 못 좁히면 그대로 둔다 —
  // 이름이 없는 리포트는 만들 수 없다.
  const label = input.label === undefined ? null : (fit(input.label, "이름") ?? input.label);

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

  return { outline, label, dropped, notes };
}
