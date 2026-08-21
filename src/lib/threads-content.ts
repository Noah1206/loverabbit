// Threads 초안의 데이터 모델과 상태 전이.
//
// 지시 문서 B가 정한 필드를 그대로 담되, 이름은 이 저장소의 camelCase 관례를 따른다.
// 상태 전이를 여기 한 곳에 모아 두는 이유는 하나다 — 게시로 가는 길이 여러 군데에
// 흩어져 있으면 "승인 없이 나갔다"가 언젠가 반드시 생긴다.

import type { AuthorizedReuseMode } from "@/content/reference/sajushiba/permission-registry";

export type { AuthorizedReuseMode };

/** 게시 모드. 기본값은 draft_only 이고, 환경변수로만 올라간다. */
export type ThreadPublishMode = "draft_only" | "approved_manual" | "scheduled";

export type ThreadDraftStatus =
  | "draft"
  | "guard_failed"
  | "needs_review"
  | "blocked_by_missing_facts"
  // 허가 증빙(경로·확인자·확인일)이 비어 원문 재사용 모드가 열리지 않은 상태.
  // 실패가 아니라 사람이 채우면 그대로 풀리는 자리라, 다른 이름을 준다.
  | "needs_permission_metadata"
  | "approved"
  | "scheduled"
  | "published";

export type ThreadContentLane =
  | "daily_zodiac"
  | "weekly_ranking"
  | "inner_world"
  | "warning_card"
  | "free_reading"
  | "app_story"
  | "individual_reading";

export type ThreadGoal = "reach" | "save" | "engagement" | "conversion";

export type ThreadCtaType = "comment" | "follow" | "link" | "share";

export interface ReferenceSource {
  postId: string;
  url: string;
  directCopyAllowed: boolean;
  extractionStatus: "complete" | "partial_parent_unavailable";
}

/**
 * 모델에 넘길 승인된 명리 사실 하나.
 *
 * `ruleId`는 reading-rules.ts의 규칙 ID이거나, 일진처럼 계산으로 확정되는 사실의
 * 어댑터 ID다. `claimId`는 그 규칙 안에서 어느 주장을 골랐는지 가리킨다 —
 * 규칙 하나가 claim과 safePhrasing을 함께 갖고 있어, 어느 쪽을 썼는지 남겨야
 * 나중에 문장을 되짚을 수 있다.
 */
export interface ApprovedFact {
  ruleId: string;
  claimId: string;
  safePhrasing: string;
  scope: string;
}

export interface ThreadRankingEntry {
  rank: number;
  label: string;
  score?: number;
}

export interface ThreadColorGuide {
  target: string;
  avoid: string[];
  recommended: string[];
}

export interface LoveRabbitContentInput {
  id: string;
  contentLane: ThreadContentLane;
  goal: ThreadGoal;
  selectedPatternId: string;
  approvedFacts: ApprovedFact[];
  variables: {
    date?: string;
    ganji?: string;
    zodiacs?: string[];
    dayStems?: string[];
    dayPillars?: string[];
    ranking?: ThreadRankingEntry[];
    colors?: ThreadColorGuide[];
    cta: { type: ThreadCtaType; text: string };
  };
  /**
   * 이 입력을 만들 수 없었던 이유. 비어 있지 않으면 생성으로 넘기지 않고
   * blocked_by_missing_facts 로 저장한다. 지시 문서 G의 요구다.
   */
  missingFacts?: string[];
}

export interface ThreadPostBody {
  sequence: number;
  body: string;
  charCount: number;
}

/**
 * 원문에서 그대로 옮긴 한 구간.
 *
 * 어디서(sourcePostId) 어디부터 어디까지(sourceStart~sourceEnd) 가져왔는지를 남긴다.
 * 오프셋까지 남기는 이유는, 나중에 "그 문장이 정말 그 글에 있었나"를 원문과 대조해
 * 기계적으로 확인할 수 있게 하기 위해서다. 문장만 남기면 대조가 사람 눈에 의존한다.
 */
