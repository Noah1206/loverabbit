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
  /** 실제로 지급되는 러빗. 이벤트 중에는 보너스가 포함된 수다. */
  credits: number;
  price: number;
  /** 화면에 쓰는 한 줄 */
  note: string;
  /**
   * 이벤트가 아닐 때의 러빗. 이벤트 중일 때만 채운다 —
   * 화면이 "원래 15 → 지금 20" 을 보여주는 데 쓴다.
   *
   * credits 를 늘리고 baseCredits 에 옛 수를 남기는 방향으로 적는다.
   * 지급은 주문 메타데이터의 credits 를 DB 함수가 읽어서 하므로
   * (lr_complete_chat_credit_order), 여기만 고치면 지급까지 바뀐다.
   */
  baseCredits?: number;
}

/**
 * 충전 팩 (2026-09-01 운영자 — 세 칸을 1,900 / 4,900 / 12,000 으로 고정).
 *
 * 질문 기능이 없어졌으므로 팩의 단위는 사주 장수다. 사주 값은 열어본
 * 장수를 타므로(2·4·10러빗) 몇 장인지는 사람마다 다르다 — 그래서 note 는
 * "몇 장"이 아니라 러빗 수만 말한다. 첫 장 기준의 장수를 적으면 셋째
 * 장부터 그 말이 틀린다.
 *
 * 1,000원 = 1러빗이 환율이고, 큰 칸일수록 러빗을 더 얹는다
 * (950원 → 817원 → 800원). 위 칸이 손해로 보여야 아래 칸이 팔린다.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-2", name: "맛보기", credits: 2, price: 1_900, note: "첫 사주 한 장" },
  {
    id: "credits-6",
    name: "기본",
    credits: 8,
    baseCredits: 6,
    price: 4_900,
    note: "2러빗 더 드려요",
  },
  {
    id: "credits-15",
    name: "넉넉히",
    credits: 20,
    baseCredits: 15,
    price: 12_000,
    note: "5러빗 더 드려요 · 가장 이득",
  },
];

/**
 * 러빗 위크 (2026-09-09 ~).
 *
 * **값을 깎지 않고 러빗을 더 준다.** 콘텐츠가 계속 늘어나는 단계라 가격을
 * 내리면 정가 인식을 다시 세우기 어렵다 — "50% 할인" 은 한 번 하면 그 값이
 * 정가가 된다. 반대로 "지금만 더 준다" 는 끝나도 값이 그대로다.
 *
 * 크레딧제와도 맞다. 남은 러빗이 다음 사주나 타로로 이어지므로, 한 장을
 * 반값에 파는 것보다 재구매가 붙는다.
 *
 * 맛보기(2러빗)에는 보너스를 얹지 않았다. 그 칸은 "한 장만 보고 싶다" 는
 * 사람의 자리라 러빗이 남으면 오히려 목적과 어긋나고, 위 칸이 손해로
 * 보여야 아래 칸이 팔린다는 표의 뜻도 무너진다.
 *
 * 끝낼 때: 위 CREDIT_PACKS 의 credits 를 baseCredits 값으로 되돌리고
 * baseCredits 와 note 를 지운다. EVENT 를 null 로 두면 화면 문구가 사라진다.
 */
export const CREDIT_EVENT: { title: string; sub: string; until: string } | null = {
  title: "러빗 위크",
  sub: "충전하면 러빗을 더 드려요",
  until: "2026-09-16",
};

/** 이벤트로 더 주는 러빗 수. 이벤트가 아니면 0 */
export function bonusOf(pack: CreditPack): number {
  return pack.baseCredits ? pack.credits - pack.baseCredits : 0;
}

/**
 * 첫 구매 전용 팩은 없앴다 (2026-09-01 운영자 — 세 칸을 하나로 고정).
 *
 * 값은 누구에게나 같다. 첫 구매자에게만 다른 표를 보이면 "로그인해야
 * 할인가가 보인다"는 말이 생기고, 두 번째 구매에서 값이 오른 것처럼
 * 보인다. 대신 사주 값 자체가 열어본 장수를 탄다(2·4·10러빗) — 싸게
 * 들어오게 하는 일은 거기서 한다.
 *
 * 이름은 남긴다: 결제 라우트 둘과 /api/credits 가 아직 이 이름을 부른다.
 */
export const FIRST_BUY_PACKS: CreditPack[] = CREDIT_PACKS;

export const CREDIT_PACK_MAP: Record<string, CreditPack> = Object.fromEntries(
  [...CREDIT_PACKS, ...FIRST_BUY_PACKS].map((pack) => [pack.id, pack])
);

