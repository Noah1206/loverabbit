/**
 * 텔레그램 승인 버튼 웹훅 등록.
 *
 *   npm run telegram:webhook              https://loverebbit.xyz/api/telegram/webhook 로 등록
 *   npm run telegram:webhook -- --off     해제 (버튼은 남지만 눌러도 아무 일 없음)
 *
 * secret_token 은 봇 토큰에서 파생하므로(src/lib/telegram.ts webhookSecret) 운영
 * 환경변수를 더 넣을 것은 없다. 토큰을 바꾸면 이 스크립트를 다시 돌린다.
 */

import { webhookSecret } from "../src/lib/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = webhookSecret();
if (!token || !secret) {
  console.error("TELEGRAM_BOT_TOKEN 이 비어 있어요.");
  process.exit(1);
}
const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;
const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://loverebbit.xyz").replace(/\/$/, "");
const url = `${base}/api/telegram/webhook`;
const off = process.argv.includes("--off");

const res = await fetch(api(off ? "deleteWebhook" : "setWebhook"), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(
    off ? {} : { url, secret_token: secret, allowed_updates: ["callback_query"], drop_pending_updates: true }
  ),
}).then((r) => r.json());
if (!res.ok) {
  console.error("실패:", res.description ?? res);
  process.exit(1);
}
const info = await fetch(api("getWebhookInfo")).then((r) => r.json());
console.log(off ? "웹훅을 해제했어요." : `웹훅 등록: ${info.result?.url}`);
if (info.result?.last_error_message) console.log("마지막 오류:", info.result.last_error_message);
