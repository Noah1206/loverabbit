// 가드가 명식을 보게 된 뒤에야 할 수 있는 검사들.
//
// 이 파일이 붙잡는 것은 전부 실제 감사에서 새 나갔던 것이다. 문장은 멀쩡했고
// 문체도 맞았고 스키마도 맞았다. 리포트만 보고는 알 수 없는 문제였다.
//
// 기준 명식(1993-01-24 14:00 여): 임신 계축 을사 계미.
// 지지는 신·축·사·미 — **인(寅)도 술(戌)도 없다.** 그런데 부분 성립한 형이
// "인사신 삼형", "축술미 삼형" 이라는 이름으로 나갔다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildSajuFacts } from "@/lib/saju-facts";
import { matchRules } from "@/lib/reading-rules";
import { isPartnerRule } from "@/lib/myeongri-policy/partner-rules";
import { checkReport, type GuardOptions } from "@/lib/reading-guard";
import { xingLabel } from "@/lib/myeongri/xing-name";
import type { StructuredReport } from "@/lib/reading-prompt";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const ME = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" }, NOW);
const PARTNER = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" }, NOW);

function reportWith(section: Partial<StructuredReport["sections"][number]>): StructuredReport {
  return {
    meta: {
      title: "재회 사주",
      headline: "지금은 붙잡는 힘과 걸리는 자리가 같은 곳에 있어요",
      readingTimeMin: 8,
      disclaimer: "",
      confidenceNote: "",
    },
    summaryCards: [],
    sections: [
      {
        id: "core",
        navLabel: "관계의 결",
        title: "지금 두 사람 사이에 무엇이 걸려 있는지",
        summary: "가까울수록 같은 대목에서 걸리는 자리예요.",
        paragraphs: ["문단 하나."],
        factsUsed: [],
        ruleIds: [],
        ...section,
      },
    ],
    actionQuestions: [
      { question: "질문1", whyItMatters: "이유1" },
      { question: "질문2", whyItMatters: "이유2" },
      { question: "질문3", whyItMatters: "이유3" },
    ],
    characterNote: null,
    nextStep: null,
  };
}

const OPTIONS: GuardOptions = {
  expectedSections: 1,
  facts: ME,
  partnerFacts: PARTNER,
  matchedRules: matchRules(ME, PARTNER, "jaehoe", 12),
  productDomain: "jaehoe",
};

function codes(report: StructuredReport, options: Partial<GuardOptions> = {}): string[] {
  return checkReport(report, { ...OPTIONS, ...options }).violations
    .map((v) => v.code)
    .filter(Boolean) as string[];
}

// ── 계산층은 건드리지 않았다 ─────────────────────────────────

describe("기준 명식의 계산 결과는 그대로다", () => {
  it("네 기둥이 변하지 않았다", () => {
    const p = ME.fourPillars;
    assert.equal(`${p.year.stem}${p.year.branch}`, "임신");
    assert.equal(`${p.month.stem}${p.month.branch}`, "계축");
    assert.equal(`${p.day.stem}${p.day.branch}`, "을사");
    assert.equal(`${p.hour!.stem}${p.hour!.branch}`, "계미");
    assert.equal(ME.strength.label, "신약");
    // 2026-08-21 강약 표 전환. 옛 셈법은 36이었다 (myeongri.regression.test.ts 가 잠근다).
    assert.equal(ME.strength.score, 30);
  });

  it("상대 명식도 그대로다", () => {
    const p = PARTNER.fourPillars;
    assert.equal(`${p.year.stem}${p.year.branch}`, "신미");
    assert.equal(`${p.month.stem}${p.month.branch}`, "을미");
    assert.equal(`${p.day.stem}${p.day.branch}`, "기묘");
    assert.equal(`${p.hour!.stem}${p.hour!.branch}`, "갑술");
    assert.equal(PARTNER.strength.label, "신강");
  });
});

// ── P0-1 정명 ────────────────────────────────────────────

