import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCoupon,
  couponHeadline,
  couponPrice,
  couponSaving,
  couponState,
  pickBestCoupon,
  readOrderCoupon,
  FIRST_READING_PRICE,
  MIN_PAYABLE,
  PG_RESERVATION_MS,
  type Coupon,
} from "../src/lib/coupons";

const NOW = Date.parse("2026-08-26T12:00:00Z");
const day = 24 * 60 * 60 * 1000;

function coupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    kind: "referral",
    discount: 3000,
    fixedPrice: null,
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

test("가장 많이 깎이는 것을 고르고, 같으면 먼저 만료되는 것을 고른다", () => {
  const soon = coupon({ id: "soon", discount: 5000, expiresAt: new Date(NOW + day).toISOString() });
  const later = coupon({ id: "later", discount: 5000, expiresAt: new Date(NOW + 9 * day).toISOString() });
  const small = coupon({ id: "small", discount: 3000 });
  const used = coupon({ id: "used", discount: 9000, usedAt: new Date(NOW).toISOString() });
  assert.equal(pickBestCoupon([small, later, used, soon], 9900, NOW)?.id, "soon");
  assert.equal(pickBestCoupon([used], 9900, NOW), null);
});

// ── 가입 환영 쿠폰 = 첫 사주 990원 ──
// 값이 상품가에 따라 달라지므로, 여기서 틀리면 결제 금액이 틀린다.

const welcome = (over: Partial<Coupon> = {}) =>
  coupon({ id: "welcome", kind: "welcome", discount: null, fixedPrice: FIRST_READING_PRICE, ...over });

test("환영 쿠폰은 상품가가 얼마든 990원으로 만든다", () => {
  // 9,900 / 14,900 / 29,900 / 49,900 — 카탈로그의 티어 전부
  for (const price of [9900, 12900, 14900, 29900, 49900]) {
    assert.equal(couponPrice(price, welcome()), 1900, `${price}원 상품`);
    assert.equal(couponSaving(price, welcome()), price - 1900);
  }
});

test("환영 쿠폰이 값을 올리지는 않는다 - 광고로 이미 990원에 온 사람", () => {
  assert.equal(couponPrice(1900, welcome()), 1900);
  // 깎이는 게 없으므로 후보에서 빠진다. 넣으면 0원어치로 태운다.
  assert.equal(couponSaving(1900, welcome()), 0);
  assert.equal(pickBestCoupon([welcome()], 1900, NOW), null);
});

test("섞이면 쿠폰에 적힌 값이 아니라 이 상품에서 깎이는 금액으로 고른다", () => {
  const referral = coupon({ id: "referral", discount: 5000 });
  // 990원 쿠폰은 정가가 클수록 유리하다 - 49,900 에서 48,910원을 깎는다
  assert.equal(pickBestCoupon([referral, welcome()], 49900, NOW)?.id, "welcome");
  // 정액가가 높으면 할인 쿠폰이 이긴다. 12,900 에서 9,900 정액가는 3,000원,
  // 5,000원 할인은 5,000원을 깎는다.
  const weak = welcome({ id: "weak", fixedPrice: 9900 });
  assert.equal(pickBestCoupon([referral, weak], 12900, NOW)?.id, "referral");
});

test("쿠폰함에 적히는 값은 정액가와 할인을 구분한다", () => {
  assert.equal(couponHeadline(welcome()), "1,900원");
  assert.equal(couponHeadline(coupon({ discount: 5000 })), "5,000원");
});

test("주문 metadata 의 쿠폰 메모를 읽는다", () => {
  assert.equal(readOrderCoupon({}), null);
  assert.equal(readOrderCoupon({ coupon: "nope" }), null);
  assert.deepEqual(readOrderCoupon({ coupon: { id: "c1", kind: "referral", discount: 5000, listPrice: 9900 } }), {
    id: "c1",
    kind: "referral",
    discount: 5000,
    fixedPrice: null,
    listPrice: 9900,
  });
  // 환영 쿠폰 주문은 깎인 금액과 정액가를 함께 남긴다
  assert.deepEqual(
    readOrderCoupon({
      coupon: { id: "w1", kind: "welcome", discount: 48000, fixedPrice: 1900, listPrice: 49900 },
    }),
    { id: "w1", kind: "welcome", discount: 48000, fixedPrice: 1900, listPrice: 49900 }
  );
});
