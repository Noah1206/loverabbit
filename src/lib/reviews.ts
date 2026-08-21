// 후기 — 서버와 화면이 함께 쓰는 타입, 그리고 이름 가리기.
//
// 여기에는 후기 데이터가 없다. 있으면 안 된다. 후기는 결제하고 실제로 리딩을
// 열어 본 사람이 남긴 것만 lr_reviews 에 쌓이고, 홈은 /api/reviews 로 그것만
// 읽어 간다. 손으로 적어 넣은 후기는 지어낸 후기이고, 그건 표시광고법 위반이다.

export type ReviewStatus = "published" | "hidden";

/**
 * 후기가 어디서 왔는지.
 *   live  지금 사이트에서 결제하고 리딩을 열어 본 사람이 직접 남긴 것
 *   beta  베타 테스트 때 받은 후기를 운영자가 옮겨 담은 것 (별점이 없다)
 * 화면은 이 둘을 구분해서 보여준다. 섞어 놓으면 어느 쪽도 무슨 말인지 알 수 없다.
 */
export type ReviewSource = "live" | "beta";

/** 화면에 나가는 모습 — 이메일 같은 식별정보는 여기까지 오지 않는다. */
export interface PublicReview {
  id: number;
  source: ReviewSource;
  /** 마스킹된 표시 이름 (박*농) */
  name: string;
  /** 베타 후기에는 별점이 없다. 없는 것을 5점으로 치지 마라. */
  rating: number | null;
  productId: string | null;
  /** 베타 후기에는 상품명이 없다. 그때 이름은 다른 서비스를 가리킨다. */
  productLabel: string | null;
  /** 여기서 결제한 횟수 — "3번 구매". 베타 후기는 셀 근거가 없어 비어 있다. */
  purchaseCount: number | null;
  body: string | null;
  createdAt: string;
}

export interface ReviewSummary {
  reviews: PublicReview[];
  /** 노출 중인 후기 전체 개수 (본문 없이 별점만 남긴 것 포함) */
  total: number;
  /** 소수점 한 자리 평균. 별점이 달린 후기가 하나도 없으면 null */
  average: number | null;
  /** 그 평균이 몇 개를 세어 나온 값인지. 평균 옆에 같이 밝힌다. */
  ratedCount: number;
}

export const REVIEW_BODY_MAX = 500;
// "굿", "Good" 처럼 한 글자짜리도 사람이 실제로 남긴 후기다. 짧다고 막지 않는다.
export const REVIEW_BODY_MIN = 1;

/**
 * 표시 이름 가리기. 가운데를 별로 덮되 한 글자짜리는 통째로 가린다.
 *   박서농 -> 박*농 / 김환 -> 김* / 이 -> * / hong -> h**g
 * 이름이 아예 없으면 이메일 앞부분을 같은 규칙으로 가린다.
 */
export function maskName(raw: string | null | undefined, fallbackEmail?: string | null): string {
  const source = (raw ?? "").trim() || (fallbackEmail ?? "").split("@")[0].trim();
  if (!source) return "**";
  const chars = [...source];
  if (chars.length === 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

const HANGUL = /[가-힣]/;

/**
 * 화면에 내보낼 이름.
 *
 * 베타 원본의 마스킹은 'u*6', 's*m', '**' 처럼 한글이 한 글자도 안 남은 것들이
 * 섞여 있다. 그대로 두면 이름 자리가 깨진 것처럼 보인다. 그렇다고 그럴듯한
 * 이름을 지어 붙이면 있지도 않은 고객을 만드는 셈이라, 사람 이름인 척하지 않는
 * '익명'으로 둔다.
 */
export function readableName(masked: string): string {
  return HANGUL.test(masked) ? masked : "익명";
}

/** 후기 본문 검사 — 별점만 남기는 것도 허용하므로 빈 값은 null 로 통과시킨다. */
export function normalizeReviewBody(raw: unknown): { body: string | null; error?: string } {
  if (typeof raw !== "string") return { body: null };
  const body = raw.trim();
  if (!body) return { body: null };
  if (body.length < REVIEW_BODY_MIN) {
    return { body: null, error: `후기는 ${REVIEW_BODY_MIN}자 이상 적어주세요.` };
  }
  if (body.length > REVIEW_BODY_MAX) {
    return { body: null, error: `후기는 ${REVIEW_BODY_MAX}자까지 쓸 수 있어요.` };
  }
  return { body };
}

export function normalizeRating(raw: unknown): number | null {
  // 문자열 "5" 를 받아주지 않는 것은 의도다. 별점을 보내는 곳은 우리 폼 하나뿐이고,
  // 무엇이든 숫자로 바꿔 받기 시작하면 true 나 빈 배열도 별점이 된다.
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) return null;
  return raw;
}