describe("부분 성립한 형은 선 글자로만 이름 짓는다", () => {
  it("사·신 두 글자는 사신형이지 인사신 삼형이 아니다", () => {
    const found = ME.xing.find((x) => x.kind === "yin_si_shen_three_xing")!;
    assert.equal(found.completeness, "partial");
    assert.deepEqual(found.branches, ["사", "신"]);
    assert.equal(xingLabel(found), "사신형");
  });

  it("축·미 두 글자는 축미형이지 축술미 삼형이 아니다", () => {
    const found = ME.xing.find((x) => x.kind === "chou_xu_wei_three_xing")!;
    assert.equal(found.completeness, "partial");
    assert.equal(xingLabel(found), "축미형");
  });

  it("모델이 인사신 삼형이라고 쓰면 막힌다 — 명식에 인(寅)이 없다", () => {
    const has = ME.fourPillars;
    const branches = [has.year.branch, has.month.branch, has.day.branch, has.hour!.branch];
    assert.equal(branches.includes("인"), false, "전제가 깨졌다 — 이 명식에 인이 있다");

    const found = codes(
      reportWith({
        paragraphs: ["배우자 자리에 걸린 인사신 삼형(가까운 사이에서만 되살아나는 얽힘)이 있어요."],
      })
    );
    assert.ok(found.includes("GUARD-XING-OVERNAME"), `잡히지 않았다: ${found.join(", ")}`);
  });

  it("사신형이라고 제대로 쓰면 통과한다", () => {
    const found = codes(
      reportWith({ paragraphs: ["사신형(같은 자리에서 되풀이해 걸리는 결)이 있어요."] })
    );
    assert.equal(found.includes("GUARD-XING-OVERNAME"), false);
    assert.equal(found.includes("GUARD-NAMED-TERM-ABSENT"), false);
  });

  it("명식에 아예 없는 고유명은 다른 코드로 잡힌다", () => {
    // 이 명식에 도화는 없다.
    const found = codes(reportWith({ paragraphs: ["도화(끌림이 도는 자리)가 관계를 흔들어요."] }));
    assert.ok(found.includes("GUARD-NAMED-TERM-ABSENT"), `잡히지 않았다: ${found.join(", ")}`);
  });
});

// ── P0-2 번들 ────────────────────────────────────────────

describe("같은 두 글자를 두 구조로 세지 않는다", () => {
  it("사신합과 사신형이 한 번들에 들어간다", () => {
    const bundle = ME.relationBundles.find((b) => b.id === "사신")!;
    assert.equal(bundle.combinedInterpretationPolicy, "single_bundle");
    assert.deepEqual(
      bundle.relations.map((r) => r.label).sort(),
      ["사신합", "사신형"]
    );
    assert.deepEqual(
      bundle.positions.map((p) => p.role),
      ["연지", "일지"]
    );
  });

  it("축미충과 축미형도 한 번들이다", () => {
    const bundle = ME.relationBundles.find((b) => b.id === "축미")!;
    assert.equal(bundle.combinedInterpretationPolicy, "single_bundle");
    assert.deepEqual(bundle.relations.map((r) => r.label).sort(), ["축미충", "축미형"]);
    assert.deepEqual(bundle.positions.map((p) => p.role), ["월지", "시지"]);
  });

  it("합·충 관계에 자리가 붙어 있다", () => {
    // 자리가 없어서 축미충이 근거 칸만 채우고 본문에 한 번도 못 쓰였다.
    for (const relation of ME.notableRelations) {
      assert.ok(relation.pillarPositions.length >= 2, `${relation.label}: 자리가 없다`);
    }
  });

  it("한 절이 사신합과 사신형을 두 구조로 나눠 쓰면 막힌다", () => {
    const found = codes(
      reportWith({
        paragraphs: [
          "사신합(놓지 못하게 붙드는 짝)이 있어 쉽게 정리되지 않아요.",
          "게다가 사신형까지 겹쳐서 또 다른 문제가 생겨요.",
        ],
      })
    );
    assert.ok(found.includes("GUARD-UNBUNDLED-RELATION-COUNT"), `잡히지 않았다: ${found.join(", ")}`);
  });

  it("한 자리의 두 얼굴로 묶어 쓰면 통과한다", () => {
    const found = codes(
      reportWith({
        paragraphs: ["사신합(붙드는 힘과 걸리는 결이 한 자리에 있는 짝)이라 놓기도 어렵고 편하지도 않아요."],
      })
    );
    assert.equal(found.includes("GUARD-UNBUNDLED-RELATION-COUNT"), false);
  });
});

// ── P0-3 가드 ────────────────────────────────────────────

