import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCoupon,
  couponState,
  pickBestCoupon,
  readOrderCoupon,
  MIN_PAYABLE,
  PG_RESERVATION_MS,
  type Coupon,
} from "../src/lib/coupons";

const NOW = Date.parse("2026-08-26T12:00:00Z");
const day = 24 * 60 * 60 * 1000;

function coupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    kind: "welcome",
    discount: 3000,
    expiresAt: new Date(NOW + 10 * day).toISOString(),
    usedAt: null,
    reservedAt: null,
    reservedOrder: null,
    ...over,
  };
}

test("새 쿠폰은 쓸 수 있고, 만료·사용된 쿠폰은 못 쓴다", () => {
  assert.equal(couponState(coupon(), NOW), "available");
  assert.equal(couponState(coupon({ expiresAt: new Date(NOW - 1).toISOString() }), NOW), "expired");
  assert.equal(couponState(coupon({ usedAt: new Date(NOW).toISOString() }), NOW), "used");
});

test("계좌이체 주문에 붙은 쿠폰은 승인이 날 때까지 붙들려 있다", () => {
  const reserved = coupon({
    reservedAt: new Date(NOW - 3 * day).toISOString(),
    reservedOrder: { status: "pending", method: "transfer", createdAt: new Date(NOW - 3 * day).toISOString() },
  });
  assert.equal(couponState(reserved, NOW), "reserved");
});

test("PG 주문은 30분이 지나면 쿠폰을 놓아 준다 - 결제창만 열고 나간 사람", () => {
  const fresh = coupon({
    reservedAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
    reservedOrder: { status: "pending", method: "portone-pg", createdAt: "" },
  });
  assert.equal(couponState(fresh, NOW), "reserved");
  const stale = coupon({
    reservedAt: new Date(NOW - PG_RESERVATION_MS - 1).toISOString(),
    reservedOrder: { status: "pending", method: "portone-pg", createdAt: "" },
  });
  assert.equal(couponState(stale, NOW), "available");
});

test("취소된 주문의 쿠폰은 다시 쓸 수 있고, 결제된 주문의 쿠폰은 끝이다", () => {
  const base = { reservedAt: new Date(NOW - day).toISOString() };
  assert.equal(
    couponState(coupon({ ...base, reservedOrder: { status: "cancelled", method: "transfer", createdAt: "" } }), NOW),
    "available"
  );
  assert.equal(
    couponState(coupon({ ...base, reservedOrder: { status: "paid", method: "transfer", createdAt: "" } }), NOW),
    "used"
  );
});

test("할인은 바닥 아래로 내려가지 않는다", () => {
  assert.equal(applyCoupon(9900, 3000), 6900);
  assert.equal(applyCoupon(9900, 5000), 4900);
  assert.equal(applyCoupon(2000, 5000), MIN_PAYABLE);
  assert.equal(applyCoupon(0, 5000), 0);
});

test("가장 큰 할인을 고르고, 같으면 먼저 만료되는 것을 고른다", () => {
  const soon = coupon({ id: "soon", discount: 5000, kind: "referral", expiresAt: new Date(NOW + day).toISOString() });
  const later = coupon({ id: "later", discount: 5000, kind: "referral", expiresAt: new Date(NOW + 9 * day).toISOString() });
  const small = coupon({ id: "small", discount: 3000 });
  const used = coupon({ id: "used", discount: 9000, usedAt: new Date(NOW).toISOString() });
  assert.equal(pickBestCoupon([small, later, used, soon], NOW)?.id, "soon");
  assert.equal(pickBestCoupon([used], NOW), null);
});

test("주문 metadata 의 쿠폰 메모를 읽는다", () => {
  assert.equal(readOrderCoupon({}), null);
  assert.equal(readOrderCoupon({ coupon: "nope" }), null);
  assert.deepEqual(readOrderCoupon({ coupon: { id: "c1", kind: "referral", discount: 5000, listPrice: 9900 } }), {
    id: "c1",
    kind: "referral",
    discount: 5000,
    listPrice: 9900,
  });
});
