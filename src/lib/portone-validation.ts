export class PortOnePaymentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "PortOnePaymentError";
  }
}

interface PortOnePaymentLike {
  status?: unknown;
  id?: unknown;
  storeId?: unknown;
  currency?: unknown;
  amount?: { total?: unknown } | null;
  method?: { type?: unknown } | null;
  channel?: { key?: unknown; pgProvider?: unknown } | null;
}

export interface PortOnePaymentExpectation {
  paymentId: string;
  storeId: string;
  channelKey: string;
  amount: number;
}

/**
 * 포트원 조회 결과와 서버 주문을 대조한다. 브라우저의 성공 응답이나 금액은
 * 결제 확정 근거로 사용하지 않는다.
 */
export function validatePortOneTransferPayment(
  payment: PortOnePaymentLike,
  expected: PortOnePaymentExpectation
): void {
  if (payment.status !== "PAID") {
    throw new PortOnePaymentError(
      "아직 결제가 완료되지 않았어요. 잠시 후 다시 확인해주세요.",
      409,
      "PAYMENT_NOT_PAID"
    );
  }
  if (payment.id !== expected.paymentId || payment.storeId !== expected.storeId) {
    throw new PortOnePaymentError(
      "결제 상점 또는 주문 정보가 일치하지 않아요.",
      400,
      "PAYMENT_IDENTITY_MISMATCH"
    );
  }
  if (payment.currency !== "KRW" || payment.amount?.total !== expected.amount) {
    throw new PortOnePaymentError(
      "서버 주문과 실제 결제 금액이 일치하지 않아요.",
      400,
      "PAYMENT_AMOUNT_MISMATCH"
    );
  }
  if (payment.method?.type !== "PaymentMethodTransfer") {
    throw new PortOnePaymentError(
      "실시간 계좌이체 결제 건이 아니에요.",
      400,
      "PAYMENT_METHOD_MISMATCH"
    );
  }
  if (payment.channel?.pgProvider !== "INICIS_V2") {
    throw new PortOnePaymentError(
      "KG이니시스 V2 채널 결제 건이 아니에요.",
      400,
      "PAYMENT_PROVIDER_MISMATCH"
    );
  }
  if (payment.channel.key !== undefined && payment.channel.key !== expected.channelKey) {
    throw new PortOnePaymentError(
      "결제 채널이 일치하지 않아요.",
      400,
      "PAYMENT_CHANNEL_MISMATCH"
    );
  }
}
