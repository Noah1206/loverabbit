import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import { waitUntil } from "@vercel/functions";

import { isDatabaseConfigured, reviewTransferOrder, settleCouponsForOrder } from "@/lib/database";
import { reportApprovedPurchase } from "@/lib/purchase-conversion";
import { finishReading } from "@/lib/reading-finish";
import { getReading } from "@/lib/store";

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

    /*
      승인이 곧 생성 시작이다.

      전에는 산 사람이 리딩을 열러 돌아온 순간에 만들기 시작했다. 돈 안 낸
      사람 몫을 만들지 않는다는 점에서는 그것으로 충분했지만, 산 사람은 승인
      알림을 받고 들어와서 열두 절이 만들어지는 동안 빈 화면을 봤다. 승인과
      열람 사이에는 보통 몇 분에서 몇 시간이 있고, 그 시간이 비어 있었다.

      waitUntil 로 응답 뒤에 돌린다. 그냥 두면 응답을 돌려주는 순간 서버리스
      함수가 얼어 생성이 중간에 끊긴다 — 위 전환 전송에서 겪은 그 문제다.
      다만 전환과 달리 이건 분 단위라 await 하면 승인 버튼이 그만큼 멈춘다.

      실패해도 승인은 그대로 둔다. 리딩은 이미 해금돼 있어서, 산 사람이 열면
      /api/unlock 이 예전처럼 그 자리에서 한 번 더 만든다 — 이건 앞당기는
      장치이지 유일한 길이 아니다.
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