describe("근거가 실제 계산값과 같은지 본다", () => {
  it("맞는 경로와 값은 통과한다", () => {
    const found = codes(
      reportWith({ factsUsed: ["strength.label=신약", "dayMaster=을목", "tenGods.일지=사 상관"] })
    );
    assert.equal(found.includes("GUARD-FACT-PATH-MISMATCH"), false, found.join(", "));
  });

  it("값이 다르면 막힌다", () => {
    const found = codes(reportWith({ factsUsed: ["strength.label=신강"] }));
    assert.ok(found.includes("GUARD-FACT-PATH-MISMATCH"));
  });

  it("없는 경로면 막힌다", () => {
    const found = codes(reportWith({ factsUsed: ["yongsin.element=화"] }));
    assert.ok(found.includes("GUARD-FACT-PATH-MISMATCH"));
  });

  it("상대. 접두어를 알아본다", () => {
    const found = codes(reportWith({ factsUsed: ["상대.strength.label=신강"] }));
    assert.equal(found.includes("GUARD-FACT-PATH-MISMATCH"), false, found.join(", "));
  });

  it("경로가 값이 아니라 묶음을 가리키면 막힌다", () => {
    const found = codes(reportWith({ factsUsed: ["luckContext=2026년 8월"] }));
    assert.ok(found.includes("GUARD-FACT-PATH-MISMATCH"));
  });

  it("본문이 쓰지 않은 관계를 근거로 올리면 막힌다", () => {
    // 감사 실물: 두 절이 축미충을 근거로 올려놓고 본문에는 한 줄도 쓰지 않았다.
    const found = codes(
      reportWith({
        paragraphs: ["사신합(놓지 못하게 붙드는 짝)이 있어요."],
        factsUsed: ["relationBundles.축미=축미충+축미형(부분)@월지,시지"],
      })
    );
    assert.ok(found.includes("GUARD-FACT-CHIP-UNUSED"), `잡히지 않았다: ${found.join(", ")}`);
  });

  it("켜지지 않은 규칙을 인용하면 막힌다", () => {
    const found = codes(reportWith({ ruleIds: ["XING-YINSISHEN"] }));
    assert.ok(found.includes("GUARD-RULE-NOT-MATCHED"), `잡히지 않았다: ${found.join(", ")}`);
  });
});

describe("summary_cards도 본문과 같은 검사를 받는다", () => {
  const cardReport = (value: string, detail: string): StructuredReport => {
    const base = reportWith({});
    return { ...base, summaryCards: [{ label: "관계의 결", value, detail, factsUsed: [] }] };
  };

  it("카드에 단정 표현이 있으면 잡힌다", () => {
    const result = checkReport(cardReport("반드시 연락이 와요", "설명"), OPTIONS);
    assert.ok(result.violations.some((v) => v.kind === "단정" && v.where.startsWith("summary_cards")));
  });

  it("카드의 구조 용어도 잡힌다", () => {
    const result = checkReport(cardReport("신약한 편", "일지가 흔들려요"), OPTIONS);
    assert.ok(result.violations.some((v) => v.kind === "용어" && v.where.startsWith("summary_cards")));
  });
});

describe("괄호 설명 판정", () => {
  it("부속어가 끼어도 설명을 알아본다", () => {
    // 창이 3자였을 때 이 꼴이 설명 없음으로 잘못 잡혔다.
    const result = checkReport(
      reportWith({ paragraphs: ["사신형 부분(같은 자리에서 되풀이해 걸리는 결)이 있어요."] }),
      OPTIONS
    );
    const missing = result.violations.filter((v) => v.detail.includes("괄호 설명이 없다"));
    assert.deepEqual(missing, []);
  });

  it("정말 설명이 없으면 잡는다", () => {
    const result = checkReport(reportWith({ paragraphs: ["사신형이 있어요."] }), OPTIONS);
    assert.ok(result.violations.some((v) => v.detail.includes("괄호 설명이 없다")));
  });

  it("한자 병기는 설명이 아니다", () => {
    // "소한(小寒)" 을 읽고 나서 독자가 아는 것은 하나도 늘지 않는다.
    // Gemini 로 한 번 돌렸더니 이 꼴로 검사를 통과했다.
    const result = checkReport(
      reportWith({ paragraphs: ["사신형(巳申刑)이 걸려 있어요."] }),
      OPTIONS
    );
    assert.ok(result.violations.some((v) => v.detail.includes("괄호 설명이 없다")));
  });

  it("멀리 떨어진 남의 괄호를 제 것으로 삼지 않는다", () => {
    const result = checkReport(
      reportWith({ paragraphs: ["사신형이 있고 그래서 편인(기대는 자리)이 커요."] }),
      OPTIONS
    );
    assert.ok(result.violations.some((v) => v.detail.includes('"사신형" 에 괄호 설명이 없다')));
  });
});

