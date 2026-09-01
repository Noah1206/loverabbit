// 크레딧 — 순수 상수와 계산만. DB 는 credits-db.ts, 화면은 /credits 와 /ask.
//
// 크레딧은 이 서비스의 단일 화폐다 (2026-08-31 결정 — "질문 전용"이던 전날
// 결정을 뒤집었다). 리딩도 질문도 크레딧으로 열고, 원화는 크레딧을 살 때만
// 낸다. 카드·결제창·잔액이 전부 한 단위로 말한다.
//
// 값은 supabase/migrations/…_question_credits.sql 의 머리말과 같아야 한다.
// 가입·클릭 지급량은 DB 함수 안에 상수로 있고, 여기 것은 화면 문구용이다.

/**
 * 1,000원 = 1러빗 (2026-09-01 운영자 결정 — 100원이던 것을 바꾼다).
 *
 * 손님이 내는 돈은 그대로 두고 러빗 숫자만 1/10 로 접었다. 19러빗짜리 리딩은
 * 2러빗이 되고 값은 여전히 1,900원이다 — 단위가 커지면 "19러빗"이 얼마인지
 * 가늠해야 했던 것이 "2러빗 = 2천 원"으로 바로 읽힌다.
 */
export const KRW_PER_CREDIT = 1_000;

/** 질문 한 번에 드는 러빗 (500원) */
export const QUESTION_COST = 1;

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  /** 화면에 쓰는 한 줄 */
  note: string;
}

/**
 * 정가 팩. 5 는 환율 그대로, 12 는 20% 더 준다.
 * 1,000원 = 1러빗이므로 5러빗 = 5,000원이 정직한 값이고, 큰 팩만 보너스다.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-50", name: "러빗 5", credits: 5, price: 5_000, note: "질문 5회" },
  { id: "credits-120", name: "러빗 12", credits: 12, price: 10_000, note: "질문 12회 · 20% 보너스" },
];

/**
 * 첫 구매 전용 팩 (2026-08-30).
 *
 * 무료 크레딧을 없앤 자리를 이것이 받는다. 가입 선물이 없으므로 신규 유저는
 * 여기서 사거나 아무것도 못 한다 — 그래서 첫 칸을 리딩 첫 결제와 같은
 * 1,900원에 둔다. 이미 넘어 본 문턱이라 다시 넘기가 쉽다.
 *
 * 리딩이 러빗이 되면서(2026-08-31) "첫 리딩 1,900원" 훅을 이 팩이 잇는다 —
 * 2러빗이면 리딩 한 장이 열린다. 값이 올라갈수록 러빗당 단가가 내려간다
 * (950원 → 817원 → 769원). 위 칸이 손해로 보여야 아래 칸이 팔린다.
 *
 * **한 번만 살 수 있다.** 서버가 원장에서 purchase 기록을 보고 막는다
 * (credits/checkout·transfer 라우트). 화면 문구로만 막으면 링크를 아는
 * 사람은 계속 산다.
 */
export const FIRST_BUY_PACKS: CreditPack[] = [
  { id: "first-100", name: "맛보기", credits: 2, price: 1_900, note: "리딩 한 장" },
  { id: "first-300", name: "기본", credits: 6, price: 4_900, note: "리딩 세 장" },
  { id: "first-700", name: "넉넉히", credits: 13, price: 10_000, note: "리딩 여섯 장 + 질문 1회" },
];

export const CREDIT_PACK_MAP: Record<string, CreditPack> = Object.fromEntries(
  [...CREDIT_PACKS, ...FIRST_BUY_PACKS].map((pack) => [pack.id, pack])
);

export function getCreditPack(value?: string | null): CreditPack | null {
  return value ? CREDIT_PACK_MAP[value] ?? null : null;
}

/** 첫 구매 전용 팩인가. 서버가 자격을 확인할 때 쓴다. */
export function isFirstBuyPack(id: string): boolean {
  return FIRST_BUY_PACKS.some((pack) => pack.id === id);
}

/** 이 팩의 정가 — 첫 구매 할인율을 화면에 보여주기 위해. */
export function listPriceOf(pack: CreditPack): number {
  return pack.credits * KRW_PER_CREDIT;
}

/**
 * 리딩 한 장의 크레딧 값. 원화 정가를 환율로 접는다 — 9,900원 리딩은 99크레딧.
 * 상품표(products.ts)의 원화 정가가 정본이고, 크레딧은 그 표기다.
 */
export function readingCreditCost(priceKrw: number): number {
  return Math.max(1, Math.round(priceKrw / KRW_PER_CREDIT));
}

/**
 * 실제로 받는 판매가 (2026-08-31 운영자: 정가 크레딧은 너무 비싸다).
 *
 * 원화 시절의 훅을 크레딧으로 그대로 잇는다 — 어떤 단품이든 "첫 리딩
 * 1,900원"이었으니 19크레딧, 세트는 세 장을 두 장 값으로. 화면 표기와
 * 결제창 차감이 반드시 이 같은 숫자를 써야 한다 — 표기 따로 차감 따로면
 * 그날로 거짓말이 된다.
 */
export const READING_SALE_CREDITS = 2;
export const BUNDLE_SALE_CREDITS = 4;

/** 이 리딩을 여는 데 실제로 깎는 크레딧 */
export function saleCreditCost(isBundle: boolean): number {
  return isBundle ? BUNDLE_SALE_CREDITS : READING_SALE_CREDITS;
}

/** 이 잔액으로 몇 번 물을 수 있나 */
export function questionsLeft(balance: number): number {
  return Math.max(0, Math.floor(balance / QUESTION_COST));
}

/** 친구가 가입하면 초대인이 받는 러빗 (리딩 두 장 반 값 — 5,000원) */
export const REFERRAL_SIGNUP_CREDITS = 5;

export type CreditReason =
  | "signup"
  | "referral_click"
  | "referral_signup"
  | "purchase"
  | "question"
  | "reading"
  | "refund"
  | "admin";

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  signup: "가입 선물",
  referral_click: "친구가 초대 링크를 열었어요",
  referral_signup: "친구가 가입했어요",
  purchase: "러빗 구매",
  question: "질문",
  reading: "리딩 열람",
  refund: "질문 실패 되돌림",
  admin: "운영자 조정",
};

export interface CreditLedgerEntry {
  id: number;
  delta: number;
  reason: CreditReason;
  balanceAfter: number;
  createdAt: string;
}

/** 계좌이체 입금코드. 리딩 이체와 구분되게 앞글자를 다르게 둔다. */
export function creditDepositorCode(userToken: string): string {
  const suffix = userToken
    .slice(-6)
    .replace(/[^a-zA-Z0-9]/g, "X")
    .toUpperCase()
    .padEnd(6, "X");
  return `크-${suffix}`;
}
