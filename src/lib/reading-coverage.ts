// 상품 한 편이 실제로 몇 개의 검수된 판단 위에 서 있는가.
//
// 감사에서 나온 숫자: 속궁합 12절이 규칙 4개로 서 있었고, 그중 하나(TG-PYEONIN)가
// 11개 절의 뼈대였다. 같은 판단이 형태만 바꿔 열한 번 나온 셈이다. 문장은 매번
// 달랐으니 문체 검사로는 잡히지 않는다. 세어야 보인다.
//
// 여기서 하는 일은 판정이 아니라 계량이다. 부족한 상품을 어떻게 할지 —
// 절을 줄일지, 규칙을 늘릴지 — 는 이 숫자를 본 사람이 정한다.

import type { ReadingRule } from "@/lib/reading-rules";

export interface ProductCoverage {
  product: string;
  sectionCount: number;
  /** 이 명식·이 상품에서 켜진 서로 다른 규칙 수 */
  uniqueRuleCount: number;
  /** 그중 이 상품을 domains 에 명시한 규칙 수 — 상품이 스스로 벌어들인 몫 */
  domainRuleCount: number;
  /** 절에서 실제로 인용된 횟수 */
  ruleUsageHistogram: Record<string, number>;
  /** 규칙도 근거도 없이 선 절 */
  unsupportedSectionIds: string[];
  /** 켜졌지만 한 절도 쓰지 않은 규칙 */
  unusedRuleIds: string[];
}

/** 12절 이상이면 이만큼은 서로 다른 판단 위에 서야 한다 */
export const MIN_UNIQUE_RULES = 5;
/**
 * 한 규칙이 리포트를 덮고 있는가.
 *
 * 두 가지를 함께 본다. 절 기준 하나만 보면 잘못 잡는다 — 절마다 규칙을 넷씩 인용하는
 * 리포트에서는 규칙 열둘이 고르게 쓰여도 여러 규칙이 절반 넘는 절에 얼굴을 내민다.
 * 그건 덮인 게 아니라 촘촘한 것이다.
 *
 * 실제로 덮인 리포트는 두 조건이 함께 선다.
 *   1) 그 규칙이 절 대부분의 뼈대이고            (MAX_SECTION_SHARE)
 *   2) 인용 전체에서도 그 규칙이 큰 몫을 차지한다 (MAX_CITATION_SHARE)
 * 감사에서 잡힌 속궁합이 그랬다 — TG-PYEONIN 이 12절 중 11절(92%)이었고
 * 인용 전체에서도 3할이었다. 규칙이 넷뿐이었으니 그럴 수밖에 없었다.
 */
export const MAX_SECTION_SHARE = 0.5;
export const MAX_CITATION_SHARE = 0.3;
/** 위 두 기준을 적용하기 시작하는 절 수 */
export const COVERAGE_THRESHOLD_SECTIONS = 12;

export interface CoverageInput {
  product: string;
  matchedRules: ReadingRule[];
  sections: { id: string; ruleIds: string[]; factsUsed: string[] }[];
}

export function productCoverage(input: CoverageInput): ProductCoverage {
  const matchedIds = new Set(input.matchedRules.map((r) => r.id));
  const histogram: Record<string, number> = {};
  const unsupported: string[] = [];

  input.sections.forEach((section, index) => {
    const cited = section.ruleIds.filter((id) => matchedIds.has(id));
    for (const id of cited) histogram[id] = (histogram[id] ?? 0) + 1;
    // 규칙도 없고 계산 근거도 없으면 그 절은 아무것도 딛고 있지 않다.
    if (cited.length === 0 && section.factsUsed.length === 0) {
      unsupported.push(section.id || `sections[${index}]`);
    }
  });

  return {
    product: input.product,
    sectionCount: input.sections.length,
    uniqueRuleCount: matchedIds.size,
    domainRuleCount: input.matchedRules.filter((r) => r.when.domains?.includes(input.product)).length,
    ruleUsageHistogram: histogram,
    unsupportedSectionIds: unsupported,
    unusedRuleIds: [...matchedIds].filter((id) => !histogram[id]).sort(),
  };
}

export interface CoverageFinding {
  code: "PRODUCT-LOW-RULE-COVERAGE" | "PRODUCT-REPETITIVE-RULE" | "PRODUCT-UNSUPPORTED-SECTION";
  detail: string;
  where: string;
}

/** 계량한 것을 판정으로 옮긴다. 기준을 넘는 것만 돌려준다. */
export function coverageFindings(coverage: ProductCoverage): CoverageFinding[] {
  const out: CoverageFinding[] = [];
  const long = coverage.sectionCount >= COVERAGE_THRESHOLD_SECTIONS;

  if (long && coverage.uniqueRuleCount < MIN_UNIQUE_RULES) {
    out.push({
      code: "PRODUCT-LOW-RULE-COVERAGE",
      where: `product:${coverage.product}`,
      detail:
        `${coverage.sectionCount}절을 규칙 ${coverage.uniqueRuleCount}개로 쓰고 있다 ` +
        `(최소 ${MIN_UNIQUE_RULES}개). 상품 전용 규칙은 ${coverage.domainRuleCount}개뿐이다.`,
    });
  }

  if (long) {
    const citations = Object.values(coverage.ruleUsageHistogram).reduce((sum, n) => sum + n, 0);
    for (const [id, count] of Object.entries(coverage.ruleUsageHistogram)) {
      const sectionShare = count / coverage.sectionCount;
      const citationShare = citations > 0 ? count / citations : 0;
      if (sectionShare <= MAX_SECTION_SHARE || citationShare <= MAX_CITATION_SHARE) continue;
      out.push({
        code: "PRODUCT-REPETITIVE-RULE",
        where: `product:${coverage.product}`,
        detail:
          `${id} 가 ${coverage.sectionCount}절 중 ${count}절의 뼈대이고 ` +
          `근거 인용의 ${Math.round(citationShare * 100)}%를 혼자 차지한다. ` +
          `같은 판단이 형태만 바꿔 되풀이된다.`,
      });
    }
  }

  for (const id of coverage.unsupportedSectionIds) {
    out.push({
      code: "PRODUCT-UNSUPPORTED-SECTION",
      where: id,
      detail: "검수 규칙도 계산 근거도 없이 선 절이다",
    });
  }

  return out;
}
