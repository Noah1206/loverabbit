import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  composeReport,
  continuityFromReport,
  previewBatchCount,
  previewSections,
  type Complete,
} from "@/lib/reading-compose";
import { buildSajuFacts } from "@/lib/saju-facts";
import type { ReadingInput } from "@/lib/reading-prompt";

const outline = [
  "1장 01. 첫 절",
  "1장 02. 둘째 절",
  "2장 01. 셋째 절",
  "2장 02. 넷째 절",
];

const input: ReadingInput = {
  facts: buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" }),
  partnerFacts: null,
  matchedRules: [],
  productLabel: "테스트 리딩",
  outline,
  focus: "self",
  currentScene: "",
  now: new Date(2026, 7, 23),
};

const headJson = JSON.stringify({
  report_meta: {
    headline: "처음부터 끝까지 이어질 한 줄 결론",
    disclaimer: "오락 및 자기성찰을 위한 참고 해석이에요.",
    confidence_note: "",
  },
  summary_cards: [{ label: "중심", value: "같은 결론", detail: "", facts_used: [] }],
  action_questions: [],
  next_step: null,
});

function requestedItems(prompt: string): string[] {
  return [...prompt.matchAll(/^\d+\.\s+(.+?)\s+\[extra(?: 없이|:)/gm)].map((match) => match[1]);
}

function fakeComplete(log: { system: string; user: string; cachePrefix: string }[]): Complete {
  return async (system, user, _budget, options) => {
    log.push({ system, user, cachePrefix: options?.promptCache?.prefix ?? "" });
    const text = user.startsWith("지시: 머리")
      ? headJson
      : JSON.stringify({
          sections: requestedItems(user).map((_, index) => ({
            n: index + 1,
            verdict: `결론 ${index + 1}`,
            summary: `요약 ${index + 1}`,
            paragraphs: [`문단 ${index + 1}`],
            facts_used: [],
            rule_ids: [],
            emotion_tags: ["평온"],
          })),
        });
    return {
      text,
      provider: "openai-compat",
      model: "gpt-5.6",
      usage: { input: 10, output: 10, cached: 0, cacheWrite: 0, reasoning: 0 },
    };
  };
}

describe("같은 리포트를 무료 1절에서 결제 후 이어 쓰기", () => {
  it("기본 무료분은 확정 머리와 실제 첫 절 하나다", async () => {
    assert.equal(previewSections(), 1);
    const calls: { system: string; user: string; cachePrefix: string }[] = [];
    const preview = await composeReport(input, fakeComplete(calls), {
      batchLimit: previewBatchCount(outline),
    });

    assert.ok(preview.report);
    assert.deepEqual(preview.report.sections.map((section) => section.title), [outline[0]]);
    assert.equal(calls.filter((call) => call.user.startsWith("지시: 머리")).length, 1);
    assert.equal(calls.filter((call) => call.user.startsWith("지시: 본문")).length, 1);
  });

  it("결제 후에는 머리와 첫 절을 다시 만들지 않고 연결 상태를 공통 입력으로 보낸다", async () => {
    const preview = await composeReport(input, fakeComplete([]), {
      batchLimit: previewBatchCount(outline),
    });
    assert.ok(preview.report);

    const continuity = continuityFromReport(preview.report);
    const calls: { system: string; user: string; cachePrefix: string }[] = [];
    const rest = await composeReport(input, fakeComplete(calls), {
      doneSections: 1,
      continuity,
    });

    assert.equal(rest.report, null, "이어쓰기에서 머리를 다시 만들면 안 된다");
    assert.deepEqual(rest.sections.map((section) => section.title), outline.slice(1));
    assert.equal(calls.some((call) => call.user.startsWith("지시: 머리")), false);
    assert.ok(calls.every((call) => call.cachePrefix.includes("앞에서 확정된 연속성 상태")));
    assert.ok(calls.every((call) => call.cachePrefix.includes(continuity.headline)));
  });

  it("예전 2절 미리보기도 새 1절 경계에서 셋째 절을 건너뛰지 않는다", async () => {
    const calls: { system: string; user: string; cachePrefix: string }[] = [];
    const rest = await composeReport(input, fakeComplete(calls), { doneSections: 2 });

    assert.deepEqual(rest.sections.map((section) => section.title), outline.slice(2));
    assert.equal(rest.failedParts.length, 0);
  });
});