export function getCreditPack(value?: string | null): CreditPack | null {
  return value ? CREDIT_PACK_MAP[value] ?? null : null;
}

/** 첫 구매 전용 팩인가. 서버가 자격을 확인할 때 쓴다. */
export function isFirstBuyPack(id: string): boolean {
  // 한 번만 살 수 있는 팩이 없어졌다 (2026-09-01). 팩 목록으로 판정하면
  // 이제 모든 팩이 "첫 구매 전용"이 되어 두 번째 충전이 통째로 막힌다.
  void id;
  return false;
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

/**
 * 사주 한 장의 값은 그 사람이 지금까지 열어본 장수에 따라 오른다
 * (2026-09-01 운영자 결정).
 *
 *   처음 열어보는 사람   2러빗
 *   한 장 열어본 사람    4러빗
 *   두 장 이상           10러빗
 *
 * 첫 장을 싸게 열어 들어오게 하고, 계속 보는 사람에게 제값을 받는다.
 * 세는 것은 원장의 reason='reading' 기록이다 — 잔액이 아니라 기록이라,
 * 러빗을 다 쓴 사람도 열어본 장수는 그대로 남는다.
 */
export const READING_PRICE_TIERS = [2, 4, 10] as const;

/** 지금까지 n 장 열어본 사람이 다음 한 장에 내는 러빗 */
export function readingPriceForCount(openedCount: number): number {
  // NaN 은 Math.min/max 를 그대로 통과해 표 밖(undefined)으로 나간다 —
  // 값이 사라지면 결제창이 빈 숫자를 그린다. 셀 수 없으면 첫 장 값이다.
  const n = Number.isFinite(openedCount) ? Math.floor(openedCount) : 0;
  const i = Math.min(Math.max(n, 0), READING_PRICE_TIERS.length - 1);
  return READING_PRICE_TIERS[i];
}

/**
 * 이 리딩을 여는 데 실제로 깎는 크레딧.
 *
 * openedCount 를 넘기지 않으면 첫 장 값이 나온다 — 서버(차감하는 자리)는
 * 반드시 실제 장수를 넘겨야 한다. 화면이 값을 덜 부르는 것은 안내가
 * 틀리는 것이고, 서버가 덜 깎는 것은 값을 못 받는 것이다.
 */
export function saleCreditCost(isBundle: boolean, openedCount = 0): number {
  return isBundle ? BUNDLE_SALE_CREDITS : readingPriceForCount(openedCount);
}

/** 이 잔액으로 몇 번 물을 수 있나 */
export function questionsLeft(balance: number): number {
  return Math.max(0, Math.floor(balance / QUESTION_COST));
}

/**
 * 친구가 가입하면 초대인이 받는 러빗 (3,000원 — 2026-09-01 운영자, 5에서 내림).
 *
 * 이 숫자는 화면 문구용이다. 실제로 넣는 쪽은 DB 트리거
 * (lr_issue_referral_coupon) 이고, 둘이 어긋나면 화면이 약속한 값과
 * 통장에 꽂히는 값이 달라진다 — 바꿀 때는 마이그레이션도 같이 간다.
 */
export const REFERRAL_SIGNUP_CREDITS = 3;

/** 오늘의 액션 AI 개인화 한 조합에 드는 러빗 */
export const DAILY_ACTION_COST = 1;

/**
 * 타로 한 번 뽑기 값.
 *
 * 사주 한 장(READING_SALE_CREDITS = 2)보다 싸게 둔다. 타로는 카드 세 장짜리
 * 짧은 리딩이라 열두 절짜리 사주와 같은 값을 받을 수 없다.
 *
 * 그래도 값을 받는 이유: 뽑을 때마다 결과가 달라 매번이 새 상품이다. 명식이
 * 안 바뀌어 한 번 사면 끝인 사주와 달리, 여기는 반복 구매가 자연스럽다.
 */
export const TAROT_COST = 1;

export type CreditReason =
  | "signup"
  | "referral_click"
  | "referral_signup"
  | "purchase"
  | "question"
  | "reading"
  | "refund"
  | "admin"
  | "daily_action"
  | "tarot";

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  signup: "가입 선물",
  referral_click: "친구가 초대 링크를 열었어요",
  referral_signup: "친구가 가입했어요",
  purchase: "러빗 구매",
  question: "질문",
  reading: "리딩 열람",
  refund: "질문 실패 되돌림",
  admin: "운영자 조정",
  daily_action: "오늘의 운세",
  tarot: "타로 뽑기",
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
