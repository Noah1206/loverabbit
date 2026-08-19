import { NextRequest, NextResponse } from "next/server";
import { LANDING_TYPES } from "@/lib/landing-types";

// Meta Conversions API 중계 — 브라우저에서 Pixel이 차단돼도 전환이 남도록 서버에서 한 번 더 보낸다.
// 클라이언트가 보낸 eventId를 그대로 써서 Pixel 이벤트와 중복 제거된다.
//
// 절대 전송하지 않는 값: 생년월일·출생시간·출생지·성별·상대방 정보·관계 상황 원문·
// 사주 결과 전문·결제수단 정보. 아래 화이트리스트 밖의 필드는 요청에 들어와도 버린다.

const GRAPH_VERSION = "v21.0";

interface Body {
  eventName?: string;
  eventId?: string;
  eventSourceUrl?: string;
  value?: number;
  currency?: string;
  transactionId?: string;
  landingType?: string;
}

const ALLOWED_EVENTS = new Set(["Purchase", "InitiateCheckout"]);
const ALLOWED_LANDINGS = new Set<string>(LANDING_TYPES);

function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]!.trim() : undefined;
}

export async function POST(request: NextRequest) {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();

  // 아직 Pixel을 연결하지 않았어도 결제 플로우가 깨지면 안 되므로 조용히 건너뛴다.
  if (!pixelId || !accessToken) {
    return NextResponse.json({ skipped: "not_configured" }, { status: 200 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  if (!body.eventName || !ALLOWED_EVENTS.has(body.eventName)) {
    return NextResponse.json({ error: "지원하지 않는 이벤트입니다." }, { status: 400 });
  }
  if (!body.eventId) {
    return NextResponse.json({ error: "eventId가 필요합니다." }, { status: 400 });
  }

  const customData: Record<string, unknown> = {};
  if (typeof body.value === "number" && Number.isFinite(body.value)) {
    customData.value = body.value;
    customData.currency = body.currency ?? "KRW";
  }
  if (body.transactionId) customData.transaction_id = body.transactionId;
  if (body.landingType && ALLOWED_LANDINGS.has(body.landingType)) {
    customData.landing_type = body.landingType;
  }

  const payload = {
    data: [
      {
        event_name: body.eventName,
        event_id: body.eventId,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        ...(body.eventSourceUrl ? { event_source_url: body.eventSourceUrl } : {}),
        user_data: {
          // 매칭 품질용 기본값만. 해시된 개인정보는 보내지 않는다.
          client_user_agent: request.headers.get("user-agent") ?? undefined,
          client_ip_address: clientIp(request),
        },
        custom_data: customData,
      },
    ],
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE.trim() }
      : {}),
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      console.error("[meta-capi] 전송 실패:", result);
      return NextResponse.json({ error: "전환 전송에 실패했어요." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, received: result.events_received ?? null });
  } catch (error) {
    console.error("[meta-capi] 네트워크 오류:", error);
    return NextResponse.json({ error: "전환 전송에 실패했어요." }, { status: 502 });
  }
}
