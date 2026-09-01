import assert from "node:assert/strict";
import test from "node:test";
import { readingPriceForCount, saleCreditCost, BUNDLE_SALE_CREDITS } from "../src/lib/credits";

// 사주 한 장 값은 그 사람이 열어본 장수를 탄다 (2026-09-01 운영자).
// 이 표가 틀리면 화면과 결제창이 다른 값을 말하거나, 값을 덜 받는다.
test("사주 값은 열어본 장수에 따라 2 → 4 → 10 러빗으로 오른다", () => {
  assert.equal(readingPriceForCount(0), 2, "처음 여는 사람");
  assert.equal(readingPriceForCount(1), 4, "한 장 열어본 사람");
  assert.equal(readingPriceForCount(2), 10, "두 장 열어본 사람");
});

test("세 장을 넘겨도 10러빗에서 멈춘다", () => {
  for (const n of [3, 7, 100]) assert.equal(readingPriceForCount(n), 10, `${n}장 열어본 사람`);
});

test("음수나 이상한 값이 와도 표 밖으로 나가지 않는다", () => {
  assert.equal(readingPriceForCount(-1), 2);
  assert.equal(readingPriceForCount(Number.NaN), 2);
});

test("세트는 장수와 무관하게 세트 값 하나다", () => {
  for (const n of [0, 1, 5]) assert.equal(saleCreditCost(true, n), BUNDLE_SALE_CREDITS);
});

test("장수를 안 넘기면 첫 장 값이 나온다 — 서버는 반드시 실제 장수를 넘겨야 한다", () => {
  assert.equal(saleCreditCost(false), 2);
  assert.equal(saleCreditCost(false, 2), 10);
});
