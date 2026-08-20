// 가드가 무엇을 잡고 무엇을 놓아주는지 붙잡아 둔다.
//
// 잡아야 할 것을 놓치면 확정 표현이 그대로 나가고, 놓아줘야 할 것을 잡으면
// 모든 리딩에 위반이 기록돼 blocking 신호 자체가 의미를 잃는다.
// 후자가 실제로 있었다 — "재회한다면" 이 "재회한다" 로 걸려, 재회 상품은
// 매번 위반을 하나씩 달고 나갔다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { checkReport } from "@/lib/reading-guard";
import type { StructuredReport } from "@/lib/reading-prompt";

function reportWith(summary: string): StructuredReport {
  return {
    meta: {
      title: "제목",
      headline: "머리말이에요.",
      readingTimeMin: 5,
      disclaimer: "참고용이에요.",
      confidenceNote: "시각까지 확인했어요.",
    },
    summaryCards: [],
    sections: [
      {
        id: "s1",
        navLabel: "한 절",
        title: "한 절",
        summary,
        paragraphs: ["본문이 이어져요."],
        factsUsed: ["strength.label=신약"],
        ruleIds: [],
        watchOut: undefined,
      } as StructuredReport["sections"][number],
    ],
    actionQuestions: [],
    characterNote: null,
    nextStep: null,
  };
}

const absolutes = (text: string) =>
  checkReport(reportWith(text), { expectedSections: 1 }).violations.filter((v) => v.kind === "단정");

describe("결과를 단정하는 말은 잡는다", () => {
  for (const text of [
    "두 사람은 재회해요.",
    "이 흐름이면 결혼합니다.",
    "결국 이별한다.",
    "가을에 헤어지게 됩니다.",
    "이번에는 헤어져요.",
    "결국 헤어진다.",
  ]) {
    it(`"${text}"`, () => {
      assert.equal(absolutes(text).length >= 1, true, "단정을 놓쳤다");
    });
  }

  it("반드시·무조건·100%도 잡는다", () => {
    for (const text of ["반드시 연락이 와요.", "무조건 잘 돼요.", "가능성은 100% 예요."]) {
      assert.equal(absolutes(text).length >= 1, true, `놓쳤다: ${text}`);
    }
  });
});

describe("가정과 인용은 놓아준다", () => {
  // 조건절은 결과를 단정한 말이 아니라 조건을 세운 말이다.
  for (const text of [
    "재회한다면 가장 먼저 달라져야 할 것은 거리를 설명하는 방식이에요.",
    "이별한다면 그 이유는 감정이 아니라 방식일 거예요.",
    "결혼한다고 모든 게 정리되지는 않아요.",
    "헤어진다거나 다시 만난다거나 하는 결론을 지금 낼 필요는 없어요.",
    "헤어진다면 그건 마음이 식어서가 아닐 거예요.",
  ]) {
    it(`"${text.slice(0, 24)}…"`, () => {
      assert.deepEqual(absolutes(text), [], "가정을 단정으로 잡았다");
    });
  }

  it("재회 상품의 목차 문장이 위반을 만들지 않는다", () => {
    // 4장 01 의 실제 제목이다. 모델이 요약에서 이 말을 그대로 받는 일이 잦다.
    const text = "재회한다면 반드시 달라져야 할 것은 참는 양이 아니라 설명하는 방식이에요.";
    // '반드시' 는 여전히 잡혀야 한다 — 놓아주는 것은 조건절뿐이다.
    const found = absolutes(text).map((v) => v.detail);
    assert.equal(found.some((d) => d.includes("결과 단정")), false, "조건절을 단정으로 잡았다");
    assert.equal(found.some((d) => d.includes("반드시")), true, "'반드시' 는 여전히 잡아야 한다");
  });
});
