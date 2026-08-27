// 쿠폰 - 순수 계산만. DB 는 database.ts, 화면은 /my 와 PaymentModal.
//
// 금액과 만료는 DB 트리거(supabase/migrations/…_coupons.sql)가 정한다.
// 여기서는 행을 받아 "지금 쓸 수 있는가"와 "얼마가 되는가"만 답한다.

export type CouponKind = "welcome" | "referral";

export interface Coupon {
  id: string;
  kind: CouponKind;
  /** 할인액(원). 정액가 쿠폰이면 null */
  discount: number | null;
  /** 이 쿠폰을 쓰면 결제 금액이 이 값이 된다. 할인 쿠폰이면 null */
  fixedPrice: number | null;
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

/**
 * 가입하면 어떤 사주든 한 장은 이 값에 산다.
 *
 * 광고 오퍼(ad-offers.ts)가 쓰는 값과 같다. 새 가격대를 여는 게 아니라, 광고를
 * 안 거치고 들어온 사람에게도 같은 문을 열어 주는 것이다.
 */
export const FIRST_READING_PRICE = 1900;

/** 금액 계산에 필요한 부분만. 화면과 서버가 같은 것을 보고 값을 낸다. */
export type CouponValue = Pick<Coupon, "discount" | "fixedPrice">;

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

/**
 * 이 쿠폰을 쓰면 낼 돈.
 *
 * 정액가 쿠폰은 정가를 그 값으로 바꾼다. 다만 **정가보다 비싸지지는 않는다** -
 * 광고로 이미 1,900원에 들어온 사람에게 1,900원 쿠폰이 값을 올려서는 안 된다.
 */
export function couponPrice(price: number, coupon: CouponValue): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (coupon.fixedPrice != null) {
    return Math.min(price, Math.max(0, Math.floor(coupon.fixedPrice)));
  }
  return applyCoupon(price, coupon.discount ?? 0);
}

/** 이 상품에서 실제로 깎이는 금액. 0 이면 쓸 이유가 없는 쿠폰이다. */
export function couponSaving(price: number, coupon: CouponValue): number {
  return Math.max(0, price - couponPrice(price, coupon));
}

/**
 * 쓸 수 있는 것 중 이 상품에서 가장 많이 깎이는 것, 같으면 먼저 만료되는 것.
 *
 * 값이 상품마다 달라지므로 가격 없이는 고를 수 없다. 1,900원 정액가 쿠폰은
 * 49,900원짜리에서 48,910원을 깎지만 1,900원짜리에서는 한 푼도 깎지 않는다 -
 * 그런 쿠폰은 애초에 후보에 넣지 않는다. 넣으면 0원어치로 태운다.
 */
export function pickBestCoupon(coupons: Coupon[], price: number, now = Date.now()): Coupon | null {
  const usable = coupons.filter(
    (coupon) => isCouponUsable(coupon, now) && couponSaving(price, coupon) > 0
  );
  usable.sort((a, b) => {
    const gap = couponSaving(price, b) - couponSaving(price, a);
    return gap !== 0 ? gap : new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
  });
  return usable[0] ?? null;
}

/** 쿠폰함에 크게 적히는 값. 정액가는 "1,900원", 할인은 "5,000원". */
export function couponHeadline(coupon: CouponValue): string {
  return `${(coupon.fixedPrice ?? coupon.discount ?? 0).toLocaleString()}원`;
}

/** 그 숫자가 무슨 뜻인지. 금액만으로는 정액가인지 할인인지 구분되지 않는다. */
export function couponMeaning(coupon: CouponValue): string {
  return coupon.fixedPrice != null ? "어떤 사주든 한 장을 이 값에" : "전문 리딩 결제에서 할인";
}

/** 주문 metadata 에 남기는 모양. 승인·검증 쪽이 이걸 읽어 쿠폰을 마감한다. */
export interface OrderCouponNote {
  id: string;
  kind: CouponKind;
  /** 이 주문에서 실제로 깎인 금액 */
  discount: number;
  /** 정액가 쿠폰이면 그 값. 할인 쿠폰이면 null */
  fixedPrice: number | null;
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
    fixedPrice: typeof note.fixedPrice === "number" ? note.fixedPrice : null,
    listPrice: typeof note.listPrice === "number" ? note.listPrice : 0,
  };
}
