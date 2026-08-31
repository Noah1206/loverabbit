// 크레딧 — 순수 상수와 계산만. DB 는 credits-db.ts, 화면은 /credits 와 /ask.
//
// 크레딧은 이 서비스의 단일 화폐다 (2026-08-31 결정 — "질문 전용"이던 전날
// 결정을 뒤집었다). 리딩도 질문도 크레딧으로 열고, 원화는 크레딧을 살 때만
// 낸다. 카드·결제창·잔액이 전부 한 단위로 말한다.
//
// 값은 supabase/migrations/…_question_credits.sql 의 머리말과 같아야 한다.
// 가입·클릭 지급량은 DB 함수 안에 상수로 있고, 여기 것은 화면 문구용이다.

/** 100원 = 1크레딧. 정가 팩의 기준값이다. */
export const KRW_PER_CREDIT = 100;

/** 질문 한 번에 드는 크레딧 */
export const QUESTION_COST = 5;

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  /** 화면에 쓰는 한 줄 */
  note: string;
}

/**
 * 정가 팩. 50 은 환율 그대로, 120 은 20% 더 준다.
 * 100원 = 1크레딧이므로 50크레딧 = 5,000원이 정직한 값이고, 큰 팩만 보너스다.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-50", name: "질문 크레딧 50", credits: 50, price: 5_000, note: "질문 10회" },
  { id: "credits-120", name: "질문 크레딧 120", credits: 120, price: 10_000, note: "질문 24회 · 20% 보너스" },
];

/**
 * 첫 구매 전용 팩 (2026-08-30).
 *
 * 무료 크레딧을 없앤 자리를 이것이 받는다. 가입 선물이 없으므로 신규 유저는
 * 여기서 사거나 아무것도 못 한다 — 그래서 첫 칸을 리딩 첫 결제와 같은
 * 1,900원에 둔다. 이미 넘어 본 문턱이라 다시 넘기가 쉽다.
 *
 * 리딩이 크레딧이 되면서(2026-08-31) "첫 리딩 1,900원" 훅을 이 팩이 잇는다 —
 * 100크레딧이면 99크레딧 리딩 한 장이 열린다. 값이 올라갈수록 장당 단가가
 * 내려간다 (19원 → 16원 → 14원). 위 칸이 손해로 보여야 아래 칸이 팔린다.
 *
 * **한 번만 살 수 있다.** 서버가 원장에서 purchase 기록을 보고 막는다
 * (credits/checkout·transfer 라우트). 화면 문구로만 막으면 링크를 아는
 * 사람은 계속 산다.
 */
export const FIRST_BUY_PACKS: CreditPack[] = [
  { id: "first-100", name: "맛보기", credits: 100, price: 1_900, note: "리딩 한 장" },
  { id: "first-300", name: "기본", credits: 300, price: 4_900, note: "리딩 두 장 + 질문" },
  { id: "first-700", name: "넉넉히", credits: 700, price: 10_000, note: "리딩 네 장 + 질문" },
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

/** 이 잔액으로 몇 번 물을 수 있나 */
export function questionsLeft(balance: number): number {
  return Math.max(0, Math.floor(balance / QUESTION_COST));
}

/** 친구가 가입하면 초대인이 받는 크레딧 (리딩 반 장 값) */
export const REFERRAL_SIGNUP_CREDITS = 50;

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
  purchase: "크레딧 구매",
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