export interface DirectCopySpan {
  sourcePostId: string;
  sourceStart: number;
  sourceEnd: number;
  text: string;
  reuseMode: "verbatim_excerpt" | "verbatim_full_post";
  /** 원문에서 무엇을 바꿔야 했는지 */
  replacementReason?: "brand" | "link" | "date" | "ganji" | "score" | "ranking" | "privacy";
}

/**
 * 원문의 한 대목을 러브레빗 것으로 바꾼 기록.
 *
 * close_adaptation 의 산출물이다. 무엇을 왜 바꿨는지가 남아야, 나중에 "이건
 * 사주시바 글인가 러브레빗 글인가"라는 질문에 문장 단위로 답할 수 있다.
 */
export type TransformReason =
  | "approved_fact_swap"
  | "brand_swap"
  | "cta_swap"
  | "time_sensitive_value"
  | "privacy";

export const TRANSFORM_REASONS: TransformReason[] = [
  "approved_fact_swap",
  "brand_swap",
  "cta_swap",
  "time_sensitive_value",
  "privacy",
];

export interface SourceTransformLog {
  sourcePostId: string;
  sourceSection: string;
  originalText: string;
  transformedText: string;
  reason: TransformReason;
  /**
   * 모델이 적어 낸 설명.
   *
   * reason 은 분류라 다섯 개뿐이지만, 실제로 무엇을 왜 바꿨는지는 그보다 길다.
   * 처음에는 모델이 그 긴 설명을 reason 에 밀어 넣었고 — 타입은 유니온인데
   * 런타임은 아무 문자열이나 받아 조용히 통과했다. 자리를 따로 내주는 편이
   * 분류도 지키고 설명도 남긴다.
   */
  note?: string;
}

export interface GeneratedThreadDraft {
  id: string;
  status: ThreadDraftStatus;
  inputId: string;
  patternId: string;
  benchmarkSourcePostIds: string[];
  directCopySourcePostIds: string[];
  /** 원문에서 그대로 옮긴 문장 — 미리보기에서 사람이 눈으로 보는 대상 */
  directCopyExcerpts: Array<{ postId: string; text: string }>;
  /** 이 초안이 원문을 어디까지 쓴 모드인가 */
  reuseMode: AuthorizedReuseMode;
  /** verbatim_* 일 때 실제로 옮긴 구간 */
  directCopySpans: DirectCopySpan[];
  /** close_adaptation 일 때 무엇을 왜 바꿨는가 */
  sourceTransformLog: SourceTransformLog[];
  /** verbatim_full_post 로 원문 전체를 쓴 경우 */
  fullReuse?: boolean;
  posts: ThreadPostBody[];
  ruleIdsUsed: string[];
  claimIdsUsed: string[];
  cta: { type: string; text: string };
  guardResult: unknown;
  llmReviewResult: unknown | null;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  scheduledFor?: string;
  publishedThreadsIds?: string[];
  publishedAt?: string;
  /** 체인 첫 글의 링크 — 사람이 결과를 눈으로 확인하는 유일한 값 */
  publishedPermalink?: string;
  /**
   * 마지막 발행 시도가 실패한 이유.
   *
   * 실패를 지우지 않고 남긴다. 체인 도중에 끊기면 앞 글은 이미 올라가 있고,
   * 그 사실이 어딘가 적혀 있지 않으면 다시 눌러 같은 글이 두 번 올라간다.
   */
  publishError?: string;
  /** blocked_by_missing_facts 일 때 무엇이 없었는지 */
  missingFacts?: string[];
}

/** UTF-8 기준이 아니라 코드 포인트 기준으로 센다 — Threads가 세는 방식과 같다. */
export const MAX_POST_CHARS = Number(process.env.THREADS_MAX_POST_CHARS ?? 500);

export function countChars(text: string): number {
  return [...text].length;
}

export function publishMode(env: Record<string, string | undefined> = process.env): ThreadPublishMode {
  const raw = env.THREADS_PUBLISH_MODE;
  if (raw === "approved_manual" || raw === "scheduled") return raw;
  // 오타나 빈 값이 조용히 게시 모드로 읽히면 안 된다. 모르면 draft_only 다.
  return "draft_only";
}

