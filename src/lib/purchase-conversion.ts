import "server-only";

// 승인된 계좌이체를 Meta 에 전환으로 알린다.
//
// 왜 여기냐 — 계좌이체는 `/payment/success` 를 지나지 않는다. 이체를 요청하면
// `/payment/pending` 으로 가고, 승인은 몇 시간 뒤 사람이 누른다. 그런데 전환을
// 보내는 코드는 `/payment/success` 화면에만 있었다. 그래서 주력 결제 수단의
// 전환이 **한 번도** 나간 적이 없다. Meta 쪽에서 보면 이 서비스는 아무도 사지
// 않는 서비스였고, 전환 최적화는 그 상태로 학습한다.
//
// 승인이 끝난 뒤에 부른다. 실패해도 승인은 되돌리지 않는다.

import { getOrderConversion } from "@/lib/database";
import { landingTypeForProduct } from "@/lib/meta-events";
import { sendMetaConversion } from "@/lib/meta-capi";
import { SITE_URL } from "@/lib/site";
import { purchaseEventId } from "@/lib/purchase-event-id";

export { purchaseEventId } from "@/lib/purchase-event-id";

/**
 * 승인된 주문 하나를 전환으로 보낸다.
 *
 * **던지지 않는다.** 무엇이 잘못돼도 결과만 돌려준다 — 이 함수가 실패해서
 * 입금 승인이 실패하면, 돈은 받고 글은 안 열린 상태가 된다.
 */
export async function reportApprovedPurchase(
  orderRef: number | string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const order = await getOrderConversion(orderRef);
    if (!order) return { sent: false, reason: "order_not_found" };

    // 결제를 요청할 때 동의하지 않았으면 지금도 보내지 않는다. 승인 시점에는
    // 물어볼 기기가 없으므로, 그때 받아 둔 대답이 유일한 근거다.
    if (order.meta?.consent !== true) return { sent: false, reason: "no_consent" };

    const result = await sendMetaConversion({
      eventName: "Purchase",
      // 브라우저가 같은 결제를 보낼 수도 있다(포트원 완료 화면). 가리키는 값이
      // 같아야 Meta 가 한 건으로 합치므로, 부를 때 쓴 참조를 그대로 쓴다.
      eventId: purchaseEventId(orderRef),
      value: order.amount,
      currency: "KRW",
      transactionId: String(orderRef),
      landingType: landingTypeForProduct(order.category),
      attribution: order.attribution,
      // 광고 성과는 승인을 누른 시각이 아니라 사람이 결제를 요청한 시각에 붙어야
      // 한다. 그 시각의 광고 클릭이 이 결제를 만든 것이기 때문이다.
      eventTimeMs: order.requestedAtMs ?? undefined,
      match: {
        fbp: order.meta?.fbp,
        fbc: order.meta?.fbc,
        ip: order.meta?.ip,
        userAgent: order.meta?.userAgent,
        ...(order.readingId ? { sourceUrl: `${SITE_URL}/reading/${order.readingId}` } : {}),
      },
    });

    if (result.skipped) return { sent: false, reason: result.skipped };
    if (!result.ok) return { sent: false, reason: result.error ?? "send_failed" };
    return { sent: true };
  } catch (error) {
    console.error("[전환] 승인 전환 전송 실패:", error);
    return { sent: false, reason: "error" };
  }
}
