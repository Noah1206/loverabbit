// 그림이 들어갈 자리 — 장 맨 위가 아니라, 읽다가 지루해질 무렵.
//
// 절 개수로 세면 절이 900자일 때와 1,400자일 때 지치는 시점이 어긋난다.
// 그래서 글자 수로 센다. 이 규칙이 무너지면 그림이 첫 화면에 다시 올라온다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { __test } from "@/components/reading-art-slot";
import type { ReadingChapter } from "@/lib/reading-chapters";

const section = (chars: number) => ({
  order: 1,
  title: "제목",
  paragraphs: ["가".repeat(chars)],
  factsUsed: [] as string[],
  locked: false,
});

const chapter = (...sizes: number[]): ReadingChapter => ({
  number: 1,
  label: "1장",
  title: "장 제목",
  sections: sizes.map(section),
  kind: "main",
  locked: false,
});

const slot = __test.artSlotOf;

describe("읽은 양이 기준선을 넘는 절 뒤에 넣는다", () => {
  it("첫 절이 이미 길면 그 뒤", () => {
    // 절 하나가 1,200~1,500자인 지금 계약에서는 대개 이쪽이다
    assert.equal(slot(chapter(1400, 1400, 1400)), 0);
  });

  it("절이 짧으면 두 절을 읽은 뒤", () => {
    assert.equal(slot(chapter(800, 800, 800)), 1);
  });

  it("아주 짧은 절이 이어지면 더 뒤로 밀린다", () => {
    // 300 × 4 = 1,200 이 기준선(1,000)을 처음 넘는 지점
    assert.equal(slot(chapter(300, 300, 300, 300, 300)), 3);
  });

  it("절 하나가 지금 계약 길이(약 1,200자)면 그 절 뒤에 붙는다", () => {
    // 이게 실제로 가장 자주 나오는 모양이다
    assert.equal(slot(chapter(1200, 1200, 1200)), 0);
  });
});

describe("어떤 장이든 자리가 하나는 나온다", () => {
  it("기준선을 못 넘는 짧은 장은 맨 뒤", () => {
    assert.equal(slot(chapter(200, 200)), 1);
  });

  it("절이 하나뿐이어도 자리가 있다", () => {
    assert.equal(slot(chapter(2000)), 0);
  });

  it("자리는 언제나 절 범위 안이다", () => {
    for (const sizes of [[100], [100, 100], [5000, 10], [10, 5000], [1, 1, 1, 1]]) {
      const c = chapter(...sizes);
      const at = slot(c);
      assert.ok(at >= 0 && at < c.sections.length, `범위를 벗어났다: ${at} / ${sizes.length}`);
    }
  });
});

describe("맨 앞에는 놓지 않는다 — 읽기도 전에 나오면 안 된다", () => {
  it("절이 둘 이상이고 첫 절이 짧으면 첫 절 뒤가 아니다", () => {
    assert.notEqual(slot(chapter(100, 2000)), -1);
    assert.ok(slot(chapter(100, 2000)) >= 1, "너무 이르다");
  });
});
