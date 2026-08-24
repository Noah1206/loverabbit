// 고급 해석 회귀 세트.
//
// 규칙 하나: **값을 지어내지 않는다.**
//
// 4주·계절 맥락·격국 판정 상태는 계산이라 기대값을 적을 수 있다. 반면
// "이 명식의 용신은 무엇인가", "이 격을 무엇이라 불러야 하는가" 는 전문가가 봐야
// 하는 자리다. 그 칸을 그럴듯하게 채우면 회귀 테스트가 **틀린 답을 지키는 장치**가
// 된다 — 가장 나쁜 종류의 테스트다. 그래서 그 칸은 pending_expert_review 로 둔다.
//
// 그 상태 자체가 policy_enabled 의 문지기다. 검토 안 된 fixture 가 하나라도 있으면
// 고급 해석을 켤 수 없다.
//
// 명조는 실제 인물의 것을 쓰지 않는다. 생년월일시는 개인정보이고, 유명인 명조는
// 출처와 정확성이 제각각이다. 아래는 **계산 경로를 고르게 밟도록 고른 합성 입력**이다
// — 열두 월지, 절입 경계, 시각 미상, 윤달 근처, 자시 경계 같은 것들.

import type { Gender } from "../saju-facts";

export type FixtureReviewState = "pending_expert_review" | "computation_reviewed" | "reviewed";

export interface AdvancedFixture {
  id: string;
  /** 이 명식을 넣은 이유 — 어떤 계산 경로를 밟게 하려는 것인가 */
  purpose: string;
  birthInput: { year: number; month: number; day: number; hour: number | null; gender: Gender };
  /** 계산으로 확정되는 것 — 회귀 테스트가 그대로 대조한다 */
  expectedFourPillars: { year: string; month: string; day: string; hour: string | null };
  expectedSeasonalContext: {
    monthBranch: string;
    season: string;
    temperature: string;
    moisture: string;
  };
  /** 계산으로 나오는 상태값. 어떤 격 이름인지는 여기 없다. */
  expectedGyeokgukStatus: "determined" | "ambiguous" | "unsupported";
  expectedConflictKind?: "unanimous" | "partial_agreement" | "conflict" | "insufficient_evidence";
  /** 전문가 검토 뒤에만 채운다. 지금은 전부 비어 있다. */
  approvedPolicyAssertions: string[];
  sourceNotes: string[];
  reviewState: FixtureReviewState;
}

/**
 * 기대값은 코드에서 채우지 않는다. 아래 목록에는 **입력과 의도만** 있고,
 * 계산으로 확정되는 칸은 scripts/advanced-fixtures.mts 가 한 번 뽑아 여기에 적는다.
 * 사람이 눈으로 본 뒤 커밋하는 것이 그 절차의 핵심이다 — 스크립트가 스스로
 * 기대값을 갱신하면 회귀 테스트는 아무것도 안 지킨다.
 */
