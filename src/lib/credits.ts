// 질문 크레딧 — 순수 상수와 계산만. DB 는 database.ts, 화면은 /ask 와 /credits.
//
// 크레딧은 **질문 전용**이다 (2026-08-30). 리딩은 원화 + 쿠폰 계단으로 팔고,
// 크레딧으로는 리딩을 열 수 없다. 두 체계를 섞지 않는 것이 결정이다.
//
// 값은 supabase/migrations/…_question_credits.sql 의 머리말과 같아야 한다.
// 가입·클릭 지급량은 DB 함수 안에 상수로 있고, 여기 것은 화면 문구용이다.

/** 100원 = 1크레딧 */
export const KRW_PER_CREDIT = 100;

/** 질문 한 번에 드는 크레딧 */
export const QUESTION_COST = 5;

/** 가입하면 받는 크레딧 (질문 3회) */
export const SIGNUP_CREDITS = 15;

/** 초대 링크를 친구가 클릭하면 초대인이 받는 크레딧 (질문 1회) */
export const REFERRAL_CLICK_CREDITS = 5;

/** 초대인이 하루에 클릭 보상으로 받을 수 있는 상한 (회) */
export const REFERRAL_CLICK_DAILY_CAP = 5;

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  /** 화면에 쓰는 한 줄 */
  note: string;
}

/**
 * 두 개만. 50 은 환율 그대로, 120 은 20% 더 준다.
 * 100원 = 1크레딧이므로 50크레딧 = 5,000원이 정직한 값이고, 큰 팩만 보너스다.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-50", name: "질문 크레딧 50", credits: 50, price: 5_000, note: "질문 10회" },
  { id: "credits-120", name: "질문 크레딧 120", credits: 120, price: 10_000, note: "질문 24회 · 20% 보너스" },
];

export const CREDIT_PACK_MAP: Record<string, CreditPack> = Object.fromEntries(
  CREDIT_PACKS.map((pack) => [pack.id, pack])
);

export function getCreditPack(value?: string | null): CreditPack | null {
  return value ? CREDIT_PACK_MAP[value] ?? null : null;
}

/** 이 잔액으로 몇 번 물을 수 있나 */
export function questionsLeft(balance: number): number {
  return Math.max(0, Math.floor(balance / QUESTION_COST));
}

export type CreditReason = "signup" | "referral_click" | "purchase" | "question" | "refund" | "admin";

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  signup: "가입 선물",
  referral_click: "친구가 초대 링크를 열었어요",
  purchase: "크레딧 구매",
  question: "질문",
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
