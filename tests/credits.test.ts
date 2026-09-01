import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CREDIT_PACKS,
  KRW_PER_CREDIT,
  QUESTION_COST,
  FIRST_BUY_PACKS,
  isFirstBuyPack,
  listPriceOf,
  creditDepositorCode,
  getCreditPack,
  questionsLeft,
} from "../src/lib/credits";

describe("질문 크레딧", () => {
  it("환율과 단가 — 결정된 값이 코드 모르게 바뀌지 않는다", () => {
    assert.equal(KRW_PER_CREDIT, 1_000); // 2026-09-01: 100 → 1,000 (러빗 수를 1/10 로)
    assert.equal(QUESTION_COST, 1);
    // 무료 지급은 없다 (2026-08-30). 크레딧은 사야만 생긴다 —
    // 가입 트리거와 초대 클릭 보상을 마이그레이션에서 걷었다.
  });

  it("팩은 환율보다 비싸지 않다 — 작은 팩은 정직한 값, 큰 팩만 보너스", () => {
    for (const pack of CREDIT_PACKS) {
      assert.ok(pack.price <= pack.credits * KRW_PER_CREDIT, `${pack.id} 가 환율보다 비싸다`);
      assert.ok(Number.isInteger(pack.credits), `${pack.id} 의 러빗이 정수가 아니다`);
      assert.ok(pack.credits >= 1 && pack.credits <= 1000, "DB 승인 RPC 의 상한(1..1000) 안");
    }
    assert.equal(getCreditPack("credits-2")?.price, 1_900);
    assert.equal(getCreditPack("nope"), null);
  });

  it("남은 질문 수는 내림", () => {
    assert.equal(questionsLeft(3), 3);
    assert.equal(questionsLeft(2), 2);
    assert.equal(questionsLeft(0), 0);
    assert.equal(questionsLeft(-3), 0);
  });

  it("입금코드는 리딩 것과 앞글자가 다르다", () => {
    const code = creditDepositorCode("abc.def-GHI9");
    assert.ok(code.startsWith("크-"));
    assert.equal(code.length, "크-".length + 6);
  });
});

describe("충전 팩", () => {
  // 2026-09-01: 첫 구매 전용 표를 없애고 세 칸을 하나로 고정했다.
  // 누가 보든 같은 값이다 — 싸게 들어오게 하는 일은 사주 값(2·4·10러빗)이 한다.
  it("요청받은 세 가격 그대로다", () => {
    assert.deepEqual(
      CREDIT_PACKS.map((pack) => pack.price),
      [1_900, 4_900, 12_000]
    );
  });

  it("첫 구매자와 그 뒤 사람이 같은 표를 본다", () => {
    assert.deepEqual(FIRST_BUY_PACKS, CREDIT_PACKS);
  });

  it("비쌀수록 장당 단가가 내려간다 — 위 칸이 손해로 보여야 아래가 팔린다", () => {
    const perCredit = FIRST_BUY_PACKS.map((pack) => pack.price / pack.credits);
    for (let i = 1; i < perCredit.length; i += 1) {
      assert.ok(
        perCredit[i] < perCredit[i - 1],
        `${FIRST_BUY_PACKS[i].id} 의 장당 단가가 앞 칸보다 싸지 않다`
      );
    }
  });

  it("전부 정가보다 싸고, 러빗은 정수다", () => {
    for (const pack of CREDIT_PACKS) {
      assert.ok(pack.price < listPriceOf(pack), `${pack.id} 가 정가보다 싸지 않다`);
      assert.ok(Number.isInteger(pack.credits), `${pack.id} 의 러빗이 정수가 아니다`);
      assert.ok(pack.credits >= 1 && pack.credits <= 1000, "DB 승인 RPC 의 상한(1..1000) 안");
    }
  });

  // 한 번만 살 수 있는 팩이 없어졌다. 팩 목록으로 판정하던 자리를 그대로
  // 두면 이제 모든 팩이 "첫 구매 전용"이 되어 두 번째 충전이 통째로 막힌다.
  it("어떤 팩도 한 번 쓰고 잠기지 않는다", () => {
    for (const pack of CREDIT_PACKS) assert.ok(!isFirstBuyPack(pack.id), `${pack.id} 가 잠긴다`);
  });

  it("id 로 찾을 수 있다 — 결제 라우트가 이걸로 금액을 정한다", () => {
    for (const pack of CREDIT_PACKS) {
      assert.deepEqual(getCreditPack(pack.id), pack);
    }
  });
});

describe("리딩 크레딧 단가 (2026-08-31 단일 화폐)", () => {
  it("원화 정가를 환율로 접는다 — 9,900원 리딩은 10러빗", async () => {
    const { readingCreditCost } = await import("../src/lib/credits");
    assert.equal(readingCreditCost(9_900), 10);
    assert.equal(readingCreditCost(12_900), 13);
    assert.equal(readingCreditCost(19_900), 20);
    assert.equal(readingCreditCost(49_900), 50);
  });

  it("첫 구매 맛보기 팩이 첫 리딩을 연다 — 1,900원 훅이 러빗 세계에서도 산다", async () => {
    const { FIRST_BUY_PACKS, READING_SALE_CREDITS } = await import("../src/lib/credits");
    // 실제로 깎는 값(판매가)으로 한 장이 열려야 한다 — 정가가 아니라.
    assert.ok(FIRST_BUY_PACKS[0].credits >= READING_SALE_CREDITS, "맛보기 팩으로 한 장이 안 열린다");
    assert.equal(FIRST_BUY_PACKS[0].price, 1_900);
  });
});

describe("리딩 판매가 (2026-08-31 할인)", () => {
  it("단품 19 · 세트 39 — 표기와 차감이 이 상수 하나를 본다", async () => {
    const { READING_SALE_CREDITS, BUNDLE_SALE_CREDITS, saleCreditCost } = await import("../src/lib/credits");
    assert.equal(READING_SALE_CREDITS, 2); // 2러빗 = 2,000원 (환율 재조정 전 19러빗)
    assert.equal(saleCreditCost(false), READING_SALE_CREDITS);
    assert.equal(saleCreditCost(true), BUNDLE_SALE_CREDITS);
    // 세트는 세 장을 두 장 값 근처로 — 단품 셋보다 싸야 세트다
    assert.ok(BUNDLE_SALE_CREDITS < READING_SALE_CREDITS * 3);
    // 첫 구매 맛보기 팩(100크레딧)으로 다섯 장이 열린다
    assert.ok(100 >= READING_SALE_CREDITS * 5);
  });
});