export const FIXTURE_INPUTS: Array<{
  id: string;
  purpose: string;
  birthInput: AdvancedFixture["birthInput"];
}> = [
  // ── 열두 월지를 한 바퀴 ──
  { id: "MZ-01-IN", purpose: "인월(초봄) — 계절 전환 직후", birthInput: { year: 1988, month: 2, day: 20, hour: 10, gender: "M" } },
  { id: "MZ-02-MYO", purpose: "묘월(봄) — 목이 왕한 자리", birthInput: { year: 1991, month: 3, day: 18, hour: 15, gender: "F" } },
  { id: "MZ-03-JIN", purpose: "진월(습토) — 사계 중 습한 쪽", birthInput: { year: 1994, month: 4, day: 21, hour: 8, gender: "M" } },
  { id: "MZ-04-SA", purpose: "사월(초여름)", birthInput: { year: 1986, month: 5, day: 19, hour: 21, gender: "F" } },
  { id: "MZ-05-O", purpose: "오월(한여름) — 화가 극에 있는 자리", birthInput: { year: 1997, month: 6, day: 20, hour: 12, gender: "M" } },
  { id: "MZ-06-MI", purpose: "미월(조토) — 덥고 마른 자리", birthInput: { year: 1983, month: 7, day: 22, hour: 17, gender: "F" } },
  { id: "MZ-07-SIN", purpose: "신월(초가을)", birthInput: { year: 1990, month: 8, day: 20, hour: 6, gender: "M" } },
  { id: "MZ-08-YU", purpose: "유월(가을) — 금이 왕한 자리", birthInput: { year: 1979, month: 9, day: 21, hour: 19, gender: "F" } },
  { id: "MZ-09-SUL", purpose: "술월(조토) — 서늘하고 마른 자리", birthInput: { year: 2001, month: 10, day: 22, hour: 11, gender: "M" } },
  { id: "MZ-10-HAE", purpose: "해월(초겨울)", birthInput: { year: 1975, month: 11, day: 20, hour: 14, gender: "F" } },
  { id: "MZ-11-JA", purpose: "자월(한겨울) — 수가 극에 있는 자리", birthInput: { year: 1999, month: 12, day: 20, hour: 3, gender: "M" } },
  { id: "MZ-12-CHUK", purpose: "축월(겨울 끝) — 기준 명식과 같은 월지", birthInput: { year: 1993, month: 1, day: 24, hour: 14, gender: "F" } },

  // ── 절입 경계 ──
  { id: "TB-01-BEFORE-IPCHUN", purpose: "입춘 하루 전 — 연주가 갈리는 자리", birthInput: { year: 1996, month: 2, day: 3, hour: 12, gender: "M" } },
  { id: "TB-02-AFTER-IPCHUN", purpose: "입춘 하루 뒤 — 위와 짝", birthInput: { year: 1996, month: 2, day: 5, hour: 12, gender: "M" } },
  { id: "TB-03-TERM-EDGE", purpose: "절입 당일 — 경계 표시가 서야 한다", birthInput: { year: 1987, month: 8, day: 8, hour: 9, gender: "F" } },
  { id: "TB-04-TERM-DEEP", purpose: "절입 한복판 — 경계 표시가 없어야 한다", birthInput: { year: 1987, month: 8, day: 23, hour: 9, gender: "F" } },

  // ── 시각 경계 ──
  { id: "HR-01-EARLY-JA", purpose: "야자시 — 자시 앞쪽", birthInput: { year: 1992, month: 5, day: 10, hour: 23, gender: "M" } },
  { id: "HR-02-LATE-JA", purpose: "조자시 — 자시 뒤쪽, 날짜가 갈린다", birthInput: { year: 1992, month: 5, day: 11, hour: 0, gender: "M" } },
  { id: "HR-03-UNKNOWN", purpose: "시각 미상 — 시주가 서지 않는다", birthInput: { year: 1984, month: 6, day: 15, hour: null, gender: "F" } },

  // ── 강약이 갈리는 자리 ──
  { id: "ST-01-STRONG", purpose: "일간이 뿌리를 많이 둔 명식", birthInput: { year: 1980, month: 3, day: 5, hour: 5, gender: "M" } },
  { id: "ST-02-WEAK", purpose: "일간이 계절을 거스르고 설기가 많은 명식", birthInput: { year: 1995, month: 7, day: 3, hour: 13, gender: "F" } },
  { id: "ST-03-EVEN", purpose: "중화에 가까운 명식", birthInput: { year: 1989, month: 4, day: 12, hour: 16, gender: "M" } },

  // ── 격국 판정이 갈리는 자리 ──
  { id: "GK-01-EXPOSED-MAIN", purpose: "월지 본기가 투간 — 격이 뚜렷할 후보", birthInput: { year: 1977, month: 10, day: 9, hour: 7, gender: "M" } },
  { id: "GK-02-NO-EXPOSURE", purpose: "월지 지장간이 하나도 투간하지 않음", birthInput: { year: 2003, month: 12, day: 3, hour: 22, gender: "F" } },
  { id: "GK-03-MONTH-CLASHED", purpose: "월지가 충을 맞음 — 격이 흔들리는 자리", birthInput: { year: 1982, month: 9, day: 14, hour: 4, gender: "M" } },
  { id: "GK-04-MONTH-COMBINED", purpose: "월지가 육합에 묶임", birthInput: { year: 1998, month: 11, day: 27, hour: 18, gender: "F" } },
  { id: "GK-05-BIGYEOP-MONTH", purpose: "월지가 비겁 — 내격 후보가 안 서는 자리", birthInput: { year: 1993, month: 3, day: 30, hour: 20, gender: "M" } },

  // ── 축 충돌이 예상되는 자리 ──
  { id: "CF-01-WINTER-WEAK", purpose: "겨울생 신약 — 조후와 억부가 갈릴 후보", birthInput: { year: 2000, month: 1, day: 8, hour: 2, gender: "F" } },
  { id: "CF-02-SUMMER-WEAK", purpose: "여름생 신약 — 위의 반대쪽", birthInput: { year: 1985, month: 7, day: 12, hour: 15, gender: "M" } },
  { id: "CF-03-WINTER-STRONG", purpose: "겨울생 신강 — 조후와 억부가 같은 쪽을 볼 후보", birthInput: { year: 1978, month: 12, day: 28, hour: 1, gender: "F" } },
  { id: "CF-04-SUMMER-STRONG", purpose: "여름생 신강", birthInput: { year: 2004, month: 6, day: 6, hour: 11, gender: "M" } },

  // ── 상대 명식 (궁합 경로) ──
  { id: "PT-01-PARTNER", purpose: "기준 명식의 상대 — 궁합 경로 회귀", birthInput: { year: 1991, month: 7, day: 8, hour: 20, gender: "M" } },
];

