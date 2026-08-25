import { NextRequest, NextResponse } from "next/server";
import { PaymentClient } from "@portone/server-sdk";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";

// 포트원 연동이 실제로 살아 있는가 — 값을 보여 주지 않고 답한다.
//
// 웹훅 시크릿이 틀렸다는 것을 포트원 콘솔의 "호출 테스트"와 Vercel 로그를 나란히 놓고서야
// 알았다. 비밀값은 어디에서도 마스킹돼 있어 맞는지 틀린지를 눈으로 대조할 수 없다.
// 그래서 대조 대신 **동작**으로 답한다: 시크릿이 base64 로 풀리는가, API 시크릿으로
// 포트원이 우리를 알아보는가. 값은 한 글자도 내보내지 않는다.
//
// GET /api/admin/portone  (Authorization: Bearer <관리자 승인 키>)

export const runtime = "nodejs";

function base64Decodes(secret: string): { ok: boolean; bytes: number } {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  try {
    const buf = Buffer.from(raw, "base64");
    // Buffer.from 은 웬만한 쓰레기도 조용히 풀어 버린다. 다시 인코딩해서 같아야 진짜 base64 다.
    const ok = buf.length > 0 && buf.toString("base64").replace(/=+$/, "") === raw.replace(/=+$/, "");
    return { ok, bytes: buf.length };
  } catch {
    return { ok: false, bytes: 0 };
  }
}

export async function GET(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
  }

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? "";
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() ?? "";
  const apiSecret = process.env.PORTONE_API_SECRET?.trim() ?? "";
  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET?.trim() ?? "";

  const webhook = webhookSecret ? base64Decodes(webhookSecret) : { ok: false, bytes: 0 };

  // API 시크릿: 있지도 않은 결제를 물어본다. 시크릿이 맞으면 "없다"(404), 틀리면 "누구냐"(401).
  let api: "ok" | "unauthorized" | "missing" | "error" = "missing";
  let apiDetail = "";
  if (apiSecret && storeId) {
    try {
      await PaymentClient({ secret: apiSecret }).getPayment({
        paymentId: "LRP_healthcheck_00000000000000000000000000000000",
        storeId,
      });
      api = "ok";
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      apiDetail = message.slice(0, 120);
      api = /not ?found|PaymentNotFound|찾을 수 없/i.test(message)
        ? "ok"
        : /unauthor|401|Unauthorized|인증/i.test(message)
          ? "unauthorized"
          : "error";
    }
  }

  return NextResponse.json(
    {
      store: {
        configured: Boolean(storeId),
        looksRight: /^store-[0-9a-f-]{36}$/.test(storeId),
        suffix: storeId.slice(-6),
      },
      channel: {
        configured: Boolean(channelKey),
        looksRight: /^channel-key-[0-9a-f-]{36}$/.test(channelKey),
        suffix: channelKey.slice(-6),
      },
      apiSecret: { configured: Boolean(apiSecret), check: api, detail: apiDetail },
      webhookSecret: {
        configured: Boolean(webhookSecret),
        hasPrefix: webhookSecret.startsWith("whsec_"),
        length: webhookSecret.length,
        decodesAsBase64: webhook.ok,
        decodedBytes: webhook.bytes,
        // 포트원 콘솔 Secret 1 은 whsec_ 뒤에 base64 가 온다. 그게 아니면 서명 검증이 전부 400 이다.
        verdict: !webhookSecret
          ? "없음 — 콘솔 결제알림(Webhook) V2 의 Secret 1 을 넣어야 한다"
          : webhook.ok
            ? "형식 정상 — 콘솔 호출 테스트에서 404(주문 없음)가 나오면 서명까지 맞는 것"
            : "base64 가 아님 — API Secret 을 넣었거나 잘못 복사됐다. 콘솔 Secret 1 을 그대로 다시 넣는다",
      },
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