/**
 * 원문 문장을 그대로 옮기는 것을 허용할지.
 *
 * 기본은 꺼짐이다. 코퍼스가 기록하는 허가 근거는
 * permission_scope="user_asserted_style_and_copy_reuse" — 운영자의 진술뿐이고,
 * source_method는 공개 페이지 수집이다. 구조·패턴 벤치마킹은 이 플래그와 무관하게
 * 항상 켜져 있으므로, 꺼져 있어도 파이프라인은 전부 돈다.
 */
export function allowDirectCopy(env: Record<string, string | undefined> = process.env): boolean {
  return env.THREADS_ALLOW_DIRECT_COPY === "1";
}

/** draft → ... → published. 여기 없는 전이는 전부 거부한다. */
const TRANSITIONS: Record<ThreadDraftStatus, ThreadDraftStatus[]> = {
  draft: ["guard_failed", "needs_review", "approved"],
  guard_failed: ["draft"],
  needs_review: ["approved", "guard_failed", "draft"],
  blocked_by_missing_facts: ["draft"],
  // 증빙을 채우면 다시 생성으로 돌아간다. 승인으로 바로 가지 않는다 —
  // 증빙이 생겼다고 글이 검수된 것은 아니다.
  needs_permission_metadata: ["draft"],
  approved: ["scheduled", "published", "needs_review"],
  scheduled: ["published", "approved"],
  published: [],
};

export function canTransition(from: ThreadDraftStatus, to: ThreadDraftStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export class ThreadStateError extends Error {}

export function transition(
  draft: GeneratedThreadDraft,
  to: ThreadDraftStatus
): GeneratedThreadDraft {
  if (!canTransition(draft.status, to)) {
    throw new ThreadStateError(`${draft.status} → ${to} 전이는 허용되지 않는다`);
  }
  return { ...draft, status: to };
}

/**
 * 이 초안을 외부로 내보내도 되는가.
 *
 * 게시 함수 안에서만 검사하면 늦다. 대시보드·CLI·스케줄러가 각자 판단하지 않도록
 * 판단을 여기 하나로 모은다.
 *
 * 사람이 누르는 길과 스케줄러가 도는 길이 서로 다른 것을 요구한다.
 *  - 사람이 누를 때(now 없음): 승인만 확인한다. 화면에서 본문을 보고 누른 것이라
 *    예약 시각이 남아 있든 아니든 그 판단이 최신이다.
 *  - 스케줄러가 돌 때(now 있음): 예약 시각을 지킨다. 그리고 THREADS_PUBLISH_MODE 가
 *    scheduled 일 때만 돈다 — 자동으로 나가는 길은 사람이 한 번 더 켜야 열린다.
 */
export function publishBlockReason(
  draft: GeneratedThreadDraft,
  mode: ThreadPublishMode = publishMode(),
  now?: Date
): string | null {
  if (mode === "draft_only") {
    return "THREADS_PUBLISH_MODE=draft_only — 외부 게시를 하지 않는 모드다";
  }
  if (draft.status === "published") return "이미 게시된 초안이다";
  if (draft.status !== "approved" && draft.status !== "scheduled") {
    return `승인되지 않았다 (현재 ${draft.status})`;
  }
  if (!draft.approvedBy) return "승인자가 기록되지 않았다";

  // 사람이 누른 길은 여기서 끝난다.
  if (!now) return null;

  // 아래는 스케줄러만 지나간다.
  if (mode !== "scheduled") {
    return "THREADS_PUBLISH_MODE=scheduled 가 아니다 — 자동 발행은 하지 않는다";
  }
  if (draft.status !== "scheduled") return `예약 상태가 아니다 (현재 ${draft.status})`;
  if (!draft.scheduledFor) return "예약 시각이 없다";
  const at = Date.parse(draft.scheduledFor);
  if (Number.isNaN(at)) return `예약 시각을 읽을 수 없다 (${draft.scheduledFor})`;
  if (at > now.getTime()) return `아직 예약 시각 전이다 (${draft.scheduledFor})`;
  return null;
}