/**
 * 기대값 — **계산으로 확정되는 칸만** 채웠다.
 *
 * 2026-08-21에 32건 전부의 4주·계절 맥락·격국 판정 상태·축 합의 종류를 받아 적었다.
 * 이 값들은 스크립트가 뽑고 사람이 옮겼다(scripts/fixture-snapshot.mts). 스크립트가
 * 스스로 갱신하지 않는 이유는 하나다 — 값이 바뀔 때마다 조용히 따라 바뀌는 자물쇠는
 * 자물쇠가 아니다.
 *
 * approvedPolicyAssertions 와 sourceNotes 는 **비어 있고, 비어 있는 것이 맞다.**
 * "이 명식의 용신은 무엇인가", "이 격을 무엇이라 불러야 하는가" 는 계산이 아니라
 * 판단이다. 그럴듯하게 채우면 회귀 테스트가 틀린 답을 지키는 장치가 된다.
 *
 * reviewState:
 *   computation_reviewed — 계산 칸은 확인됨. 판단 칸은 비어 있음. **지금 상태.**
 *   reviewed             — 명리 전문가가 판단 칸까지 채움. policy_enabled 의 문지기.
 */
export const REVIEWED_FIXTURES: AdvancedFixture[] = [
  {
    id: "MZ-01-IN",
    purpose: "인월(초봄) — 계절 전환 직후",
    birthInput: { year: 1988, month: 2, day: 20, hour: 10, gender: "M" },
    expectedFourPillars: { year: "무진", month: "갑인", day: "을사", hour: "신사" },
    expectedSeasonalContext: {
      monthBranch: "인",
      season: "spring",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-02-MYO",
    purpose: "묘월(봄) — 목이 왕한 자리",
    birthInput: { year: 1991, month: 3, day: 18, hour: 15, gender: "F" },
    expectedFourPillars: { year: "신미", month: "신묘", day: "정해", hour: "정미" },
    expectedSeasonalContext: {
      monthBranch: "묘",
      season: "spring",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-03-JIN",
    purpose: "진월(습토) — 사계 중 습한 쪽",
    birthInput: { year: 1994, month: 4, day: 21, hour: 8, gender: "M" },
    expectedFourPillars: { year: "갑술", month: "무진", day: "정축", hour: "갑진" },
    expectedSeasonalContext: {
      monthBranch: "진",
      season: "transition",
      temperature: "balanced",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-04-SA",
    purpose: "사월(초여름)",
    birthInput: { year: 1986, month: 5, day: 19, hour: 21, gender: "F" },
    expectedFourPillars: { year: "병인", month: "계사", day: "계해", hour: "임술" },
    expectedSeasonalContext: {
      monthBranch: "사",
      season: "summer",
      temperature: "warm",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-05-O",
    purpose: "오월(한여름) — 화가 극에 있는 자리",
    birthInput: { year: 1997, month: 6, day: 20, hour: 12, gender: "M" },
    expectedFourPillars: { year: "정축", month: "병오", day: "계사", hour: "무오" },
    expectedSeasonalContext: {
      monthBranch: "오",
      season: "summer",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-06-MI",
    purpose: "미월(조토) — 덥고 마른 자리",
    birthInput: { year: 1983, month: 7, day: 22, hour: 17, gender: "F" },
    expectedFourPillars: { year: "계해", month: "기미", day: "신해", hour: "병신" },
    expectedSeasonalContext: {
      monthBranch: "미",
      season: "transition",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-07-SIN",
    purpose: "신월(초가을)",
    birthInput: { year: 1990, month: 8, day: 20, hour: 6, gender: "M" },
    expectedFourPillars: { year: "경오", month: "갑신", day: "정사", hour: "계묘" },
    expectedSeasonalContext: {
      monthBranch: "신",
      season: "autumn",
      temperature: "balanced",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-08-YU",
    purpose: "유월(가을) — 금이 왕한 자리",
    birthInput: { year: 1979, month: 9, day: 21, hour: 19, gender: "F" },
    expectedFourPillars: { year: "기미", month: "계유", day: "신묘", hour: "정유" },
    expectedSeasonalContext: {
      monthBranch: "유",
      season: "autumn",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "unsupported",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-09-SUL",
    purpose: "술월(조토) — 서늘하고 마른 자리",
    birthInput: { year: 2001, month: 10, day: 22, hour: 11, gender: "M" },
    expectedFourPillars: { year: "신사", month: "무술", day: "무오", hour: "정사" },
    expectedSeasonalContext: {
      monthBranch: "술",
      season: "transition",
      temperature: "cool",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-10-HAE",
    purpose: "해월(초겨울)",
    birthInput: { year: 1975, month: 11, day: 20, hour: 14, gender: "F" },
    expectedFourPillars: { year: "을묘", month: "정해", day: "경오", hour: "계미" },
    expectedSeasonalContext: {
      monthBranch: "해",
      season: "winter",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-11-JA",
    purpose: "자월(한겨울) — 수가 극에 있는 자리",
    birthInput: { year: 1999, month: 12, day: 20, hour: 3, gender: "M" },
    expectedFourPillars: { year: "기묘", month: "병자", day: "병오", hour: "기축" },
    expectedSeasonalContext: {
      monthBranch: "자",
      season: "winter",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "MZ-12-CHUK",
    purpose: "축월(겨울 끝) — 기준 명식과 같은 월지",
    birthInput: { year: 1993, month: 1, day: 24, hour: 14, gender: "F" },
    expectedFourPillars: { year: "임신", month: "계축", day: "을사", hour: "계미" },
    expectedSeasonalContext: {
      monthBranch: "축",
      season: "transition",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "TB-01-BEFORE-IPCHUN",
    purpose: "입춘 하루 전 — 연주가 갈리는 자리",
    birthInput: { year: 1996, month: 2, day: 3, hour: 12, gender: "M" },
    expectedFourPillars: { year: "을해", month: "기축", day: "경오", hour: "임오" },
    expectedSeasonalContext: {
      monthBranch: "축",
      season: "transition",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "TB-02-AFTER-IPCHUN",
    purpose: "입춘 하루 뒤 — 위와 짝",
    birthInput: { year: 1996, month: 2, day: 5, hour: 12, gender: "M" },
    expectedFourPillars: { year: "병자", month: "경인", day: "임신", hour: "병오" },
    expectedSeasonalContext: {
      monthBranch: "인",
      season: "spring",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "TB-03-TERM-EDGE",
    purpose: "절입 당일 — 경계 표시가 서야 한다",
    birthInput: { year: 1987, month: 8, day: 8, hour: 9, gender: "F" },
    expectedFourPillars: { year: "정묘", month: "정미", day: "기축", hour: "무진" },
    expectedSeasonalContext: {
      monthBranch: "미",
      season: "transition",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "TB-04-TERM-DEEP",
    purpose: "절입 한복판 — 경계 표시가 없어야 한다",
    birthInput: { year: 1987, month: 8, day: 23, hour: 9, gender: "F" },
    expectedFourPillars: { year: "정묘", month: "무신", day: "갑진", hour: "무진" },
    expectedSeasonalContext: {
      monthBranch: "신",
      season: "autumn",
      temperature: "balanced",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "HR-01-EARLY-JA",
    purpose: "야자시 — 자시 앞쪽",
    birthInput: { year: 1992, month: 5, day: 10, hour: 23, gender: "M" },
    expectedFourPillars: { year: "임신", month: "을사", day: "병술", hour: "기해" },
    expectedSeasonalContext: {
      monthBranch: "사",
      season: "summer",
      temperature: "warm",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "ambiguous",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "HR-02-LATE-JA",
    purpose: "조자시 — 자시 뒤쪽, 날짜가 갈린다",
    birthInput: { year: 1992, month: 5, day: 11, hour: 0, gender: "M" },
    expectedFourPillars: { year: "임신", month: "을사", day: "병술", hour: "무자" },
    expectedSeasonalContext: {
      monthBranch: "사",
      season: "summer",
      temperature: "warm",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "HR-03-UNKNOWN",
    purpose: "시각 미상 — 시주가 서지 않는다",
    birthInput: { year: 1984, month: 6, day: 15, hour: null, gender: "F" },
    expectedFourPillars: { year: "갑자", month: "경오", day: "경진", hour: null },
    expectedSeasonalContext: {
      monthBranch: "오",
      season: "summer",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "ST-01-STRONG",
    purpose: "일간이 뿌리를 많이 둔 명식",
    birthInput: { year: 1980, month: 3, day: 5, hour: 5, gender: "M" },
    expectedFourPillars: { year: "경신", month: "무인", day: "정축", hour: "임인" },
    expectedSeasonalContext: {
      monthBranch: "인",
      season: "spring",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "ST-02-WEAK",
    purpose: "일간이 계절을 거스르고 설기가 많은 명식",
    birthInput: { year: 1995, month: 7, day: 3, hour: 13, gender: "F" },
    expectedFourPillars: { year: "을해", month: "임오", day: "을미", hour: "임오" },
    expectedSeasonalContext: {
      monthBranch: "오",
      season: "summer",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "ST-03-EVEN",
    purpose: "중화에 가까운 명식",
    birthInput: { year: 1989, month: 4, day: 12, hour: 16, gender: "M" },
    expectedFourPillars: { year: "기사", month: "무진", day: "임인", hour: "무신" },
    expectedSeasonalContext: {
      monthBranch: "진",
      season: "transition",
      temperature: "balanced",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "GK-01-EXPOSED-MAIN",
    purpose: "월지 본기가 투간 — 격이 뚜렷할 후보",
    birthInput: { year: 1977, month: 10, day: 9, hour: 7, gender: "M" },
    expectedFourPillars: { year: "정사", month: "경술", day: "기해", hour: "정묘" },
    expectedSeasonalContext: {
      monthBranch: "술",
      season: "transition",
      temperature: "cool",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "GK-02-NO-EXPOSURE",
    purpose: "월지 지장간이 하나도 투간하지 않음",
    birthInput: { year: 2003, month: 12, day: 3, hour: 22, gender: "F" },
    expectedFourPillars: { year: "계미", month: "계해", day: "경술", hour: "정해" },
    expectedSeasonalContext: {
      monthBranch: "해",
      season: "winter",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "GK-03-MONTH-CLASHED",
    purpose: "월지가 충을 맞음 — 격이 흔들리는 자리",
    birthInput: { year: 1982, month: 9, day: 14, hour: 4, gender: "M" },
    expectedFourPillars: { year: "임술", month: "기유", day: "경자", hour: "무인" },
    expectedSeasonalContext: {
      monthBranch: "유",
      season: "autumn",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "unsupported",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "GK-04-MONTH-COMBINED",
    purpose: "월지가 육합에 묶임",
    birthInput: { year: 1998, month: 11, day: 27, hour: 18, gender: "F" },
    expectedFourPillars: { year: "무인", month: "계해", day: "무인", hour: "신유" },
    expectedSeasonalContext: {
      monthBranch: "해",
      season: "winter",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "unanimous",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "GK-05-BIGYEOP-MONTH",
    purpose: "월지가 비겁 — 내격 후보가 안 서는 자리",
    birthInput: { year: 1993, month: 3, day: 30, hour: 20, gender: "M" },
    expectedFourPillars: { year: "계유", month: "을묘", day: "경술", hour: "병술" },
    expectedSeasonalContext: {
      monthBranch: "묘",
      season: "spring",
      temperature: "cool",
      moisture: "balanced",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "insufficient_evidence",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "CF-01-WINTER-WEAK",
    purpose: "겨울생 신약 — 조후와 억부가 갈릴 후보",
    birthInput: { year: 2000, month: 1, day: 8, hour: 2, gender: "F" },
    expectedFourPillars: { year: "기묘", month: "정축", day: "을축", hour: "정축" },
    expectedSeasonalContext: {
      monthBranch: "축",
      season: "transition",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "CF-02-SUMMER-WEAK",
    purpose: "여름생 신약 — 위의 반대쪽",
    birthInput: { year: 1985, month: 7, day: 12, hour: 15, gender: "M" },
    expectedFourPillars: { year: "을축", month: "계미", day: "임자", hour: "정미" },
    expectedSeasonalContext: {
      monthBranch: "미",
      season: "transition",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "CF-03-WINTER-STRONG",
    purpose: "겨울생 신강 — 조후와 억부가 같은 쪽을 볼 후보",
    birthInput: { year: 1978, month: 12, day: 28, hour: 1, gender: "F" },
    expectedFourPillars: { year: "무오", month: "갑자", day: "갑자", hour: "갑자" },
    expectedSeasonalContext: {
      monthBranch: "자",
      season: "winter",
      temperature: "cold",
      moisture: "wet",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "unanimous",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "CF-04-SUMMER-STRONG",
    purpose: "여름생 신강",
    birthInput: { year: 2004, month: 6, day: 6, hour: 11, gender: "M" },
    expectedFourPillars: { year: "갑신", month: "경오", day: "병진", hour: "계사" },
    expectedSeasonalContext: {
      monthBranch: "오",
      season: "summer",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "ambiguous",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
  {
    id: "PT-01-PARTNER",
    purpose: "기준 명식의 상대 — 궁합 경로 회귀",
    birthInput: { year: 1991, month: 7, day: 8, hour: 20, gender: "M" },
    expectedFourPillars: { year: "신미", month: "을미", day: "기묘", hour: "갑술" },
    expectedSeasonalContext: {
      monthBranch: "미",
      season: "transition",
      temperature: "hot",
      moisture: "dry",
    },
    expectedGyeokgukStatus: "determined",
    expectedConflictKind: "conflict",
    approvedPolicyAssertions: [],
    sourceNotes: [],
    reviewState: "computation_reviewed",
  },
];

const BY_ID = new Map(REVIEWED_FIXTURES.map((f) => [f.id, f]));

export function reviewedFixture(id: string): AdvancedFixture | null {
  return BY_ID.get(id) ?? null;
}

export function fixtureReviewSummary() {
  const total = FIXTURE_INPUTS.length;
  const computationReviewed = REVIEWED_FIXTURES.filter(
    (f) => f.reviewState === "computation_reviewed" || f.reviewState === "reviewed"
  ).length;
  const reviewed = REVIEWED_FIXTURES.filter((f) => f.reviewState === "reviewed").length;
  return {
    total,
    computationReviewed,
    reviewed,
    pending: total - reviewed,
    /** 판단 칸이 하나라도 비어 있으면 policy_enabled 로 갈 수 없다 */
    gatesPolicyEnabled: reviewed < total,
  };
}

export const FIXTURE_SUITE_VERSION = "advanced-fixtures-v1-computation-2026-08";
