import assert from "node:assert/strict";
import { test } from "node:test";

import { gateDecision } from "../src/lib/reading-gate-redirect";

// 이 파일이 지키는 것은 하나다: 돈을 낸 사람은 결제 화면으로 가지 않는다.

test("묻기 전에는 아무 데도 보내지 않는다", () => {
  assert.equal(
    gateDecision({ hasFull: false, paidUnlocked: false, unlockChecked: false }).kind,
    "stay"
  );
  // 승인 대기 주문이 있어도 마찬가지다 — 답을 듣기 전에 가르면 안 된다.
  assert.equal(
    gateDecision({ hasFull: false, paidUnlocked: false, unlockChecked: false, pendingOrderId: 7 }).kind,
    "stay"
  );
});

test("본문이 있으면 읽는 중이다", () => {
  assert.equal(
    gateDecision({ hasFull: true, paidUnlocked: false, unlockChecked: true }).kind,
    "stay"
  );
});

// 이 서비스가 실제로 겪은 고장. 승인 라우트에 maxDuration 이 없어 승인 직후
// 생성이 잘렸고, 본문이 빈 리딩이 남았다. 그때 이 판단이 checkout 을 내면
// 이미 돈을 낸 사람이 결제 화면을 다시 본다.
test("승인은 났는데 본문이 아직이면 그 자리에 둔다 (두 번 내라고 하지 않는다)", () => {
  assert.equal(
    gateDecision({ hasFull: false, paidUnlocked: true, unlockChecked: true }).kind,
    "stay"
  );
  // 승인 전에 붙어 있던 주문 번호가 남아 있어도 결제/대기로 보내지 않는다.
  assert.equal(
    gateDecision({ hasFull: false, paidUnlocked: true, unlockChecked: true, pendingOrderId: 12 }).kind,
    "stay"
  );
});

test("승인 대기 중이면 대기 화면이 제자리다", () => {
  assert.deepEqual(
    gateDecision({ hasFull: false, paidUnlocked: false, unlockChecked: true, pendingOrderId: 42 }),
    { kind: "pending", orderId: 42 }
  );
});

test("아직 안 산 리딩만 결제 화면으로 간다", () => {
  assert.equal(
    gateDecision({ hasFull: false, paidUnlocked: false, unlockChecked: true }).kind,
    "checkout"
  );
});
