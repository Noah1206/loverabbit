import { NextRequest, NextResponse } from "next/server";

import { normalizeAttribution } from "@/lib/attribution";
import { buildFbc, sendMetaConversion } from "@/lib/meta-capi";

// Meta Conversions API 중계 — 브라우저에서 Pixel이 차단돼도 전환이 남도록 서버에서 한 번 더 보낸다.
// 클라이언트가 보낸 eventId를 그대로 써서 Pixel 이벤트와 중복 제거된다.
//
// 보내는 일 자체는 lib/meta-capi.ts 가 한다. 승인 경로(브라우저가 없는 순간)도
// 같은 모듈을 부르므로, 무엇을 보내고 무엇을 안 보내는지가 한 곳에만 적혀 있다.

interface Body {
  eventName?: string;
  eventId?: string;
  eventSourceUrl?: string;
  value?: number;
  currency?: string;
  transactionId?: string;
  landingType?: string;
  attribution?: unknown;
}

function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]!.trim() : undefined;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;

  if (body.eventName !== "Purchase" && body.eventName !== "InitiateCheckout") {
    return NextResponse.json({ error: "지원하지 않는 이벤트입니다." }, { status: 400 });
  }
  if (!body.eventId) {
    return NextResponse.json({ error: "eventId가 필요합니다." }, { status: 400 });
  }

  const attribution = normalizeAttribution(body.attribution);
  const result = await sendMetaConversion({
    eventName: body.eventName,
    eventId: body.eventId,
    value: body.value,
    currency: body.currency,
    transactionId: body.transactionId,
    landingType: body.landingType,
    attribution,
    match: {
      fbp: request.cookies.get("_fbp")?.value,
      fbc: buildFbc(request.cookies.get("_fbc")?.value, attribution),
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      sourceUrl: body.eventSourceUrl,
    },
  });

  // 아직 Pixel을 연결하지 않았어도 결제 플로우가 깨지면 안 되므로 조용히 건너뛴다.
  if (result.skipped) return NextResponse.json({ skipped: result.skipped }, { status: 200 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, received: result.received ?? null });
}
