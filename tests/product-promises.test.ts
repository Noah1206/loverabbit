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

import fs from "node:fs";
import path from "node:path";

import { CARD_ART, PRODUCTS, displayTitle } from "@/lib/products";
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
    ...Object.values(product.reportFacets),
    ...product.toc,
  ];
}

describe("상품 약속", () => {
  it("모든 상품이 정확히 한 번씩 있다", () => {
    const ids = PRODUCTS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 23, "상품 수가 바뀌었으면 이 숫자를 함께 고친다 — 몰래 늘거나 줄지 않게");
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

// 카드 일러스트 표가 디스크와 어긋나지 않는지 (2026-09-09).
//
// 표를 손으로 세운 이유는 서버 컴포넌트(ProductSalesPage)가 이걸 읽기
// 때문이다 — 거기서 fs 를 뒤질 수 없다. 손으로 세운 표는 반드시 어긋나므로
// 양방향으로 잡는다: 표에 있는데 파일이 없으면 깨진 그림 표식이 나가고,
// 파일이 있는데 표에 없으면 그린 그림이 안 걸린다.
describe("카드 일러스트", () => {
  const DIR = path.join(process.cwd(), "public", "cards-pastel");

  it("표에 적힌 상품은 파일이 실제로 있다", () => {
    for (const id of CARD_ART) {
      assert.ok(
        fs.existsSync(path.join(DIR, `${id}.jpg`)),
        `${id}: CARD_ART 에 있는데 public/cards-pastel/${id}.jpg 가 없다`
      );
    }
  });

  it("파일이 있는 상품은 표에도 있다 — 그린 그림이 안 걸리면 안 된다", () => {
    for (const file of fs.readdirSync(DIR)) {
      if (!file.endsWith(".jpg")) continue;
      const id = file.replace(/\.jpg$/, "");
      // 상품이 아닌 파일(내린 랜딩용 등)은 표에 없어도 된다
      if (!PRODUCTS.some((p) => p.id === id)) continue;
      assert.ok(CARD_ART.has(id), `${id}: 파일은 있는데 CARD_ART 에 없다`);
    }
  });

  it("표에 적힌 것은 전부 실제 상품이다", () => {
    for (const id of CARD_ART) {
      assert.ok(PRODUCTS.some((p) => p.id === id), `${id} 는 상품이 아니다`);
    }
  });
});

// 목록에 적는 이름 (2026-09-09).
//
// 화면 이름과 표의 title 은 다른 값이다. title 은 리딩 라벨로도 가므로
// (route.ts 의 shortLabel 폴백), 둘이 섞이면 지난달에 산 리딩의 제목이
// 이번 달 이름으로 바뀐다.
describe("목록 이름", () => {
  it("꼬리의 \"사주\" 를 그대로 둔다", () => {
    // 한동안 뗐었다 (2026-09-09 오전) — 종목 안에서는 전부 사주라 정보를 안
    // 준다는 이유였다. 같은 날 오후에 되돌렸다: 목록 밖(검색 결과·홈)에서는
    // 그 두 글자가 무엇을 파는지 말하는 유일한 말이다.
    const p = PRODUCTS.find((x) => x.id === "jaemul");
    assert.ok(p);
    assert.ok(displayTitle(p).endsWith("사주"), "화면 이름에서 사주가 떨어졌다");

    // 표가 "사주" 로 끝나는 것은 전부 화면에서도 그대로 끝난다
    for (const q of PRODUCTS) {
      if (!/\s*사주$/.test(q.title)) continue;
      assert.ok(displayTitle(q).endsWith("사주"), `${q.id}: 화면 이름에서 사주가 떨어졌다`);
    }
  });

  it("표의 title 은 안 바뀐다", () => {
    // 화면 이름을 만든다고 원본이 바뀌면 저장된 리딩의 제목이 흔들린다.
    const before = PRODUCTS.map((p) => p.title);
    PRODUCTS.forEach((p) => displayTitle(p));
    assert.deepEqual(PRODUCTS.map((p) => p.title), before);
  });

  it("기간을 이미 말하는 상품에는 달을 안 붙인다", () => {
    const now = new Date("2026-09-09T12:00:00+09:00");
    for (const id of ["sinnyeon", "habangi", "yeonae", "idol"]) {
      const p = PRODUCTS.find((x) => x.id === id);
      assert.ok(p, `${id} 가 없다`);
      assert.ok(!/^\d+월/.test(displayTitle(p, now)), `${id}: 달이 붙었다`);
    }
  });

  it("나머지는 이번 달이 앞에 선다", () => {
    const now = new Date("2026-09-09T12:00:00+09:00");
    const p = PRODUCTS.find((x) => x.id === "jaemul");
    assert.ok(p);
    assert.equal(displayTitle(p, now), "9월 재물운 사주");
  });
});
