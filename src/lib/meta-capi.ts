import "server-only";

// Meta Conversions API 전송기.
//
// 원래 이 코드는 /api/meta/capi 라우트 안에만 있었다. 브라우저가 부르는 자리에만
// 있었다는 뜻이고, 그래서 브라우저가 없는 순간의 전환은 한 번도 나가지 못했다 —
// 계좌이체가 정확히 그 경우다. 입금 승인은 사람이 몇 시간 뒤에 누르고, 그때
// 산 사람은 화면 앞에 없다.
//
// 라우트에서 꺼내 모듈로 둔다. 라우트도 여기를 부르고, 승인 경로도 여기를 부른다.
//
// **절대 전송하지 않는 값**: 생년월일·출생시간·출생지·성별·상대방 정보·관계 상황
// 원문·사주 결과·결제수단 정보. 그리고 해시된 것이라도 이메일·전화번호는 보내지
// 않는다 — 이 저장소가 처음부터 지켜온 선이고, 매칭은 아래 fbp/fbc 로 맞춘다.

import { attributionParams, normalizeAttribution, type Attribution } from "@/lib/attribution";
import { LANDING_TYPES } from "@/lib/landing-types";

const GRAPH_VERSION = "v21.0";
const ALLOWED_EVENTS = new Set(["Purchase", "InitiateCheckout"]);
const ALLOWED_LANDINGS = new Set<string>(LANDING_TYPES);

/**
 * 사람을 알아보게 하는 값들.
 *
 * Meta 는 user_data 가 통째로 비면 이벤트를 받지 않는다. 브라우저가 있는
 * 순간에는 IP·UA 가 그 자리를 채우지만, 승인은 몇 시간 뒤라 그때는 아무것도
 * 없다. 그래서 결제를 요청하던 순간에 이 값들을 떠두었다가 그대로 다시 쓴다.
 *
 * fbp 는 픽셀이 심는 브라우저 식별자, fbc 는 광고 클릭 식별자다. 둘 다 Meta 가
 * 스스로 만든 값이라 우리가 사람의 무엇을 넘기는 것이 아니고, 매칭 품질은
 * IP·UA 보다 낫다.
 */
export interface MetaMatchSnapshot {
  fbp?: string;
  fbc?: string;
  ip?: string;
  userAgent?: string;
  sourceUrl?: string;
}

export interface MetaConversionInput {
  eventName: "Purchase" | "InitiateCheckout";
  /** 같은 전환이 두 길로 나가도 한 번으로 세어지게 하는 열쇠 */
  eventId: string;
  value?: number;
  currency?: string;
  transactionId?: string;
  landingType?: string | null;
  attribution?: unknown;
  match?: MetaMatchSnapshot;
  /**
   * 전환이 **실제로 일어난** 시각(ms). 승인 시각이 아니라 결제를 요청한 시각을
   * 넣는다 — 광고 성과는 그 시각의 클릭에 붙어야 한다. Meta 는 7일 지난 것을
   * 받지 않으므로 그보다 오래된 값이면 지금으로 당긴다.
   */
  eventTimeMs?: number;
}

export function isMetaCapiConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

/** Meta 가 받아주는 가장 오래된 시각. 이보다 옛것은 그냥 버려진다. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function eventTimeSeconds(eventTimeMs: number | undefined, now = Date.now()): number {
  if (!eventTimeMs || !Number.isFinite(eventTimeMs)) return Math.floor(now / 1000);
  // 미래도, 7일보다 옛것도 받지 않는다.
  const clamped = Math.min(Math.max(eventTimeMs, now - MAX_AGE_MS + 60_000), now);
  return Math.floor(clamped / 1000);
}

/**
 * 광고 클릭 식별자를 Meta 형식으로 만든다.
 *
 * `fb.1.{받은시각}.{fbclid}` 가 규격이다. 쿠키에 이미 _fbc 가 있으면 그걸 쓰고,
 * 없으면 주소에서 받아 둔 fbclid 로 만든다 — 쿠키가 막힌 브라우저에서도
 * 광고 클릭이 전환에 이어지게 하는 유일한 길이다.
 */
export function buildFbc(
  cookieFbc: string | undefined,
  attribution: Attribution | null
): string | undefined {
  if (cookieFbc) return cookieFbc;
  if (!attribution?.fbclid) return undefined;
  const at = typeof attribution.at === "number" && attribution.at > 0 ? attribution.at : Date.now();
  return `fb.1.${at}.${attribution.fbclid}`;
}

export interface MetaConversionResult {
  ok: boolean;
  skipped?: "not_configured" | "unsupported_event" | "no_match_data";
  received?: number | null;
  error?: string;
}

/**
 * 한 건 보낸다.
 *
 * **던지지 않는다.** 전환을 못 적었다고 결제 승인이 실패하면 안 된다 — 돈은
 * 이미 받았고 사람은 글을 기다린다. 실패는 로그로만 남긴다.
 */
export async function sendMetaConversion(
  input: MetaConversionInput
): Promise<MetaConversionResult> {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !accessToken) return { ok: false, skipped: "not_configured" };
  if (!ALLOWED_EVENTS.has(input.eventName)) return { ok: false, skipped: "unsupported_event" };

  const match = input.match ?? {};
  const userData: Record<string, string> = {};
  if (match.fbp) userData.fbp = match.fbp;
  if (match.fbc) userData.fbc = match.fbc;
  if (match.ip) userData.client_ip_address = match.ip;
  if (match.userAgent) userData.client_user_agent = match.userAgent;
  // 전부 비면 Meta 가 거절한다. 보내봐야 오류만 받으니 여기서 접는다.
  if (Object.keys(userData).length === 0) return { ok: false, skipped: "no_match_data" };

  const attribution = normalizeAttribution(input.attribution);
  const customData: Record<string, unknown> = {};
  if (typeof input.value === "number" && Number.isFinite(input.value)) {
    customData.value = input.value;
    customData.currency = input.currency ?? "KRW";
  }
  if (input.transactionId) customData.transaction_id = input.transactionId;
  if (input.landingType && ALLOWED_LANDINGS.has(input.landingType)) {
    customData.landing_type = input.landingType;
  }
  Object.assign(customData, attributionParams(attribution));

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_id: input.eventId,
        event_time: eventTimeSeconds(input.eventTimeMs),
        action_source: "website",
        ...(match.sourceUrl ? { event_source_url: match.sourceUrl } : {}),
        user_data: userData,
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
      return { ok: false, error: "전환 전송에 실패했어요." };
    }
    return { ok: true, received: (result.events_received as number) ?? null };
  } catch (error) {
    console.error("[meta-capi] 네트워크 오류:", error);
    return { ok: false, error: "전환 전송에 실패했어요." };
  }
}
