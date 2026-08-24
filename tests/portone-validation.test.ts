import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PortOnePaymentError,
  validatePortOneTransferPayment,
} from "@/lib/portone-validation";

const expected = {
  paymentId: "LRP_test123",
  storeId: "store-test",
  channelKey: "channel-test",
  amount: 9900,
};

function paidPayment() {
  return {
    status: "PAID",
    id: expected.paymentId,
    storeId: expected.storeId,
    currency: "KRW",
    amount: { total: expected.amount },
    method: { type: "PaymentMethodTransfer" },
    channel: { key: expected.channelKey, pgProvider: "INICIS_V2" },
  };
}

describe("포트원 KG이니시스 계좌이체 검증", () => {
  it("서버 주문과 일치하는 완료 결제만 승인한다", () => {
    assert.doesNotThrow(() => validatePortOneTransferPayment(paidPayment(), expected));
  });

  it("브라우저에서 금액을 바꾼 결제를 거절한다", () => {
    const payment = paidPayment();
    payment.amount.total = 100;
    assert.throws(
      () => validatePortOneTransferPayment(payment, expected),
      (error: unknown) =>
        error instanceof PortOnePaymentError && error.code === "PAYMENT_AMOUNT_MISMATCH"
    );
  });

  it("다른 PG 또는 결제수단을 거절한다", () => {
    const payment = paidPayment();
    payment.method.type = "PaymentMethodCard";
    assert.throws(
      () => validatePortOneTransferPayment(payment, expected),
      (error: unknown) =>
        error instanceof PortOnePaymentError && error.code === "PAYMENT_METHOD_MISMATCH"
    );
  });

  it("완료 전 상태를 지급하지 않는다", () => {
    const payment = paidPayment();
    payment.status = "PAY_PENDING";
    assert.throws(
      () => validatePortOneTransferPayment(payment, expected),
      (error: unknown) =>
        error instanceof PortOnePaymentError && error.code === "PAYMENT_NOT_PAID"
    );
  });
});
