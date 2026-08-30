import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QUESTION_COST } from "../src/lib/credits";
import { askBlock, canAsk } from "../src/lib/question-gate";

const base = { signedIn: true, hasProfile: true, balance: 100 };

describe("질문 판매 조건", () => {
  it("셋 다 갖추면 물을 수 있다", () => {
    assert.equal(askBlock(base), null);
    assert.ok(canAsk(base));
  });

  it("로그인이 먼저다", () => {
    assert.equal(askBlock({ ...base, signedIn: false, hasProfile: false, balance: 0 }), "signup");
  });

  // 이 서비스가 팔기로 한 것은 "내 명식으로 본 답" 이다. 명식이 없으면
  // 크레딧이 있어도 팔지 않는다.
  it("명식이 없으면 잔액이 넉넉해도 막는다", () => {
    assert.equal(askBlock({ ...base, hasProfile: false }), "profile");
    assert.ok(!canAsk({ ...base, hasProfile: false }));
  });

  it("명식을 잔액보다 먼저 본다 — 충전하고 또 막히면 안 된다", () => {
    assert.equal(askBlock({ signedIn: true, hasProfile: false, balance: 0 }), "profile");
  });

  it("잔액이 한 번 값에 못 미치면 막는다", () => {
    assert.equal(askBlock({ ...base, balance: QUESTION_COST - 1 }), "credits");
    assert.equal(askBlock({ ...base, balance: QUESTION_COST }), null);
  });
});
