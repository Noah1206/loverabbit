// 쿠폰 - 순수 계산만. DB 는 database.ts, 화면은 /my 와 PaymentModal.
//
// 금액과 만료는 DB 트리거(supabase/migrations/…_coupons.sql)가 정한다.
// 여기서는 행을 받아 "지금 쓸 수 있는가"와 "얼마가 되는가"만 답한다.

export type CouponKind = "welcome" | "referral";

export interface Coupon {
  id: string;
  kind: CouponKind;
  /** 할인액(원) */
  discount: number;
  expiresAt: string;
  usedAt: string | null;
  reservedAt: string | null;
  /** 붙어 있는 주문의 상태. 주문이 없으면 null */
  reservedOrder: { status: string; method: string; createdAt: string } | null;
}

export type CouponState = "available" | "reserved" | "used" | "expired";

export const COUPON_LABEL: Record<CouponKind, string> = {
  welcome: "가입 환영 쿠폰",
  referral: "친구 초대 쿠폰",
};

/** 결제창을 열어 두고 안 낸 PG 주문이 쿠폰을 붙들고 있는 시간 */
export const PG_RESERVATION_MS = 30 * 60 * 1000;

/** 어떤 금액을 내더라도 이 밑으로는 안 내려간다 - PG 가 0원·음수를 못 받는다 */
export const MIN_PAYABLE = 1000;

export function couponState(coupon: Coupon, now = Date.now()): CouponState {
  if (coupon.usedAt) return "used";
  if (new Date(coupon.expiresAt).getTime() <= now) return "expired";
  const order = coupon.reservedOrder;
  if (coupon.reservedAt && order) {
    // 실패·취소된 주문은 놓아 준다.
    if (order.status === "cancelled" || order.status === "failed" || order.status === "refunded") {
      return "available";
    }
    if (order.status === "paid") return "used";
    // 계좌이체는 사람이 승인할 때까지 며칠이고 붙들어 둔다. PG 는 결제창을
    // 열어 두고 나간 사람이 대부분이라 30분 뒤에 풀린다.
    if (order.method === "transfer") return "reserved";
    const age = now - new Date(coupon.reservedAt).getTime();
    return age < PG_RESERVATION_MS ? "reserved" : "available";
  }
  return "available";
}

export function isCouponUsable(coupon: Coupon, now = Date.now()): boolean {
  return couponState(coupon, now) === "available";
}

/** 할인 적용 후 낼 돈. 바닥은 MIN_PAYABLE. */
export function applyCoupon(price: number, discount: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const cut = Math.max(0, Math.floor(discount));
  return Math.max(MIN_PAYABLE, price - cut);
}

/** 쓸 수 있는 것 중 할인이 가장 큰 것, 같으면 먼저 만료되는 것. */
export function pickBestCoupon(coupons: Coupon[], now = Date.now()): Coupon | null {
  const usable = coupons.filter((coupon) => isCouponUsable(coupon, now));
  usable.sort((a, b) =>
    b.discount !== a.discount
      ? b.discount - a.discount
      : new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
  );
  return usable[0] ?? null;
}

/** 주문 metadata 에 남기는 모양. 승인·검증 쪽이 이걸 읽어 쿠폰을 마감한다. */
export interface OrderCouponNote {
  id: string;
  kind: CouponKind;
  discount: number;
  /** 할인 전 정가 */
  listPrice: number;
}

export function readOrderCoupon(metadata: Record<string, unknown> | null | undefined): OrderCouponNote | null {
  const raw = metadata?.coupon;
  if (!raw || typeof raw !== "object") return null;
  const note = raw as Partial<OrderCouponNote>;
  if (typeof note.id !== "string" || typeof note.discount !== "number") return null;
  return {
    id: note.id,
    kind: note.kind === "referral" ? "referral" : "welcome",
    discount: note.discount,
    listPrice: typeof note.listPrice === "number" ? note.listPrice : 0,
  };
}
