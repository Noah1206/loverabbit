// 결제 전에 공개되는 몫이 하는 일 — 계약이 실제로 실리는지.
//
// 무료 공개분은 설명이 아니라 진단이어야 한다. 그러려면 (1) 상품마다 재료가 있어야 하고,
// (2) 그 재료가 공개분을 만드는 호출에만 실려야 하고(결제 뒤 이어 쓰기에는 안 실린다),
// (3) 모델이 남긴 물음(open_loop)이 파서를 지나 화면까지 와야 한다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRODUCT_MAP } from "@/lib/products";
import { PRODUCT_PREVIEWS, previewFor } from "@/lib/reading-preview";
import {
  buildReadingInput,
  parseStructuredReport,
  READING_SYSTEM_PROMPT,
  systemPromptFor,
  type ReadingInput,
} from "@/lib/reading-prompt";
import { buildSajuFacts } from "@/lib/saju-facts";

const base: ReadingInput = {
  facts: buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" }),
  partnerFacts: buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" }),
  matchedRules: [],
  productLabel: "재회운",
  productId: "jaehoe",
  outline: ["1장 01. 처음부터 끌릴 수밖에 없었던 이유", "1장 02. 사주가 말해주는 이별의 진짜 원인"],
  focus: "relationship",
  currentScene: "",
  now: new Date(2026, 7, 25),
};

describe("미리보기 재료", () => {
  it("판매 중인 모든 상품에 있다", () => {
    for (const id of Object.keys(PRODUCT_MAP)) {
      const p = previewFor(id);
      assert.ok(p, `${id} 에 미리보기 재료가 없다`);
      assert.ok(p.scenes.length >= 3, `${id} 장면이 셋도 안 된다`);
      assert.ok(p.unlockReveals.length >= 3, `${id} 전체 풀이가 주는 것이 셋도 안 된다`);
      assert.ok(p.hiddenVariable.includes("아니라"), `${id} 숨은 변수는 "…가 아니라 …" 꼴이어야 한다`);
      assert.notEqual(p.surfaceQuestion, p.hiddenQuestion, `${id} 표면 질문과 숨은 질문이 같다`);
    }
  });

  it("상품 목록 밖의 재료는 없다", () => {
    for (const id of Object.keys(PRODUCT_PREVIEWS)) assert.ok(PRODUCT_MAP[id], `${id} 는 상품이 아니다`);
  });

  it("판매 문구를 재료에 넣지 않는다 — 파는 것은 화면이 한다", () => {
    for (const [id, p] of Object.entries(PRODUCT_PREVIEWS)) {
      const text = [p.surfaceQuestion, p.hiddenQuestion, p.hiddenVariable, ...p.scenes].join(" ");
      for (const word of ["결제", "구매", "해금", "990", "원으로"]) {
        assert.ok(!text.includes(word), `${id} 재료에 "${word}" 가 있다`);
      }
    }
  });
});

describe("공개분 호출에만 실린다", () => {
  it("freeItems 가 있으면 delivery.preview 가 간다", () => {
    const payload = JSON.parse(buildReadingInput({ ...base, freeItems: [base.outline[0]] }));
    const preview = payload.delivery.preview;
    assert.ok(preview, "preview 가 없다");
    assert.deepEqual(preview.free_items, [base.outline[0]]);
    assert.equal(preview.hidden_question, PRODUCT_PREVIEWS.jaehoe.hiddenQuestion);
    assert.ok(Array.isArray(preview.scenes) && preview.scenes.length >= 3);
  });

  it("freeItems 가 없으면(결제 뒤 이어 쓰기) 그 칸 자체가 없다", () => {
    const payload = JSON.parse(buildReadingInput(base));
    assert.equal("preview" in payload.delivery, false);
    const empty = JSON.parse(buildReadingInput({ ...base, freeItems: [] }));
    assert.equal("preview" in empty.delivery, false);
  });

  it("지시문이 계약을 머리와 본문 양쪽에 준다", () => {
    assert.ok(READING_SYSTEM_PROMPT.includes("# PREVIEW CONTRACT"));
    assert.ok(systemPromptFor("head").includes("PREVIEW CONTRACT"));
    assert.ok(systemPromptFor("body").includes("PREVIEW CONTRACT"));
    // 파는 말은 글이 아니라 화면이 한다 — 지시문이 그 선을 긋는다.
    assert.ok(READING_SYSTEM_PROMPT.includes("판매 문구를 쓰지 않는다"));
    assert.ok(READING_SYSTEM_PROMPT.includes('"open_loop":"string"'), "머리 스키마에 open_loop 가 없다");
  });
});

describe("open_loop", () => {
  const head = (openLoop: unknown) =>
    JSON.stringify({
      report_meta: { headline: "h".repeat(45), confidence_note: "", open_loop: openLoop },
      summary_cards: [
        { label: "나의 중심", value: "v", detail: "", facts_used: [] },
        { label: "관계의 결", value: "v", detail: "", facts_used: [] },
        { label: "지금의 흐름", value: "v", detail: "", facts_used: [] },
      ],
      action_questions: [],
      sections: [{ n: 1, verdict: "v.", summary: "s", paragraphs: ["a", "b", "c"], facts_used: [], rule_ids: [] }],
    });

  it("파서를 지나 meta.openLoop 로 온다 — 표기는 걷어낸다", () => {
    const parsed = parseStructuredReport(head("연락이 오느냐보다 **누가 먼저** 손을 내미느냐가 남았어"));
    assert.ok(parsed);
    assert.equal(parsed.meta.openLoop, "연락이 오느냐보다 누가 먼저 손을 내미느냐가 남았어");
  });

  it("비어 있으면 칸 자체가 없다", () => {
    const parsed = parseStructuredReport(head(""));
    assert.ok(parsed);
    assert.equal("openLoop" in parsed.meta, false);
  });
});
