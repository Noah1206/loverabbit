import assert from "node:assert/strict";
import test from "node:test";
import { AD_OFFERS } from "../src/lib/ad-offers";
import { PRODUCT_MAP } from "../src/lib/products";

test("광고 랜딩은 990원 오퍼를 유지하면서 실제 앱 상품으로 연결된다", () => {
  const cases = [
    {
      // 인연 타이밍은 올해의 연애운으로 합쳐졌다 (2026-08-24). 광고 주소와 오퍼
      // id 는 그대로 두고 파는 상품만 옮겼다 - 이 값이 이미 돌고 있는 메타 광고
      // URL 에 박혀 있어서다. 히어로는 상품 것을 그대로 쓰지 않고 "다음 인연"
      // 각도를 유지한다. 소재가 그 말로 데려오는데 도착지가 다른 말로 시작하면
      // 클릭과 화면이 어긋난다. 그 각도는 합쳐진 목차 4장(인연의 창·경로·윤곽)이
      // 실제로 감당한다.
      offerId: "romance_timing_990",
      route: "/saju/romance-timing",
      productId: "yeonae",
      productTitle: "올해의 연애운",
      heroFromProduct: false,
    },
    {
      offerId: "yeonae_990",
      route: "/product/yeonae",
      productId: "yeonae",
      productTitle: "올해의 연애운",
      heroFromProduct: true,
    },
    {
      offerId: "jaehoe_990",
      route: "/product/jaehoe",
      productId: "jaehoe",
      productTitle: "재회 사주",
      heroFromProduct: true,
    },
    {
      offerId: "inner_mind_990",
      route: "/saju/inner-mind",
      productId: "sseom",
      productTitle: "썸 사주",
      heroFromProduct: true,
    },
    {
      offerId: "breakup_decision_990",
      route: "/saju/breakup-decision",
      productId: "ibyeol",
      productTitle: "이별운 사주",
      heroFromProduct: true,
    },
    {
      offerId: "dohwasal_990",
      route: "/saju/dohwasal",
      productId: "dohwasal",
      productTitle: "도화살 사주",
      heroFromProduct: true,
    },
    {
      offerId: "baramgi_990",
      route: "/saju/baramgi",
      productId: "baramgi",
      productTitle: "바람기 사주",
      heroFromProduct: true,
    },
    {
      offerId: "mature_compatibility_990",
      route: "/saju/mature-compatibility",
      productId: "sokgunghap",
      productTitle: "속궁합 사주",
      heroFromProduct: true,
    },
  ] as const;

  for (const item of cases) {
    const offer = AD_OFFERS[item.offerId];
    assert.equal(offer.route, item.route);
    assert.equal(offer.price, 1900);
    assert.equal(offer.category, item.productId);
    const product = PRODUCT_MAP[offer.category];
    assert.equal(product?.title, item.productTitle);
    // 히어로를 상품에서 그대로 가져오는 랜딩과, 광고 각도를 따로 쓰는 랜딩이 있다.
    // 어느 쪽이든 파는 상품은 하나여야 한다 - 위의 category 검사가 그걸 본다.
    if (item.heroFromProduct) {
      assert.equal(offer.headline, product?.headline);
      assert.equal(offer.sub, product?.sub);
    } else {
      assert.ok(offer.headline.length > 0 && offer.sub.length > 0);
    }
  }
});
