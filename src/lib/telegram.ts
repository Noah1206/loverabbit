// 운영자 텔레그램 알림 — 서버 전용.
//
// 계좌이체가 기본 결제가 되면서 생긴 자리다. 유저가 "이체했어요"를 누르면 주문이
// pending 으로 앉는데, 관리자가 /admin/payments 를 직접 열어보기 전에는 그걸 알
// 길이 없었다. 입금한 사람이 승인 대기 화면에서 하염없이 기다리는 구조다.
// 그래서 승인 대기 주문이 만들어지는 순간 관리자 채팅으로 쏜다.
//
// 지키는 것 두 가지:
//
// 1. **절대 던지지 않는다.** 알림은 결제의 곁가지다. 텔레그램이 죽었다고 입금
//    확인 요청까지 실패하면 주객이 바뀐다. 실패는 로그로만 남긴다.
// 2. **await 하되 4초 상한.** 서버리스에서는 응답을 돌려주면 남은 작업이 언제든
//    끊길 수 있어 fire-and-forget 은 도착을 보장하지 못한다. 기다리되, 텔레그램이
//    늦으면 4초에서 끊고 결제 응답을 내보낸다.
//
// 설정: TELEGRAM_BOT_TOKEN (BotFather 가 준 토큰), TELEGRAM_ADMIN_CHAT_ID (받을
// 채팅). 둘 중 하나라도 비면 아무것도 하지 않는다 — 로컬·프리뷰에서 조용히 꺼진다.
// 연결 확인은 `npm run telegram:test`.
//
// 채팅 ID 는 TELEGRAM_CHAT_ID 로도 받는다 (2026-08-24). 한쪽 환경에 그 이름으로
// 들어가 있었고, 코드가 안 보는 이름이라 알림이 통째로 안 나가고 있었다.
// 이름이 틀리면 여기서 조용히 return 하므로 오류도 안 뜬다 - 입금한 사람은
// 운영자가 우연히 /admin/payments 를 열 때까지 기다린다. 그런 실패는 눈에
// 안 띄니, 이름을 둘 다 받고 그래도 없으면 한 번은 로그로 말한다.

import { createHmac } from "crypto";

/** 받을 채팅. 예전 이름(TELEGRAM_CHAT_ID)도 같이 본다. */
export function adminChatId(): string | null {
  return (
    process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    null
  );
}

// 설정이 빠진 것을 요청마다 떠들면 로그가 못 쓰게 된다. 한 번만 말한다.
let warnedMissingChatId = false;

/** 메시지 아래 붙는 버튼 한 줄. callback_data 는 웹훅이 받는다 (64바이트 한도). */
export interface InlineButton {
  text: string;
  callback_data: string;
}

/**
 * 계좌이체 주문 알림에 붙는 승인·거절 버튼.
 * 관리자 화면까지 가지 않고 알림에서 바로 처리한다 — /api/telegram/webhook 이 받는다.
 */
export function reviewButtons(orderId: number): InlineButton[][] {
  return [
    [
      { text: "✅ 입금 확인 · 승인", callback_data: `review:paid:${orderId}` },
      { text: "✕ 미입금 · 거절", callback_data: `review:cancelled:${orderId}` },
    ],
  ];
}

/**
 * 웹훅 비밀값. 텔레그램이 웹훅을 부를 때 X-Telegram-Bot-Api-Secret-Token 헤더로
 * 같이 보내고, 우리는 그것으로 진짜 텔레그램인지 가린다.
 *
 * 봇 토큰에서 파생한다 — 환경변수를 하나 더 두면 한쪽 환경에서 빠지는 날이
 * 온다(TELEGRAM_CHAT_ID 가 그랬다). 토큰 자체는 헤더에 실리지 않는다.
 */
export function webhookSecret(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  return createHmac("sha256", token).update("loverabbit-telegram-webhook").digest("hex");
}

async function callBot(method: string, payload: Record<string, unknown>): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      console.error(`텔레그램 ${method} 실패:`, res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error(`텔레그램 ${method} 실패:`, error);
    return false;
  }
}

/** 버튼을 누른 뒤 뜨는 짧은 확인. 안 부르면 텔레그램이 버튼을 계속 돌고 있는 것으로 그린다. */
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await callBot("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

/** 처리된 알림의 본문을 바꾸고 버튼을 뗀다. 같은 버튼을 다시 누를 수 없게. */
export async function editAdminMessage(chatId: string | number, messageId: number, text: string): Promise<void> {
  await callBot("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function notifyAdmin(text: string, buttons?: InlineButton[][]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = adminChatId();
  if (!token) return;
  if (!chatId) {
    if (!warnedMissingChatId) {
      warnedMissingChatId = true;
      console.warn(
        "텔레그램 알림이 꺼져 있습니다 - 토큰은 있는데 받을 채팅이 없어요. " +
          "TELEGRAM_ADMIN_CHAT_ID (또는 TELEGRAM_CHAT_ID) 를 채우세요. 확인은 `npm run telegram:test`."
      );
    }
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      console.error("텔레그램 알림 실패:", res.status, await res.text().catch(() => ""));
    }
  } catch (error) {
    console.error("텔레그램 알림 실패:", error);
  }
}
