import "server-only";

import { waitUntil } from "@vercel/functions";

import { reviewTransferOrder, settleCouponsForOrder } from "@/lib/database";
import { reportApprovedPurchase } from "@/lib/purchase-conversion";
import { finishReading } from "@/lib/reading-finish";
import { getReading } from "@/lib/store";

export type ReviewDecision = "paid" | "cancelled";

export type ReviewOutcome =
  | { ok: true; orderId: number; readingId: string | null; status: ReviewDecision }
  | { ok: false; reason: "not_found" | "already_reviewed" | "failed" };

/**
 * 계좌이체 주문의 승인·거절과 그 뒤에 따라오는 일 전부.
 *
 * 관리자 화면(/api/admin/payments/[id])과 텔레그램 버튼(/api/telegram/webhook)이
 * 같은 함수를 부른다. 승인으로 가는 길이 둘인데 뒷일이 한쪽에만 있으면, 그쪽으로
 * 승인된 주문은 쿠폰이 안 닫히거나 전환이 안 나가거나 생성이 안 시작된다.
 */
export async function reviewOrderAndFollowUp(
  orderId: number,
  decision: ReviewDecision,
  note?: string
): Promise<ReviewOutcome> {
  let reviewed: Awaited<ReturnType<typeof reviewTransferOrder>>;
  try {
    reviewed = await reviewTransferOrder(orderId, decision, note);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PENDING_TRANSFER_ORDER_NOT_FOUND")) return { ok: false, reason: "already_reviewed" };
    console.error("계좌이체 주문 승인 실패:", error);
    return { ok: false, reason: "failed" };
  }
  if (!reviewed) return { ok: false, reason: "not_found" };

  // 주문에 붙어 있던 쿠폰의 결말. 승인이면 소진, 거절이면 다시 쓸 수 있게 놓아 준다.
  try {
    await settleCouponsForOrder(orderId, reviewed.status === "paid" ? "paid" : "released");
  } catch (error) {
    console.error("쿠폰 마감 실패:", error);
  }

  /*
    전환은 여기서 나간다.

    계좌이체는 /payment/success 를 지나지 않는데 전환을 보내는 코드는 거기에만
    있었다. 그래서 주력 결제 수단의 전환이 한 번도 나가지 않았고, Meta 는 이
    서비스를 아무도 사지 않는 서비스로 보고 학습했다.

    await 한다. 응답을 돌려주고 나면 서버리스 함수가 얼어붙어 전송이 통째로
    사라진다 - 리딩 열람 기록에서 똑같이 겪은 일이다. 실패해도 승인은 그대로
    두고 로그만 남긴다.

    승인 RPC 는 pending 인 주문만 바꾸므로 두 번 눌러도 여기까지 두 번 오지
    않는다. 그래도 event_id 를 주문 번호에서 만들어, 혹시 두 번 나가도 Meta 가
    한 건으로 합치게 해 둔다.
  */
  if (reviewed.status === "paid") {
    const conversion = await reportApprovedPurchase(reviewed.orderId);
    if (!conversion.sent) {
      console.log(`[전환] 주문 ${reviewed.orderId} 전환 미전송: ${conversion.reason}`);
    }
  }

  /*
    승인이 곧 생성 시작이다.

    전에는 산 사람이 리딩을 열러 돌아온 순간에 만들기 시작했다. 돈 안 낸
    사람 몫을 만들지 않는다는 점에서는 그것으로 충분했지만, 산 사람은 승인
    알림을 받고 들어와서 열두 절이 만들어지는 동안 빈 화면을 봤다.

    waitUntil 로 응답 뒤에 돌린다. 그냥 두면 응답을 돌려주는 순간 서버리스
    함수가 얼어 생성이 중간에 끊긴다. 전환과 달리 이건 분 단위라 await 하면
    승인 버튼이 그만큼 멈춘다.

    실패해도 승인은 그대로 둔다. 리딩은 이미 해금돼 있어서, 산 사람이 열면
    /api/unlock 이 그 자리에서 한 번 더 만든다 — 앞당기는 장치이지 유일한
    길이 아니다.
  */
  if (reviewed.status === "paid" && reviewed.readingId) {
    const readingId = reviewed.readingId;
    waitUntil(
      (async () => {
        try {
          const stored = await getReading(readingId);
          if (!stored?.unlocked) return;
          const finished = await finishReading({
            readingId,
            stored,
            partialReport: null,
            storedFull: stored.full ?? "",
          });
          console.log(
            `[승인생성] ${readingId} ${finished.incomplete ? "미완성 — 열 때 이어서 만든다" : "완성"}`
          );
        } catch (error) {
          console.error(`[승인생성] ${readingId} 실패 — 열 때 다시 시도한다:`, error);
        }
      })()
    );
  }

  return { ok: true, ...reviewed };
}
