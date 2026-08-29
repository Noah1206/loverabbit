import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CREDIT_PACKS,
  KRW_PER_CREDIT,
  QUESTION_COST,
  SIGNUP_CREDITS,
  REFERRAL_CLICK_CREDITS,
  creditDepositorCode,
  getCreditPack,
  questionsLeft,
} from "../src/lib/credits";

describe("질문 크레딧", () => {
  it("환율과 단가 — 결정된 값이 코드 모르게 바뀌지 않는다", () => {
    assert.equal(KRW_PER_CREDIT, 100);
    assert.equal(QUESTION_COST, 5);
    assert.equal(SIGNUP_CREDITS, QUESTION_COST * 3);
    assert.equal(REFERRAL_CLICK_CREDITS, QUESTION_COST);
  });

  it("팩은 환율보다 비싸지 않다 — 작은 팩은 정직한 값, 큰 팩만 보너스", () => {
    for (const pack of CREDIT_PACKS) {
      assert.ok(pack.price <= pack.credits * KRW_PER_CREDIT, `${pack.id} 가 환율보다 비싸다`);
      assert.ok(pack.credits % QUESTION_COST === 0, `${pack.id} 는 질문 단위로 떨어지지 않는다`);
      assert.ok(pack.credits >= 1 && pack.credits <= 1000, "DB 승인 RPC 의 상한(1..1000) 안");
    }
    assert.equal(getCreditPack("credits-50")?.price, 5_000);
    assert.equal(getCreditPack("nope"), null);
  });

  it("남은 질문 수는 내림", () => {
    assert.equal(questionsLeft(15), 3);
    assert.equal(questionsLeft(14), 2);
    assert.equal(questionsLeft(0), 0);
    assert.equal(questionsLeft(-3), 0);
  });

  it("입금코드는 리딩 것과 앞글자가 다르다", () => {
    const code = creditDepositorCode("abc.def-GHI9");
    assert.ok(code.startsWith("크-"));
    assert.equal(code.length, "크-".length + 6);
  });
});
