// 상품이 파는 것과 코드가 아는 것이 어긋나지 않는지.
//
// 판매 문구는 사람이 고치고 계산은 코드가 한다. 둘은 서로를 모른다. 그래서
// "3년 흐름"이 문구에 붙은 채 여덟 달 동안 아무도 몰랐다. 여기서 문구를 읽어
// 상품이 선언한 길이와, 계산이 감당하는 길이 둘 다에 대조한다.
//
// 실패는 하나뿐이다 — **문구가 선언보다 긴 앞날을 말할 때.** 선언이 계산보다
// 긴 것은 실패가 아니라 알림이다. 그건 기획이 정할 일이고(약속을 줄일지 계산을
// 늘릴지), 테스트가 그 결정을 대신하면 안 된다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRODUCTS } from "@/lib/products";
import { promiseHorizonMonths } from "@/lib/reading-scope";
import { UPCOMING_MONTHS } from "@/lib/saju-facts";

/** 계산이 감당하는 길이. 앞달 + 다음 해. */
const COMPUTED = UPCOMING_MONTHS + 12;

/** 사람이 읽는 판매 문구 전부. 여기 없는 칸은 앞날을 약속하지 않는다고 본다. */
function promises(product: (typeof PRODUCTS)[number]): string[] {
  return [
    product.promptLabel,
    product.desc,
    product.sub,
    product.headline,
    product.cardCopy,
    ...product.keywords,
    ...product.principles.flat(),
    ...product.toc,
  ];
}

describe("상품 약속", () => {
  it("모든 상품이 정확히 한 번씩 있다", () => {
    const ids = PRODUCTS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 13, "상품 수가 바뀌었으면 이 숫자를 함께 고친다 — 몰래 늘거나 줄지 않게");
  });

  for (const product of PRODUCTS) {
    it(`${product.id}: 문구가 선언한 길이보다 긴 앞날을 팔지 않는다`, () => {
      const longest = Math.max(
        0,
        ...promises(product).map((text) => promiseHorizonMonths(text) ?? 0)
      );
      const declared = product.timeHorizonMonths ?? COMPUTED;
      assert.ok(
        longest <= declared,
        `${product.id} 문구가 ${longest}개월을 약속하는데 선언은 ${declared}개월이다. ` +
          `timeHorizonMonths 를 올리거나 문구를 줄인다.`
      );
    });
  }

  it("계산보다 긴 약속을 선언한 상품을 알린다", () => {
    const over = PRODUCTS.filter((p) => (p.timeHorizonMonths ?? 0) > COMPUTED);
    for (const p of over) {
      // 실패가 아니다. 좁혀서 나가고 있다는 사실을 눈에 보이게 둘 뿐이다.
      console.warn(
        `[약속>계산] ${p.id} 는 ${p.timeHorizonMonths}개월을 파는데 계산은 ${COMPUTED}개월 — ` +
          `reading-scope 가 좁혀서 내보낸다`
      );
    }
    // 2026-08-25 결혼의 "3년"을 첫 해로 줄여 지금은 하나도 없다. 생기면 여기 적고 이유를 남긴다.
    assert.deepEqual(over.map((p) => p.id), []);
  });
});
