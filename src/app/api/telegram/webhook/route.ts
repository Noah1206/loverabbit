import { timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { reviewOrderAndFollowUp, type ReviewDecision } from "@/lib/order-review";
import { adminChatId, answerCallback, editAdminMessage, webhookSecret } from "@/lib/telegram";

/*
  텔레그램 알림의 승인·거절 버튼이 여기로 온다.

  등록: npm run telegram:webhook (setWebhook + secret_token).

  들어오는 것은 셋으로 가린다:
  1. 헤더의 secret_token 이 우리가 setWebhook 때 준 값과 같은가 — 진짜 텔레그램인가.
  2. 버튼을 누른 채팅이 관리자 채팅(TELEGRAM_ADMIN_CHAT_ID)인가 — 봇을 찾아낸
     남이 눌렀는가.
  3. callback_data 가 우리가 만든 모양(review:paid:123)인가.

  항상 200 을 돌려준다. 200 이 아니면 텔레그램이 같은 업데이트를 계속 다시
  보내고, 그동안 다른 알림이 막힌다.
*/

const DATA_RE = /^review:(paid|cancelled):(\d{1,12})$/;

interface CallbackQuery {
  id: string;
  from?: { id: number; first_name?: string; username?: string };
  message?: { message_id: number; chat: { id: number }; text?: string };
  data?: string;
}

function secretMatches(header: string | null): boolean {
  const expected = webhookSecret();
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as { callback_query?: CallbackQuery } | null;
  const query = update?.callback_query;
  // 버튼이 아닌 것(일반 메시지 등)은 받기만 하고 아무것도 하지 않는다.
  if (!query) return NextResponse.json({ ok: true });

  const chatId = query.message?.chat.id;
  const admin = adminChatId();
  if (!admin || String(chatId) !== admin) {
    console.warn(`[텔레그램] 관리자 채팅이 아닌 곳에서 버튼: chat=${chatId} from=${query.from?.id}`);
    await answerCallback(query.id, "권한이 없어요.");
    return NextResponse.json({ ok: true });
  }

  const match = DATA_RE.exec(query.data ?? "");
  if (!match || !query.message) {
    await answerCallback(query.id, "알 수 없는 버튼이에요.");
    return NextResponse.json({ ok: true });
  }
  const decision = match[1] as ReviewDecision;
  const orderId = Number(match[2]);

  if (!isDatabaseConfigured()) {
    await answerCallback(query.id, "DB 연결이 없어 처리하지 못했어요.");
    return NextResponse.json({ ok: true });
  }

  const who = query.from?.username ? `@${query.from.username}` : query.from?.first_name ?? "관리자";
  // 메모는 남기지 않는다. 메모는 손님 화면에 그대로 뜨는 칸이라(payment/status),
  // "텔레그램에서 거절" 같은 내부 말이 들어가면 안 된다. 출처는 로그에 남는다.
  const result = await reviewOrderAndFollowUp(orderId, decision);

  const stamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
  const original = query.message.text ?? `주문 #${orderId}`;

  if (result.ok) {
    const line = decision === "paid" ? `✅ 승인됨 · ${who} · ${stamp}` : `✕ 미입금 거절 · ${who} · ${stamp}`;
    console.log(`[텔레그램승인] order=${orderId} ${decision} by ${who}`);
    await Promise.all([
      answerCallback(query.id, decision === "paid" ? "승인했어요." : "거절했어요."),
      editAdminMessage(query.message.chat.id, query.message.message_id, `${original}\n\n${line}`),
    ]);
    return NextResponse.json({ ok: true });
  }

  const why =
    result.reason === "already_reviewed"
      ? "이미 처리된 주문이에요."
      : result.reason === "not_found"
        ? "주문을 찾지 못했어요."
        : "처리에 실패했어요. 관리자 화면에서 다시 시도하세요.";
  await answerCallback(query.id, why);
  if (result.reason === "already_reviewed") {
    await editAdminMessage(query.message.chat.id, query.message.message_id, `${original}\n\n(이미 처리됨)`);
  }
  return NextResponse.json({ ok: true });
}
