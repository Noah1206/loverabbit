import assert from "node:assert/strict";
import test from "node:test";
import { CREDIT_PACKS, CREDIT_EVENT, bonusOf } from "../src/lib/credits";

/*
  보너스 러빗 이벤트.

  지급은 주문 메타데이터의 credits 를 DB 함수가 읽어서 한다
  (lr_complete_chat_credit_order). 즉 CREDIT_PACKS 의 credits 가 곧 지급액이라,
  이 값이 틀리면 돈을 받고 다른 수를 준다.
*/

test("팩마다 값과 러빗이 양수다", () => {
  for (const p of CREDIT_PACKS) {
    assert.ok(p.credits > 0, `${p.id} 의 러빗이 0 이하`);
    assert.ok(p.price > 0, `${p.id} 의 값이 0 이하`);
  }
});

test("보너스는 원래 수보다 많을 때만 잡힌다", () => {
  for (const p of CREDIT_PACKS) {
    if (p.baseCredits === undefined) {
      assert.equal(bonusOf(p), 0, `${p.id} 는 이벤트가 아닌데 보너스가 있다`);
      continue;
    }
    assert.ok(
      p.credits > p.baseCredits,
      `${p.id}: 지급(${p.credits})이 원래(${p.baseCredits})보다 적거나 같다`
    );
    assert.equal(bonusOf(p), p.credits - p.baseCredits);
  }
});

test("값이 오를수록 러빗당 값이 싸진다 — 큰 칸이 이득이어야 한다", () => {
  const sorted = [...CREDIT_PACKS].sort((a, b) => a.price - b.price);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1].price / sorted[i - 1].credits;
    const cur = sorted[i].price / sorted[i].credits;
    assert.ok(
      cur < prev,
      `${sorted[i].id} 의 러빗당 값(${Math.round(cur)}원)이 ${sorted[i - 1].id}(${Math.round(prev)}원)보다 비싸다`
    );
  }
});

test("이벤트 문구가 있으면 보너스가 실제로 붙어 있다", () => {
  // 문구만 있고 러빗이 그대로면 거짓 광고가 된다.
  if (!CREDIT_EVENT) return;
  const withBonus = CREDIT_PACKS.filter((p) => bonusOf(p) > 0);
  assert.ok(withBonus.length > 0, "이벤트 문구는 있는데 보너스 팩이 하나도 없다");
});

test("보너스가 붙은 팩이 없으면 이벤트 문구도 없어야 한다", () => {
  const withBonus = CREDIT_PACKS.filter((p) => bonusOf(p) > 0);
  if (withBonus.length === 0) {
    assert.equal(CREDIT_EVENT, null, "보너스가 없는데 이벤트 문구가 남아 있다");
  }
});

test("이벤트 종료일이 날짜 모양이다", () => {
  if (!CREDIT_EVENT) return;
  assert.match(CREDIT_EVENT.until, /^\d{4}-\d{2}-\d{2}$/);
});

test("타로 선물은 타로 한 번 값과 같다", async () => {
  // "타로 한 번 무료" 라고 말하려면 그만큼이어야 한다. 값이 어긋나면
  // 선물을 받아도 타로를 못 뽑거나, 필요 이상으로 주게 된다.
  const { TAROT_COST, TAROT_GIFT_CREDITS } = await import("../src/lib/credits");
  if (TAROT_GIFT_CREDITS === 0) return; // 이벤트를 끈 상태
  assert.equal(
    TAROT_GIFT_CREDITS,
    TAROT_COST,
    `선물(${TAROT_GIFT_CREDITS})과 타로 값(${TAROT_COST})이 다르다`
  );
});

test("원장 사유 이름과 라벨이 짝을 이룬다", async () => {
  // 라벨이 빠지면 /my 의 러빗 내역에 빈 줄이 나온다.
  const { CREDIT_REASON_LABEL } = await import("../src/lib/credits");
  for (const [reason, label] of Object.entries(CREDIT_REASON_LABEL)) {
    assert.ok(label && label.length > 1, `${reason} 의 라벨이 비었다`);
  }
  assert.ok(CREDIT_REASON_LABEL.tarot, "tarot 라벨이 없다");
  assert.ok(CREDIT_REASON_LABEL.tarot_gift, "tarot_gift 라벨이 없다");
});
