// 모양 덩어리 — 이건 덤이다. 어긋나면 버리고, 본문은 그것과 무관하게 온전해야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { EXTRA_KINDS, extraPlanFor, extraToText, parseExtra } from "@/lib/reading-extra";

const plain = (t: string) => t;

describe("네 가지 모양을 알아본다", () => {
  it("뽑아낸 한 문장", () => {
    const out = parseExtra({ kind: "quote", text: "감정이 아니라 방식이 갈랐어요." });
    assert.deepEqual(out, { kind: "quote", text: "감정이 아니라 방식이 갈랐어요." });
  });

  it("나 / 상대 대조", () => {
    const out = parseExtra({ kind: "contrast", mine: "혼자 정리할 시간", theirs: "거리를 두는 신호" });
    assert.equal(out?.kind, "contrast");
  });

  it("시기", () => {
    const out = parseExtra({
      kind: "timeline",
      points: [
        { when: "2026년 8월", what: "연락이 늘어요" },
        { when: "올해 후반", what: "기준을 다시 세워요" },
      ],
    });
    assert.equal(out?.kind === "timeline" && out.points.length, 2);
  });

  it("할 일 목록", () => {
    const out = parseExtra({ kind: "checklist", items: ["한 가지만 물어보기", "답을 기다리기"] });
    assert.equal(out?.kind === "checklist" && out.items.length, 2);
  });
});

describe("어긋나면 버린다 — 반쯤 망가진 채로 세우지 않는다", () => {
  for (const [label, raw] of [
    ["모르는 kind", { kind: "graph", data: [1, 2] }],
    ["kind 없음", { text: "무언가" }],
    ["빈 객체", {}],
    ["null", null],
    ["문자열", "quote"],
    ["quote 가 너무 짧음", { kind: "quote", text: "짧아요" }],
    ["quote 가 문단만큼 김", { kind: "quote", text: "가".repeat(200) }],
    ["contrast 한쪽이 빔", { kind: "contrast", mine: "나", theirs: "" }],
    ["timeline 이 하나뿐", { kind: "timeline", points: [{ when: "8월", what: "무언가" }] }],
    ["timeline 이 배열이 아님", { kind: "timeline", points: "8월" }],
    ["checklist 가 하나뿐", { kind: "checklist", items: ["하나"] }],
    ["checklist 가 전부 빈 문자열", { kind: "checklist", items: ["", "  "] }],
  ] as [string, unknown][]) {
    it(label, () => {
      assert.equal(parseExtra(raw), undefined, "버려야 하는데 통과했다");
    });
  }
});

describe("너무 많이 오면 잘라 낸다", () => {
  it("시기는 넷까지", () => {
    const points = Array.from({ length: 9 }, (_, i) => ({ when: `${i}월`, what: "무언가" }));
    const out = parseExtra({ kind: "timeline", points });
    assert.equal(out?.kind === "timeline" && out.points.length, 4);
  });

  it("할 일도 넷까지", () => {
    const items = Array.from({ length: 9 }, (_, i) => `할 일 ${i}`);
    const out = parseExtra({ kind: "checklist", items });
    assert.equal(out?.kind === "checklist" && out.items.length, 4);
  });
});

describe("저장되는 원문에는 내용만 남는다", () => {
  it("모양이 사라져도 글자는 남는다", () => {
    const extra = parseExtra({ kind: "checklist", items: ["하나 물어보기", "답 기다리기"] });
    const text = extraToText(extra, plain);
    assert.equal(text.includes("하나 물어보기"), true);
    assert.equal(text.includes("답 기다리기"), true);
  });

  it("없으면 빈 문자열 — 원문에 빈 줄을 남기지 않는다", () => {
    assert.equal(extraToText(undefined, plain), "");
  });

  it("강조 표기는 넘겨받은 함수가 걷어낸다", () => {
    const extra = parseExtra({ kind: "quote", text: "**중요한** 한 문장이에요." });
    const stripped = extraToText(extra, (t) => t.replace(/\*\*/g, ""));
    assert.equal(stripped.includes("*"), false);
  });
});

describe("모양 배분은 서버가 정한다", () => {
  it("홀수 번째 절에만 붙는다 — 절반쯤", () => {
    const plan = Array.from({ length: 15 }, (_, i) => extraPlanFor(i));
    assert.equal(plan.filter((k) => k === null).length, 8);
    assert.equal(plan.filter(Boolean).length, 7);
  });

  it("네 종류가 돌아가며 나온다 — 한 가지로 몰리지 않는다", () => {
    const used = Array.from({ length: 15 }, (_, i) => extraPlanFor(i)).filter(Boolean);
    assert.equal(new Set(used).size, EXTRA_KINDS.length, "종류가 다 안 쓰였다");
    // 어느 하나가 절반을 넘기지 않는다
    for (const kind of EXTRA_KINDS) {
      const n = used.filter((k) => k === kind).length;
      assert.ok(n <= Math.ceil(used.length / 2), `${kind} 가 ${n}개로 몰렸다`);
    }
  });

  it("연달아 같은 모양이 나오지 않는다", () => {
    const plan = Array.from({ length: 30 }, (_, i) => extraPlanFor(i));
    for (let i = 1; i < plan.length; i += 1) {
      if (plan[i] && plan[i - 1]) assert.notEqual(plan[i], plan[i - 1]);
    }
  });

  it("짧은 리포트에서도 첫 모양이 나온다", () => {
    assert.equal(extraPlanFor(0), null);
    assert.equal(extraPlanFor(1), EXTRA_KINDS[0]);
  });
});
