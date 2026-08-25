// 이름을 부르는 것과 이름을 말하는 것을 가른다.
//
// 열세 상품의 축을 켜고 돌린 비교에서 가드가 세 곳에서 헛짚었다. "도화는 없다"를 없는
// 이름을 불렀다고 잡았고, "도화 지수 28"의 게이지 이름을 명식의 글자로 읽었고,
// "다시 지켜"의 "시지"를 구조 용어로 잡았다. 셋 다 리포트가 아니라 가드의 잘못이다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkReport } from "@/lib/reading-guard";
import { buildSajuFacts } from "@/lib/saju-facts";
import type { StructuredReport } from "@/lib/reading-prompt";

const ME = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });

function report(text: string, title = "1장 01. 검사", extra: string[] = []): StructuredReport {
  const section = (t: string, i: number) => ({
    id: `s${i}`,
    title: i === 0 ? title : `${i + 1}장 01. 절`,
    navLabel: "n",
    summary: t,
    paragraphs: [],
    verdict: "",
    factsUsed: [],
    ruleIds: [],
    emotionTags: [],
  });
  return {
    meta: { headline: "h", disclaimer: "", confidenceNote: "" },
    summaryCards: [],
    sections: [text, ...extra].map(section),
    actionQuestions: [],
    characterNote: null,
  } as unknown as StructuredReport;
}

const codesOf = (r: StructuredReport, options: Record<string, unknown> = {}) =>
  checkReport(r, { expectedSections: r.sections.length, forbiddenClaims: [], facts: ME, ...options })
    .violations.map((v) => v.code ?? v.kind);

describe("없는 이름", () => {
  // 기준 명식에는 도화·홍염이 없다 (골든 sokgunghap.canonical 참조).
  it("없다고 말한 것은 부른 것이 아니다", () => {
    assert.ok(!codesOf(report("네 명식에 도화는 없고, 홍염도 앉지 않았어.")).includes("GUARD-NAMED-TERM-ABSENT"));
  });
  it("게이지 이름은 명식의 글자가 아니다", () => {
    assert.ok(!codesOf(report("도화 지수 28, 은은한 잔향이야.")).includes("GUARD-NAMED-TERM-ABSENT"));
  });
  it("목차가 파는 이름은 물음을 받은 것이다", () => {
    const r = report("운명인지 도화인지 가려보자.", "3장 01. 새 인연의 실체 — 운명인가 도화인가");
    assert.ok(!codesOf(r).includes("GUARD-NAMED-TERM-ABSENT"));
  });
  it("있다고 부르면 여전히 잡는다", () => {
    assert.ok(codesOf(report("네 도화가 사람을 끌어당겨.")).includes("GUARD-NAMED-TERM-ABSENT"));
  });
});

describe("구조 용어", () => {
  it("다른 낱말의 일부는 잡지 않는다 — '다시 지켜'의 시지", () => {
    assert.equal(codesOf(report("다시 지켜보면 돼.")).filter((c) => c === "용어").length, 0);
  });
  it("낱말로 서 있으면 잡는다", () => {
    assert.ok(codesOf(report("시지에 앉은 글자가 말년을 말해.")).includes("용어"));
  });
});

describe("지수 되풀이", () => {
  it("셋째 절부터 되풀이로 본다 — 파는 절 하나면 된다", () => {
    const r = report("지수는 54야.", "1장 01. 검사", ["또 54야.", "다시 54야."]);
    assert.ok(codesOf(r, { scoreValue: 54 }).includes("GUARD-SCORE-REPEATED"));
    const ok = report("지수는 54야.", "1장 01. 검사", ["다른 말."]);
    assert.ok(!codesOf(ok, { scoreValue: 54 }).includes("GUARD-SCORE-REPEATED"));
  });
  it("다른 숫자의 일부는 세지 않는다 — 154, 540", () => {
    const r = report("154명이 그랬어.", "1장 01. 검사", ["540원.", "5400개."]);
    assert.ok(!codesOf(r, { scoreValue: 54 }).includes("GUARD-SCORE-REPEATED"));
  });
});
