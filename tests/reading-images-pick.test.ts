// 그림을 넣을 장 고르기 — 장이 늘어도 값이 따라 늘면 안 된다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { MAX_IMAGES, pickIllustrated } from "@/lib/reading-images";

const chapters = (n: number) => Array.from({ length: n }, (_, i) => ({ chapter: i + 1 }));

describe("장수를 고정한다", () => {
  it("장이 적으면 전부 넣는다", () => {
    assert.equal(pickIllustrated(chapters(3)).length, 3);
    assert.equal(pickIllustrated(chapters(5)).length, 5);
  });

  it("장이 많아도 상한을 넘지 않는다", () => {
    for (const n of [6, 9, 10, 15, 40]) {
      assert.equal(pickIllustrated(chapters(n)).length, MAX_IMAGES, `${n}장에서 어긋났다`);
    }
  });

  it("첫 장에는 반드시 들어간다 — 없으면 그림이 있는 줄도 모른다", () => {
    for (const n of [1, 3, 9, 15]) {
      assert.equal(pickIllustrated(chapters(n))[0].chapter, 1, `${n}장`);
    }
  });

  it("고르게 흩는다 — 앞쪽에 몰리지 않는다", () => {
    const picked = pickIllustrated(chapters(10)).map((c) => c.chapter);
    assert.deepEqual(picked, [1, 3, 5, 7, 9]);
  });

  it("고른 장은 원래 순서를 지키고 겹치지 않는다", () => {
    const picked = pickIllustrated(chapters(9)).map((c) => c.chapter);
    assert.deepEqual(picked, [...picked].sort((a, b) => a - b));
    assert.equal(new Set(picked).size, picked.length);
  });

  it("빈 목록에도 터지지 않는다", () => {
    assert.deepEqual(pickIllustrated([]), []);
  });
});
