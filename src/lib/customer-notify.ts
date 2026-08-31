import "server-only";

import { sendKakaoMemo } from "@/lib/kakao-message";
import { SITE_URL } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  승인·거절이 나면 손님에게 알린다.

  지금 닿는 길은 카카오톡 '나에게 보내기' 하나다 (kakao-message.ts). 구글·X 로
  로그인한 사람은 아직 알릴 길이 없다 — 이메일 발송이 붙으면 여기에 한 줄 더한다.
  호출부는 길을 모른다. 이 함수가 되는 길을 고른다.

  절대 던지지 않는다. 승인은 이미 났고, 알림은 그 뒤의 일이다.
*/

interface OrderBrief {
  userId: number;
  kind: string;
  readingId: string | null;
}

async function orderBrief(orderId: number): Promise<OrderBrief | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("lr_orders").select("user_id,kind,reading_id").eq("id", orderId).maybeSingle();
  if (!data) return null;
  return {
    userId: Number(data.user_id),
    kind: String(data.kind),
    readingId: typeof data.reading_id === "string" ? data.reading_id : null,
  };
}

export async function notifyCustomerReviewed(orderId: number, decision: "paid" | "cancelled"): Promise<void> {
  try {
    const order = await orderBrief(orderId);
    if (!order) return;

    const isReading = order.kind === "reading" && order.readingId;
    const isCredits = order.kind === "chat_credits";
    const url = isReading
      ? `${SITE_URL}/reading/${encodeURIComponent(order.readingId!)}`
      : isCredits
        ? `${SITE_URL}/ask`
        : `${SITE_URL}/my`;

    const text =
      decision === "paid"
        ? isReading
          ? "러브레빗 입금이 확인됐어요. 리딩이 준비됐으니 지금 열어보세요."
          : isCredits
            ? "러브레빗 입금이 확인됐어요. 질문 러빗이 들어왔어요."
            : "러브레빗 입금이 확인됐어요. 보관함에서 확인해주세요."
        : "러브레빗 계좌에서 입금을 찾지 못했어요. 이체가 실제로 빠져나갔는지 확인한 뒤 다시 요청해주세요. 이미 보냈다면 입금자명과 금액을 문의로 알려주세요.";

    const sent = await sendKakaoMemo(order.userId, {
      text,
      url,
      buttonTitle: decision === "paid" ? (isReading ? "리딩 열기" : isCredits ? "질문하기" : "보관함 열기") : "다시 요청하기",
    });
    if (!sent) console.log(`[손님알림] 주문 #${orderId} ${decision} — 닿는 길 없음 (카카오 토큰 없음/비카카오 로그인)`);
  } catch (error) {
    console.error(`[손님알림] 주문 #${orderId} 실패:`, error);
  }
}
