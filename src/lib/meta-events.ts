// Meta Pixel / Conversions API 이벤트 헬퍼.
//
// 설계 원칙 (광고 세팅 지시문 1-C):
//  1. Pixel ID·CAPI 토큰은 환경변수로만 읽는다. 코드에 값을 박지 않는다.
//  2. 쿠키 동의 전에는 어떤 이벤트도 보내지 않는다.
//  3. 파라미터는 아래 타입이 허용하는 것만 보낸다. 생년월일·출생시간·출생지·성별·
//     상대방 정보·관계 상황 원문·사주 결과·결제수단은 절대 포함하지 않는다.
//  4. 클라이언트 Pixel과 서버 CAPI가 같은 전환을 보낼 때는 같은 event_id로 중복을 제거한다.

import { hasMarketingConsent } from "@/lib/consent";
import { resolveAdOffer } from "@/lib/ad-offers";
import type { LandingType } from "@/lib/landing-types";
export type { LandingType } from "@/lib/landing-types";

export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();

type FbqArgs =
  | ["init", string]
  | ["track", string, Record<string, unknown>?, { eventID: string }?]
  | ["trackCustom", string, Record<string, unknown>?, { eventID: string }?];

type Fbq = ((...args: FbqArgs) => void) & { queue?: unknown[]; loaded?: boolean };

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export function isPixelReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.fbq === "function" &&
    META_PIXEL_ID.length > 0 &&
    hasMarketingConsent()
  );
}

export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fire(
  mode: "track" | "trackCustom",
  name: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (!isPixelReady()) return;
  try {
    if (eventId) {
      window.fbq!(mode, name, params ?? {}, { eventID: eventId });
    } else {
      window.fbq!(mode, name, params ?? {});
    }
  } catch (error) {
    // 광고 추적 실패가 사용자 플로우를 막아서는 안 된다.
    console.warn("[meta] 이벤트 전송 실패:", name, error);
  }
}

// ── 표준 이벤트 ──────────────────────────────────────────────────────────
export function trackPageView(): void {
  fire("track", "PageView");
}

export function trackViewContent(landing: LandingType): void {
  fire("track", "ViewContent", { content_name: landing });
}

export function trackCompleteRegistration(method: string): void {
  // method는 "kakao" 같은 로그인 수단 이름만. 이메일 원문은 넣지 않는다.
  fire("track", "CompleteRegistration", { method });
}

export function trackInitiateCheckout(input: {
  value: number;
  currency?: string;
  landingType: LandingType;
}): void {
  fire("track", "InitiateCheckout", {
    value: input.value,
    currency: input.currency ?? "KRW",
    landing_type: input.landingType,
  });
}

// ── 커스텀 이벤트 (landing_type만 허용) ─────────────────────────────────
export function trackPreviewStarted(landing: LandingType): void {
  fire("trackCustom", "PreviewStarted", { landing_type: landing });
}

export function trackSajuFormStarted(landing: LandingType): void {
  fire("trackCustom", "SajuFormStarted", { landing_type: landing });
}

export function trackSajuFormCompleted(landing: LandingType): void {
  fire("trackCustom", "SajuFormCompleted", { landing_type: landing });
}

export function trackPreviewGenerated(landing: LandingType): void {
  fire("trackCustom", "PreviewGenerated", { landing_type: landing });
}

export function trackResultUnlockClicked(landing: LandingType): void {
  fire("trackCustom", "ResultUnlockClicked", { landing_type: landing });
}

// ── Purchase — 클라이언트와 서버가 같은 event_id로 한 번씩 ───────────────
export async function trackPurchase(input: {
  value: number;
  currency?: string;
  transactionId: string;
  landingType?: LandingType;
}): Promise<void> {
  if (!hasMarketingConsent()) return;

  const eventId = newEventId();
  const currency = input.currency ?? "KRW";

  fire(
    "track",
    "Purchase",
    {
      value: input.value,
      currency,
      transaction_id: input.transactionId,
      ...(input.landingType ? { landing_type: input.landingType } : {}),
    },
    eventId
  );

  // 브라우저에서 Pixel이 차단되어도 전환이 남도록 서버 CAPI로 같은 event_id를 한 번 더 보낸다.
  try {
    await fetch("/api/meta/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "Purchase",
        eventId,
        eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
        value: input.value,
        currency,
        transactionId: input.transactionId,
        landingType: input.landingType,
      }),
      keepalive: true,
    });
  } catch (error) {
    console.warn("[meta] CAPI 전송 실패:", error);
  }
}

// 광고 랜딩과 상품의 대응. 광고 유입 퍼널에서만 landing_type을 붙이기 위한 매핑이다.
// 여기 없는 상품(자연 유입)은 커스텀 이벤트를 발송하지 않는다.
const LANDING_BY_PRODUCT: Record<string, LandingType> = {
  ibyeol: "breakup_decision",
  sseom: "inner_mind",
};

export function landingTypeForProduct(
  productId: string | undefined | null,
  offerId?: string | undefined | null,
): LandingType | null {
  if (!productId) return null;
  const offer = resolveAdOffer(productId, offerId);
  if (offer) return offer.landingType;
  return LANDING_BY_PRODUCT[productId] ?? null;
}
