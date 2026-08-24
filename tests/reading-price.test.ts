// 값을 정하는 자리.
//
// 화면이 990원을 말하는 것과 **주문서에 990원이 적히는 것**은 다른 사건이다.
// 광고 점검 스크립트(scripts/verify-ad-offers.mjs)는 앞의 것만 본다 - 리딩을
// 만드는 데까지 가지 않고 값이 붙는 지점까지만 보기 때문이다. 그래서 화면이
// 멀쩡한 채로 주문 금액만 틀리면 아무도 못 잡는다.
//
// priceFor 가 그 경계다. api/reading 이 이걸로 리딩의 price 를 정하고,
// api/checkout 이 그 price 를 그대로 토스에 넘긴다. 여기가 틀리면 값이 틀린다.
//
// 지금까지 이 함수에는 테스트가 하나도 없었다.

import assert from "node:assert/strict";
import test from "node:test";

import { priceFor } from "@/lib/store";
import { AD_OFFERS } from "@/lib/ad-offers";
import { PRODUCT_MAP } from "@/lib/products";

test("오퍼가 없으면 정가다 — 광고를 안 거친 사람이 여기로 온다", () => {
  for (const offer of Object.values(AD_OFFERS)) {
    const list = PRODUCT_MAP[offer.category]!.price;
    assert.equal(priceFor(offer.category), list);
    assert.equal(priceFor(offer.category, null), list);
    assert.equal(priceFor(offer.category, undefined), list);
    assert.equal(priceFor(offer.category, ""), list);
  }
});

test("그 상품의 오퍼를 달고 오면 990원이다", () => {
  for (const offer of Object.values(AD_OFFERS)) {
    assert.equal(priceFor(offer.category, offer.id), 990);
  }
});

test("다른 상품의 오퍼는 안 먹는다 — offer id 는 주소에 드러나는 공개값이다", () => {
  const offers = Object.values(AD_OFFERS);
  for (const offer of offers) {
    for (const other of offers) {
      if (other.category === offer.category) continue;
      // yeonae 에 breakup_decision_990 을 붙이는 식. 정가로 떨어져야 한다.
      assert.equal(
        priceFor(offer.category, other.id),
        PRODUCT_MAP[offer.category]!.price,
        `${offer.category} 에 ${other.id} 가 먹혔다`
      );
    }
  }
});

test("없는 오퍼를 지어내도 정가다", () => {
  assert.equal(priceFor("dohwasal", "dohwasal_100"), PRODUCT_MAP.dohwasal!.price);
  assert.equal(priceFor("dohwasal", "__proto__"), PRODUCT_MAP.dohwasal!.price);
  assert.equal(priceFor("dohwasal", "constructor"), PRODUCT_MAP.dohwasal!.price);
});

test("오퍼 값이 상품 정가보다 싸다 — 할인이 아니면 오퍼를 둘 이유가 없다", () => {
  for (const offer of Object.values(AD_OFFERS)) {
    const list = PRODUCT_MAP[offer.category]!.price;
    assert.ok(offer.price < list, `${offer.id} 가 정가(${list})보다 싸지 않다`);
  }
});
