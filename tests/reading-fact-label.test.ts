// 근거 칩 — 근거가 사라지는 것이 최악이고, 내부 경로가 그대로 나가는 것이 그다음이다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { toFactChip } from "@/lib/reading-fact-label";

describe("경로를 사람 말로 바꾼다", () => {
  it("자기 힘", () => {
    const c = toFactChip("strength.label=신약");
    assert.equal(c.label, "자기 힘");
    assert.equal(c.value, "신약");
    assert.equal(c.gloss, "여린 편");
  });

  it("상대 명식은 앞에 '그 사람의' 가 붙는다", () => {
    const c = toFactChip("상대.strength.label=중화");
    assert.equal(c.label, "그 사람의 자기 힘");
    assert.equal(c.partner, true);
  });

  it("자리 코드는 그 자리가 뜻하는 것으로 바뀐다", () => {
    const c = toFactChip("상대.shinsal=화개=연지,월지");
    assert.equal(c.value.includes("뿌리 자리"), true);
    assert.equal(c.value.includes("사회 자리"), true);
    assert.equal(c.value.includes("연지"), false, "자리 코드가 남았다");
  });

  it("값 안의 등호는 줄표가 된다 — 경로로 오해되면 안 된다", () => {
    const c = toFactChip("xing=인사신 삼형(부분)=일지,연지");
    assert.equal(c.label, "타고난 형(刑)");
    assert.equal(c.value.includes("="), false, "등호가 남았다");
    assert.equal(c.value.includes("배우자 자리"), true);
  });

  it("여러 형이 세미콜론으로 붙어 와도 갈라진다", () => {
    const c = toFactChip("xing=인사신 삼형(부분)=일지,연지;축술미 삼형(부분)=월지,시지");
    assert.equal(c.value.includes(";"), false);
    assert.equal(c.value.includes("말년 자리"), true);
  });
});

describe("어떤 입력에도 근거를 버리지 않는다", () => {
  it("등호가 없으면 이름만 남긴다", () => {
    const c = toFactChip("strength.label");
    assert.equal(c.label, "자기 힘");
    assert.equal(c.value, "");
  });

  it("모르는 경로는 마지막 마디만 — 점 찍힌 원본을 내보내지 않는다", () => {
    const c = toFactChip("something.unknown.deep=값");
    assert.equal(c.label, "deep");
    assert.equal(c.value, "값");
  });

  it("빈 문자열도 터지지 않는다", () => {
    const c = toFactChip("");
    assert.equal(typeof c.label, "string");
    assert.equal(c.value, "");
  });

  it("풀이가 없으면 비워 둔다 — 모르는 말에 아무 설명이나 붙이지 않는다", () => {
    assert.equal(toFactChip("notableRelations=축미충,사신합").gloss, "");
  });

  it("자리 코드가 낱말 안에 들어 있으면 건드리지 않는다", () => {
    // '일지' 가 '일지매' 같은 낱말의 일부일 때 잘라먹으면 안 된다
    const c = toFactChip("notableRelations=일지매충");
    assert.equal(c.value, "일지매충");
  });
});