describe("자연어를 명리 용어로 오탐하지 않는다", () => {
  it('"기사"를 간지(己巳)로 읽지 않는다', () => {
    const found = codes(reportWith({ paragraphs: ["기사에서 본 이야기처럼 흘러가요."] }));
    const myeongri = found.filter((c) => c.startsWith("GUARD-"));
    assert.deepEqual(myeongri, [], found.join(", "));
  });

  it('"상관없어요"를 십성 상관으로 세지 않는다', () => {
    // 이 명식에는 상관이 실제로 있지만, 없는 명식에서 이 문장이 나오면 위반이 된다.
    const other = buildSajuFacts({ year: 1990, month: 6, day: 6, hour: 6, gender: "M" }, NOW);
    const found = codes(
      reportWith({ paragraphs: ["누가 먼저 연락했는지는 상관없어요."] }),
      { facts: other, partnerFacts: null, matchedRules: matchRules(other, null, "jaehoe", 12) }
    );
    assert.equal(found.includes("GUARD-NAMED-TERM-ABSENT"), false, found.join(", "));
  });
});

// ── P1 상품·상대·시기 ─────────────────────────────────────

describe("상대에 대한 판단에는 근거가 있어야 한다", () => {
  /** 상대를 떠받칠 수 있는 규칙을 뺀 목록 — 가드가 무엇을 막는지 보려면 이게 필요하다 */
  const selfOnly = matchRules(ME, PARTNER, "jaehoe", 15).filter((r) => !isPartnerRule(r.id));

  it("승인된 상대 규칙이 없으면 상대 성향 문장이 막힌다", () => {
    const found = codes(reportWith({ paragraphs: ["상대는 자기 기준을 지키는 편이에요."] }), {
      matchedRules: selfOnly,
    });
    assert.ok(found.includes("GUARD-UNSUPPORTED-PARTNER-CLAIM"), `잡히지 않았다: ${found.join(", ")}`);
  });

  it("승인된 상대 규칙이 있으면 그 문장이 나갈 수 있다", () => {
    // 이것이 이번 판에서 실제로 열린 문이다. 등재부에 출처와 금지선을 갖춘 규칙이
    // 서고 나서야 상대 이야기가 근거 있는 말이 된다.
    const found = codes(reportWith({ paragraphs: ["상대는 자기 기준을 지키는 편이에요."] }));
    assert.equal(found.includes("GUARD-UNSUPPORTED-PARTNER-CLAIM"), false, found.join(", "));
  });

  it("기준 명식에서 상대 규칙이 실제로 켜진다", () => {
    for (const product of ["jaehoe", "sokgunghap"]) {
      const rules = matchRules(ME, PARTNER, product, 15);
      const partnerRules = rules.filter((r) => isPartnerRule(r.id));
      assert.ok(partnerRules.length >= 3, `${product}: 상대 규칙이 ${partnerRules.length}개뿐이다`);
    }
  });

  it("상대 규칙은 본인 규칙을 밀어내지 않는다", () => {
    // 자리를 남겨 두되 앞자리를 차지하지는 않는다. 이 리포트를 사는 사람은 본인이다.
    const rules = matchRules(ME, PARTNER, "jaehoe", 15);
    const partnerRules = rules.filter((r) => isPartnerRule(r.id));
    assert.ok(partnerRules.length <= Math.floor(rules.length / 3));
    assert.ok(Math.max(...partnerRules.map((r) => r.priority)) < rules[0].priority);
  });

  it("상대가 목적어일 뿐인 문장은 잡지 않는다", () => {
    // 이 문장의 주어는 당신이다. 낱말만 세면 걸리는 자리 — 실제로 걸렸었다.
    const found = codes(
      reportWith({
        paragraphs: ["당신은 분위기를 먼저 읽고, 상대가 편할 말을 골라 건네는 편이에요."],
      })
    );
    assert.equal(found.includes("GUARD-UNSUPPORTED-PARTNER-CLAIM"), false, found.join(", "));
  });

  it("두 사람 사이의 결로 쓰면 통과한다", () => {
    const found = codes(
      reportWith({ paragraphs: ["두 사람이 같은 자리에서 자꾸 걸려요."] })
    );
    assert.equal(found.includes("GUARD-UNSUPPORTED-PARTNER-CLAIM"), false);
  });
});

