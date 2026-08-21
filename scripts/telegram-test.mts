/**
 * 텔레그램 알림 연결 확인.
 *
 *   npm run telegram:test              토큰·챗 ID 검사 후 시험 메시지 발송
 *
 * TELEGRAM_ADMIN_CHAT_ID 를 아직 모르면, 봇에게 아무 메시지나 한 번 보낸 뒤
 * 이 스크립트를 돌리면 getUpdates 에서 챗 ID 를 찾아 알려준다.
 */

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN 이 비어 있어요.");
  console.error("텔레그램에서 @BotFather 에게 /newbot 을 보내 봇을 만들고, 받은 토큰을 .env.local 에 넣으세요.");
  process.exit(1);
}

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

// 1) 토큰이 살아 있는가
const me = await fetch(api("getMe")).then((r) => r.json());
if (!me.ok) {
  console.error("토큰이 유효하지 않아요:", me.description ?? me);
  process.exit(1);
}
console.log(`봇 확인: @${me.result.username}`);

// 2) 챗 ID 가 없으면 getUpdates 에서 찾아준다
if (!chatId) {
  const updates = await fetch(api("getUpdates")).then((r) => r.json());
  const chats = new Map<number, string>();
  for (const u of updates.result ?? []) {
    const chat = u.message?.chat;
    if (chat) chats.set(chat.id, chat.username ?? chat.title ?? chat.first_name ?? "");
  }
  if (chats.size === 0) {
    console.error("TELEGRAM_ADMIN_CHAT_ID 가 비어 있고, 봇이 받은 메시지도 없어요.");
    console.error(`텔레그램에서 @${me.result.username} 에게 아무 메시지나 보낸 뒤 다시 돌리세요.`);
    process.exit(1);
  }
  console.log("봇이 받은 메시지의 챗 ID:");
  for (const [id, name] of chats) console.log(`  ${id}  (${name})`);
  console.log("\n위 ID 를 .env.local 의 TELEGRAM_ADMIN_CHAT_ID 에 넣고 다시 돌리세요.");
  process.exit(1);
}

// 3) 시험 발송
const sent = await fetch(api("sendMessage"), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text: "[연결 확인] 러브레빗 입금 알림이 이 채팅으로 옵니다.",
  }),
}).then((r) => r.json());

if (!sent.ok) {
  console.error("발송 실패:", sent.description ?? sent);
  process.exit(1);
}
console.log("시험 메시지를 보냈어요. 텔레그램을 확인하세요.");
console.log("운영에도 적용하려면 Vercel 환경변수에 같은 두 값을 넣고 재배포하세요.");
