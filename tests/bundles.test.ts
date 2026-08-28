import assert from "node:assert/strict";
import test from "node:test";

import { AD_OFFERS } from "../src/lib/ad-offers";
import { BUNDLES, bundleListPrice, bundleOfReading, bundleRest, resolveBundle } from "../src/lib/bundles";
import { FIRST_READING_PRICE, SECOND_READING_PRICE } from "../src/lib/coupons";
import { PRODUCTS, PRODUCT_MAP } from "../src/lib/products";

test("세트 값은 어느 단품 정가·광고 오퍼와도 겹치지 않는다 — category+price 가 세트 표시라서", () => {
  const productPrices = new Set(PRODUCTS.map((p) => p.price));
  const offerPrices = new Set(Object.values(AD_OFFERS).map((o) => o.price));
  for (const bundle of BUNDLES) {
    assert.ok(!productPrices.has(bundle.price), `${bundle.id} 값 ${bundle.price} 이 단품 정가와 겹친다`);
    assert.ok(!offerPrices.has(bundle.price), `${bundle.id} 값 ${bundle.price} 이 광고 오퍼와 겹친다`);
    assert.notEqual(bundle.price, FIRST_READING_PRICE);
    assert.notEqual(bundle.price, SECOND_READING_PRICE);
  }
});

test("세트의 모든 리딩은 실제 상품이고, first 는 items 안에 있다", () => {
  for (const bundle of BUNDLES) {
    for (const id of bundle.items) assert.ok(PRODUCT_MAP[id], `${bundle.id}: ${id} 는 상품이 아니다`);
    assert.ok(bundle.items.includes(bundle.first));
    assert.equal(bundleRest(bundle).length, bundle.items.length - 1);
    // 세트는 단품 합보다 싸야 세트다.
    assert.ok(bundle.price < bundleListPrice(bundle));
  }
});

test("세트는 first 카테고리로만 시작하고, 저장된 리딩은 값으로 되찾는다", () => {
  const love3 = BUNDLES[0];
  assert.equal(resolveBundle(love3.first, love3.id)?.id, love3.id);
  assert.equal(resolveBundle(bundleRest(love3)[0], love3.id), null);
  assert.equal(resolveBundle(love3.first, "nope"), null);
  assert.equal(bundleOfReading(love3.first, love3.price)?.id, love3.id);
  assert.equal(bundleOfReading(love3.first, PRODUCT_MAP[love3.first].price), null);
});