describe("앞으로를 약속한 절에는 앞으로의 데이터가 있어야 한다", () => {
  it("여섯 달과 다음 해가 계산되어 있다", () => {
    const upcoming = ME.luckContext.upcoming;
    assert.equal(upcoming.months.length, 6);
    assert.ok(upcoming.nextYear);
    // 이번 달(8월)은 빠지고 다음 달부터다.
    assert.equal(upcoming.months[0].month, 9);
    assert.equal(`${upcoming.months[0].pillar.stem}${upcoming.months[0].pillar.branch}`, "정유");
    assert.equal(upcoming.nextYear!.year, 2027);
  });

  it("데이터가 있는데 한 달도 짚지 않으면 기록이 남는다", () => {
    const found = codes(
      reportWith({
        title: "앞으로 6개월, 두 사람의 흐름",
        paragraphs: ["2026년 8월에는 이런 흐름이에요."],
      })
    );
    assert.ok(found.includes("GUARD-TIMING-WINDOW-UNUSED"), found.join(", "));
  });

  it("앞으로의 달을 실제로 짚으면 통과한다", () => {
    const found = codes(
      reportWith({
        title: "앞으로 6개월, 두 사람의 흐름",
        paragraphs: ["10월과 12월에 말의 결이 달라져요."],
      })
    );
    assert.equal(found.includes("GUARD-TIMING-WINDOW-UNUSED"), false);
    assert.equal(found.includes("GUARD-TIMING-WINDOW-MISSING"), false);
  });

  it("앞날이 계산돼 있지 않으면 약속 자체가 막힌다", () => {
    const empty = {
      ...ME,
      luckContext: { ...ME.luckContext, upcoming: { months: [], nextYear: null } },
    };
    const found = codes(reportWith({ title: "다음 기회가 또 오는지" }), { facts: empty });
    assert.ok(found.includes("GUARD-TIMING-WINDOW-MISSING"), found.join(", "));
  });
});

describe("상품이 몇 개의 판단 위에 서 있는지 센다", () => {
  const twelveCiting = (ruleId: string): StructuredReport => {
    const base = reportWith({});
    return {
      ...base,
      sections: Array.from({ length: 12 }, (_, i) => ({
        ...base.sections[0],
        id: `s${i}`,
        ruleIds: [ruleId],
      })),
    };
  };

  it("12절을 규칙 한둘로 쓰면 기록이 남는다", () => {
    const thin = matchRules(ME, PARTNER, "sokgunghap", 12).slice(0, 2);
    const found = checkReport(twelveCiting(thin[0].id), {
      expectedSections: 12,
      facts: ME,
      partnerFacts: PARTNER,
      matchedRules: thin,
      productDomain: "sokgunghap",
    }).violations.map((v) => v.code);
    assert.ok(found.includes("PRODUCT-LOW-RULE-COVERAGE"), found.join(", "));
    assert.ok(found.includes("PRODUCT-REPETITIVE-RULE"), found.join(", "));
  });

  it("규칙 부족은 다시 쓰게 하지 않는다 — 사람이 상품을 손볼 일이다", () => {
    const thin = matchRules(ME, null, "sokgunghap", 12).slice(0, 2);
    const result = checkReport(twelveCiting(thin[0].id), {
      expectedSections: 12,
      facts: ME,
      matchedRules: thin,
      productDomain: "sokgunghap",
    });
    const coverage = result.violations.filter((v) => v.code?.startsWith("PRODUCT-"));
    assert.ok(coverage.length > 0);
    assert.equal(coverage.every((v) => !v.blocking), true);
  });
});

describe("명식을 안 주면 예전처럼 표현 검사만 돈다", () => {
  it("명리 코드가 하나도 안 나온다", () => {
    const result = checkReport(
      reportWith({ paragraphs: ["인사신 삼형(설명)이 있어요."] }),
      { expectedSections: 1 }
    );
    assert.equal(result.violations.some((v) => v.code?.startsWith("GUARD-")), false);
  });
});
