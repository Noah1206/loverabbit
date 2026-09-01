import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, TOPIC_LABEL, TOPIC_ORDER } from "../src/lib/products";

// /saju/list 는 TOPIC_ORDER 를 돌며 그 주제의 상품만 그린다. 주제가 목록에
// 빠져 있으면 그 상품으로 가는 길이 조용히 사라진다 — 화면에는 아무 표시도
// 안 난다. 그래서 여기서 센다.
test("모든 사주가 목록에 실제로 그려지는 주제를 갖는다", () => {
  for (const p of PRODUCTS) {
    assert.ok(TOPIC_LABEL[p.topic], `${p.id}: 이름 없는 주제 ${p.topic}`);
    assert.ok(TOPIC_ORDER.includes(p.topic), `${p.id}: TOPIC_ORDER 에 없는 주제라 목록에서 빠진다`);
  }
});

test("목록에 그려지는 장수가 상품 수와 같다 — 빠지지도 겹치지도 않는다", () => {
  const drawn = TOPIC_ORDER.flatMap((t) => PRODUCTS.filter((p) => p.topic === t));
  assert.equal(drawn.length, PRODUCTS.length);
  assert.equal(new Set(drawn.map((p) => p.id)).size, PRODUCTS.length);
});

test("빈 주제를 목록에 세워 두지 않는다", () => {
  for (const t of TOPIC_ORDER) {
    assert.ok(PRODUCTS.some((p) => p.topic === t), `${t}: 상품이 하나도 없는 주제`);
  }
});
