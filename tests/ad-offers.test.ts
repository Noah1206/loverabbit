import assert from "node:assert/strict";
import test from "node:test";
import { AD_OFFERS } from "../src/lib/ad-offers";
import { PRODUCT_MAP } from "../src/lib/products";

test("광고 랜딩은 990원 오퍼를 유지하면서 실제 앱 상품으로 연결된다", () => {
  const cases = [
    {
      offerId: "romance_timing_990",
      route: "/saju/romance-timing",
      productId: "insun",
      productTitle: "인연 타이밍",
    },
    {
      offerId: "yeonae_990",
      route: "/product/yeonae",
      productId: "yeonae",
      productTitle: "올해의 연애운",
    },
    {
      offerId: "inner_mind_990",
      route: "/saju/inner-mind",
      productId: "sseom",
      productTitle: "썸 해부 사주",
    },
    {
      offerId: "breakup_decision_990",
      route: "/saju/breakup-decision",
      productId: "ibyeol",
      productTitle: "이별 부검 리포트",
    },
    {
      offerId: "dohwasal_990",
      route: "/saju/dohwasal",
      productId: "dohwasal",
      productTitle: "도화살 진단",
    },
    {
      offerId: "mature_compatibility_990",
      route: "/saju/mature-compatibility",
      productId: "sokgunghap",
      productTitle: "속궁합 사주",
    },
  ] as const;

  for (const item of cases) {
    const offer = AD_OFFERS[item.offerId];
    assert.equal(offer.route, item.route);
    assert.equal(offer.price, 990);
    assert.equal(offer.category, item.productId);
    const product = PRODUCT_MAP[offer.category];
    assert.equal(product?.title, item.productTitle);
    assert.equal(offer.headline, product?.headline);
    assert.equal(offer.sub, product?.sub);
  }
});
