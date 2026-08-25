import "server-only";

import { PaymentClient } from "@portone/server-sdk";

import {
  completeChatCreditOrder,
  createOrder,
  getOrderByProviderOrderId,
  settleCouponsForOrder,
  getReferralStatus,
  type DatabaseOrder,
  type OrderKind,
} from "@/lib/database";
import {
  PortOnePaymentError,
  validatePortOneTransferPayment,
} from "@/lib/portone-validation";
import { markUnlocked } from "@/lib/store";
import { reportApprovedPurchase } from "@/lib/purchase-conversion";

const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface PortOneServerConfig {
  storeId: string;
  channelKey: string;
  apiSecret: string;
}

export function getPortOneServerConfig(): PortOneServerConfig | null {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? "";
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() ?? "";
  const apiSecret = process.env.PORTONE_API_SECRET?.trim() ?? "";
  return storeId && channelKey && apiSecret ? { storeId, channelKey, apiSecret } : null;
}

export function hasAnyPortOneServerSetting(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ||
      process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() ||
      process.env.PORTONE_API_SECRET?.trim()
  );
}

interface FinalizeExpectation {
  userId?: number;
  kind?: Extract<OrderKind, "reading" | "chat_credits">;
  readingId?: string;
}

export interface FinalizedPortOneOrder {
  paymentId: string;
  userId: number;
  kind: Extract<OrderKind, "reading" | "chat_credits">;
  readingId: string | null;
  amount: number;
  creditsRemaining?: number;
  alreadyPaid: boolean;
}

function assertExpectedOrder(order: DatabaseOrder, expected: FinalizeExpectation): void {
  if (order.method !== "portone-pg") {
    throw new PortOnePaymentError("포트원 결제 주문이 아니에요.", 400, "ORDER_METHOD_MISMATCH");
  }
  if (order.kind !== "reading" && order.kind !== "chat_credits") {
    throw new PortOnePaymentError("지원하지 않는 결제 상품이에요.", 400, "ORDER_KIND_MISMATCH");
  }
  if (expected.userId !== undefined && order.userId !== expected.userId) {
    throw new PortOnePaymentError("이 결제를 확인할 권한이 없어요.", 403, "ORDER_OWNER_MISMATCH");
  }
  if (expected.kind && order.kind !== expected.kind) {
    throw new PortOnePaymentError("결제 상품 정보가 일치하지 않아요.", 400, "ORDER_KIND_MISMATCH");
  }
  if (expected.readingId && order.readingId !== expected.readingId) {
    throw new PortOnePaymentError("결제 리딩 정보가 일치하지 않아요.", 400, "ORDER_READING_MISMATCH");
  }
  if (order.status !== "pending" && order.status !== "paid") {
    throw new PortOnePaymentError("처리할 수 없는 주문 상태예요.", 409, "ORDER_STATUS_INVALID");
  }
}

/**
 * 포트원 API에서 결제를 다시 조회한 뒤 주문 권리를 반영한다. 웹훅과 결제 완료
 * 화면이 동시에 호출해도 리딩 해금은 멱등이고, 대화권은 DB RPC가 한 번만 지급한다.
 */
