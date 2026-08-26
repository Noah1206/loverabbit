// 퍼널 사건의 이름표 — 클라이언트와 서버가 같은 목록을 본다.
//
// 서버가 이 목록으로 한 번 더 거른다. 브라우저에서 오는 값은 누구나 지어낼 수
// 있고, 거르지 않으면 이 표가 아무 문자열이나 받는 자유 게시판이 된다.

/** 리딩 폼의 칸. 화면(reading/page.tsx)의 단계 타입이 이 목록에서 나온다. */
export const READING_STEPS = [
  "category",
  "meGender",
  "meBirth",
  "meDetails",
  "partnerChoice",
  "partnerBirth",
  "partnerDetails",
  "mode",
  "concern",
  "ready",
] as const;

export type ReadingStepName = (typeof READING_STEPS)[number];

/** 남기는 사건. 여기 없는 이름은 서버가 버린다. */
export const FUNNEL_EVENTS = [
  /** 어느 화면을 열었다 */
  "page_view",
  /** 그 화면을 떠났다 (머문 시간과 함께). 세션의 마지막 것이 곧 이탈 지점이다 */
  "page_exit",
  /** 리딩 폼의 칸이 하나 보였다 */
  "step_view",
  /** 폼을 다 채우고 보냈다 */
  "preview_requested",
  /** 로그인 관문에 막혔다 */
  "signup_required",
  /** 리딩이 만들어졌다 */
  "preview_generated",
  /** 만들다 실패했다 */
  "preview_failed",
  /** 리딩 화면을 열었다 */
  "reading_view",
  /** 전문 보기를 눌렀다 */
  "unlock_clicked",
  /** 결제창이 열렸다 */
  "checkout_opened",
  /** 결제를 보냈다 */
  "checkout_submitted",
  /** 결제가 끝났다 */
  "purchase_done",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

const EVENT_SET: ReadonlySet<string> = new Set(FUNNEL_EVENTS);
const STEP_SET: ReadonlySet<string> = new Set(READING_STEPS);

export function isFunnelEvent(value: unknown): value is FunnelEventName {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function isReadingStep(value: unknown): value is ReadingStepName {
  return typeof value === "string" && STEP_SET.has(value);
}

/**
 * 사람이 지나가는 순서. 보고 화면이 이 순서로 줄을 세우고, 두 줄의 차이가
 * 곧 그 사이에서 잃은 사람 수다.
 *
 * page_view / page_exit 는 여기 없다. 그 둘은 모든 화면에서 나므로 단계가
 * 아니라 배경이다 — "어느 페이지에서 나갔나" 는 그쪽을 따로 센다.
 */
export const FUNNEL_ORDER: { name: FunnelEventName; label: string }[] = [
  { name: "step_view", label: "리딩 폼 진입" },
  { name: "preview_requested", label: "폼 제출" },
  /*
    이름은 preview_generated 로 둔다 — 바꾸면 이 이름으로 쌓인 지난 기록이
    통째로 끊긴다. 다만 보이는 말은 실제와 맞춘다.

    결제 선불로 바꾼 뒤(reading-gate.ts) 이 자리에서 만들어지는 것은 글이
    아니라 명식·지수·목차다. "리딩 생성" 이라고 적어 두면, 생성 129건에 AI
    비용이 0원인 표를 보고 무엇이 고장 났는지 찾게 된다.
  */
  { name: "preview_generated", label: "명식 세움" },
  { name: "reading_view", label: "리딩 열람" },
  { name: "unlock_clicked", label: "전문 보기 클릭" },
  { name: "checkout_opened", label: "결제창 열림" },
  { name: "checkout_submitted", label: "결제 요청" },
  { name: "purchase_done", label: "결제 완료" },
];

/**
 * 경로에서 사람 이름표를 걷어낸다.
 *
 * `/reading/9c1f…` 를 그대로 두면 리딩 하나하나가 각자 다른 페이지가 되어
 * "어느 페이지에서 나갔나" 를 셀 수 없다. 동적 구간을 접어 한 줄로 모은다.
 * 쿼리도 버린다 — utm 은 attribution 이 따로 들고 있고, 쿼리째 남기면 주소에
 * 실려 온 아무 값이나 이 표에 앉는다.
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/")) return null;
  // /reading/generating 은 결과가 아니라 대기 화면이다. 같이 접으면 생성만
  // 보고 나간 사람이 "리딩 열람"으로 세어져 열람 단계가 부풀었다.
  const folded = path
    .replace(/\/reading\/(?!generating(?:\/|$))[^/]+/, "/reading/[id]")
    .replace(/\/shrine\/[^/]+/, "/shrine/[id]")
    .replace(/\/product\/[^/]+/, "/product/[id]")
    .replace(/\/dark\/[^/]+/, "/dark/[id]");
  return folded.slice(0, 120);
}
