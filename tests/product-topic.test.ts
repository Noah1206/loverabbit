import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, TOPIC_LABEL, TOPIC_ORDER } from "../src/lib/products";

// 주제는 상품표에만 있고 화면은 아직 쓰지 않는다 (목록 페이지는 2026-09-01
// 에 되돌렸다 — 운영자가 원한 것은 복붙용 목록이었다). 그래도 분류는 남긴다:
// 주제별로 링크를 뽑을 때 이 표가 정본이고, 빠진 상품은 그 목록에서 조용히
// 사라진다.
test("모든 사주가 이름 있는 주제를 갖는다", () => {
  for (const p of PRODUCTS) {
    assert.ok(TOPIC_LABEL[p.topic], `${p.id}: 이름 없는 주제 ${p.topic}`);
    assert.ok(TOPIC_ORDER.includes(p.topic), `${p.id}: TOPIC_ORDER 에 없는 주제라 목록을 뽑으면 빠진다`);
  }
});

test("주제로 훑으면 상품 수와 같다 — 빠지지도 겹치지도 않는다", () => {
  const drawn = TOPIC_ORDER.flatMap((t) => PRODUCTS.filter((p) => p.topic === t));
  assert.equal(drawn.length, PRODUCTS.length);
  assert.equal(new Set(drawn.map((p) => p.id)).size, PRODUCTS.length);
});

test("빈 주제를 두지 않는다", () => {
  for (const t of TOPIC_ORDER) {
    assert.ok(PRODUCTS.some((p) => p.topic === t), `${t}: 상품이 하나도 없는 주제`);
  }
});