export async function finalizePortOnePayment(
  paymentId: string,
  expected: FinalizeExpectation = {}
): Promise<FinalizedPortOneOrder> {
  if (!PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new PortOnePaymentError("결제 번호 형식이 올바르지 않아요.", 400, "INVALID_PAYMENT_ID");
  }
  const config = getPortOneServerConfig();
  if (!config) {
    throw new PortOnePaymentError(
      "포트원 결제 설정이 완료되지 않았어요.",
      503,
      "PORTONE_NOT_CONFIGURED"
    );
  }

  const order = await getOrderByProviderOrderId(paymentId);
  if (!order) {
    throw new PortOnePaymentError("서버에서 결제 주문을 찾지 못했어요.", 404, "ORDER_NOT_FOUND");
  }
  assertExpectedOrder(order, expected);

  const payment = await PaymentClient({ secret: config.apiSecret }).getPayment({
    paymentId,
    storeId: config.storeId,
  });
  validatePortOneTransferPayment(payment, {
    paymentId,
    storeId: config.storeId,
    channelKey: config.channelKey,
    amount: order.amount,
  });
  // validatePortOneTransferPayment가 런타임 검증을 마쳤고, 이 분기는 SDK의
  // 판별 유니온을 PaidPayment로 좁혀 아래 결제 완료 필드를 안전하게 사용한다.
  if (payment.status !== "PAID") {
    throw new PortOnePaymentError("결제가 완료되지 않았어요.", 409, "PAYMENT_NOT_PAID");
  }

  const alreadyPaid = order.status === "paid";
  if (order.kind === "reading") {
    if (!order.readingId) {
      throw new PortOnePaymentError("결제 리딩을 찾지 못했어요.", 404, "READING_NOT_FOUND");
    }
    if (!alreadyPaid) {
      const paidOrderId = await createOrder({
        userId: order.userId,
        readingId: order.readingId,
        kind: "reading",
        method: "portone-pg",
        status: "paid",
        amount: order.amount,
        providerOrderId: paymentId,
        metadata: {
          ...order.metadata,
          portone_transaction_id: payment.transactionId,
          portone_pg_tx_id: payment.pgTxId ?? null,
          portone_receipt_url: payment.receiptUrl ?? null,
          portone_paid_at: payment.paidAt,
        },
      });
      // 결제창에서 붙인 쿠폰은 돈이 실제로 들어온 지금 소진된다.
      if (paidOrderId) await settleCouponsForOrder(paidOrderId, "paid");
    }
    const unlocked = await markUnlocked(
      order.readingId,
      { method: "portone-pg", at: payment.paidAt },
      order.userId
    );
    if (!unlocked) {
      throw new PortOnePaymentError("결제 리딩을 찾지 못했어요.", 404, "READING_NOT_FOUND");
    }
    /*
      전환은 여기서 나간다.

      이 함수는 두 길에서 불린다 — 결제 후 돌아온 브라우저와, 돌아오지 않았을
      때를 받아내는 웹훅이다. 완료 화면에만 전환을 걸어 두면 브라우저가 안
      돌아온 결제는 통째로 빠진다. 여기 두면 어느 길로 끝나든 한 번은 나간다.

      alreadyPaid 가 이 호출이 실제로 결제를 완료시켰는지 알려준다. 두 길이
      겹치면 진 쪽은 true 를 받으므로, false 일 때만 보내면 두 번 나가지 않는다.
      그래도 event_id 는 결제 번호에서 만들어, 완료 화면의 픽셀과도 한 건으로
      합쳐지게 해 둔다.

      await 한다 — 응답 뒤에는 함수가 얼어 전송이 사라진다. 실패해도 결제는
      그대로 둔다.
    */
    if (!alreadyPaid) {
      const conversion = await reportApprovedPurchase(paymentId);
      if (!conversion.sent) {
        console.log(`[전환] 포트원 ${paymentId} 전환 미전송: ${conversion.reason}`);
      }
    }

    return {
      paymentId,
      userId: order.userId,
      kind: "reading",
      readingId: order.readingId,
      amount: order.amount,
      alreadyPaid,
    };
  }

  if (alreadyPaid) {
    const status = await getReferralStatus(order.userId);
    return {
      paymentId,
      userId: order.userId,
      kind: "chat_credits",
      readingId: null,
      amount: order.amount,
      creditsRemaining: status?.chatCredits ?? 0,
      alreadyPaid: true,
    };
  }

  try {
    const completed = await completeChatCreditOrder(paymentId, order.userId);
    if (!completed) throw new Error("완료할 대화권 주문이 없습니다.");
    return {
      paymentId,
      userId: order.userId,
      kind: "chat_credits",
      readingId: null,
      amount: order.amount,
      creditsRemaining: completed.creditsRemaining,
      alreadyPaid: false,
    };
  } catch (error) {
    // 웹훅과 완료 화면이 동시에 처리하면 한쪽 RPC는 이미 완료된 주문을 보게 된다.
    const latest = await getOrderByProviderOrderId(paymentId);
    if (latest?.status === "paid") {
      const status = await getReferralStatus(order.userId);
      return {
        paymentId,
        userId: order.userId,
        kind: "chat_credits",
        readingId: null,
        amount: order.amount,
        creditsRemaining: status?.chatCredits ?? 0,
        alreadyPaid: true,
      };
    }
    throw error;
  }
}
