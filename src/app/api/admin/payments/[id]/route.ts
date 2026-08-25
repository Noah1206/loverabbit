import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { isDatabaseConfigured, reviewTransferOrder, settleCouponsForOrder } from "@/lib/database";
import { reportApprovedPurchase } from "@/lib/purchase-conversion";

type ReviewRequest = {
  decision?: "paid" | "cancelled";
  note?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "주문 번호가 올바르지 않아요." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ReviewRequest;
  if (body.decision !== "paid" && body.decision !== "cancelled") {
    return NextResponse.json({ error: "승인 또는 거절 상태를 선택해주세요." }, { status: 400 });
  }

  try {
    const reviewed = await reviewTransferOrder(orderId, body.decision, body.note);
    if (!reviewed) {
      return NextResponse.json({ error: "승인할 주문을 찾을 수 없어요." }, { status: 404 });
    }
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

      await 한다. 승인 응답을 돌려주고 나면 서버리스 함수가 얼어붙어 전송이
      통째로 사라진다 - 리딩 열람 기록에서 똑같이 겪은 일이다. 실패해도 승인은
      그대로 두고 로그만 남긴다.

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

    return NextResponse.json(reviewed);
  } catch (error) {
    console.error("관리자 계좌이체 승인 실패:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PENDING_TRANSFER_ORDER_NOT_FOUND")) {
      return NextResponse.json({ error: "이미 처리됐거나 존재하지 않는 주문이에요." }, { status: 409 });
    }
    return NextResponse.json({ error: "주문 승인 처리에 실패했어요." }, { status: 503 });
  }
}
