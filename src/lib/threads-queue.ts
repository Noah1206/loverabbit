// 승인 대기열.
//
// 지금은 파일 하나다 — .threads-drafts.json. Supabase 테이블로 가지 않은 이유는
// 초안이 아직 사람 손을 떠난 적이 없기 때문이다. draft_only 단계에서 필요한 것은
// "무엇이 만들어졌고 누가 승인했는가"를 잃지 않는 것뿐이고, 그건 파일로 된다.
//
// 게시를 켜는 날 이 파일의 스키마가 그대로 테이블 컬럼이 된다. 그때 옮기면 된다.
// 먼저 테이블을 만들어 두면, 한 번도 안 쓴 컬럼이 마이그레이션에 남는다.

import fs from "node:fs";
import path from "node:path";

import type { GeneratedThreadDraft, ThreadDraftStatus } from "@/lib/threads-content";
import { ThreadStateError, transition } from "@/lib/threads-content";

export const QUEUE_PATH = ".threads-drafts.json";

interface QueueFile {
  version: 1;
  drafts: GeneratedThreadDraft[];
}

function resolve(rel: string): string {
  return path.resolve(process.cwd(), rel);
}

/**
 * 예전 스키마로 저장된 초안을 지금 모양으로 맞춘다.
 *
 * 큐는 파일이라 스키마가 바뀌어도 안에 있던 것들은 그대로 남는다. 원문 재사용
 * 모드가 생기기 전에 만든 초안에는 reuseMode 가 없고, 화면과 미리보기가 그 자리를
 * undefined 로 읽는다. 없으면 pattern_only 다 — 그때는 그 모드밖에 없었으므로
 * 추측이 아니라 사실이다.
 */
function normalize(draft: GeneratedThreadDraft): GeneratedThreadDraft {
  return {
    ...draft,
    reuseMode: draft.reuseMode ?? "pattern_only",
    directCopySpans: draft.directCopySpans ?? [],
    sourceTransformLog: draft.sourceTransformLog ?? [],
    directCopyExcerpts: draft.directCopyExcerpts ?? [],
  };
}

export function loadQueue(rel = QUEUE_PATH): GeneratedThreadDraft[] {
  const file = resolve(rel);
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as QueueFile;
  return Array.isArray(parsed.drafts) ? parsed.drafts.map(normalize) : [];
}

export function saveQueue(drafts: GeneratedThreadDraft[], rel = QUEUE_PATH): void {
  const payload: QueueFile = { version: 1, drafts };
  fs.writeFileSync(resolve(rel), JSON.stringify(payload, null, 2), "utf8");
}

export function upsert(drafts: GeneratedThreadDraft[], draft: GeneratedThreadDraft): GeneratedThreadDraft[] {
  const at = drafts.findIndex((d) => d.id === draft.id);
  if (at < 0) return [...drafts, draft];
  const next = [...drafts];
  next[at] = draft;
  return next;
}

export function byStatus(drafts: GeneratedThreadDraft[], status: ThreadDraftStatus): GeneratedThreadDraft[] {
  return drafts.filter((d) => d.status === status);
}

/**
 * 승인.
 *
 * 승인자를 반드시 받는다. 승인자 없이 approved 로 올라간 초안은 나중에
 * "누가 봤는가"에 답할 수 없고, 게시 안전장치가 그 답을 요구한다.
 */
export function approve(
  draft: GeneratedThreadDraft,
  approvedBy: string,
  approvedAt: string
): GeneratedThreadDraft {
  if (!approvedBy.trim()) throw new ThreadStateError("승인자가 비어 있다");
  return { ...transition(draft, "approved"), approvedBy, approvedAt };
}

export function schedule(draft: GeneratedThreadDraft, scheduledFor: string): GeneratedThreadDraft {
  if (!draft.approvedBy) throw new ThreadStateError("승인되지 않은 초안은 예약할 수 없다");
  return { ...transition(draft, "scheduled"), scheduledFor };
}

/**
 * 게시 완료 기록.
 *
 * 여기서 published 로 올리는 것은 실제로 계정에 올라간 뒤여야 한다. 먼저 올려 두고
 * 발행하면, 발행이 실패했을 때 큐만 "게시됨"으로 남는다.
 */
export function markPublished(
  draft: GeneratedThreadDraft,
  result: { posts: Array<{ threadId: string }>; permalink: string | null; publishedAt: string }
): GeneratedThreadDraft {
  return {
    ...transition(draft, "published"),
    publishedThreadsIds: result.posts.map((p) => p.threadId),
    publishedPermalink: result.permalink ?? undefined,
    publishedAt: result.publishedAt,
    publishError: undefined,
  };
}

/**
 * 실패 기록.
 *
 * 상태는 그대로 둔다 — 실패했다고 승인이 취소된 것은 아니다. 다만 무엇이
 * 실패했는지는 남겨야, 다시 누르기 전에 사람이 그걸 본다. 체인이 도중에 끊겼다면
 * 이미 올라간 글의 ID까지 남긴다.
 */
export function markPublishFailed(
  draft: GeneratedThreadDraft,
  reason: string,
  partial: string[] = []
): GeneratedThreadDraft {
  return {
    ...draft,
    publishError: reason,
    publishedThreadsIds: partial.length > 0 ? partial : draft.publishedThreadsIds,
  };
}

/** 예약 시각이 지난 초안 — 스케줄러가 집어갈 것들 */
export function dueDrafts(drafts: GeneratedThreadDraft[], now = new Date()): GeneratedThreadDraft[] {
  return drafts
    .filter((d) => d.status === "scheduled" && d.scheduledFor)
    .filter((d) => {
      const at = Date.parse(d.scheduledFor as string);
      return !Number.isNaN(at) && at <= now.getTime();
    })
    // 밀린 것이 여러 개면 예약이 이른 것부터 나간다.
    .sort((a, b) => Date.parse(a.scheduledFor as string) - Date.parse(b.scheduledFor as string));
}

/** 사람이 볼 미리보기 — 지시 문서 F가 요구한 항목을 한 화면에 모은다 */
export function previewOf(draft: GeneratedThreadDraft): string {
  const lines: string[] = [];
  lines.push(`[${draft.status}] ${draft.id}`);
  lines.push(`입력 ${draft.inputId} / 패턴 ${draft.patternId} / 모드 ${draft.reuseMode}`);
  lines.push(`참조 원문: ${draft.benchmarkSourcePostIds.join(", ") || "(없음)"}`);
  lines.push(
    `직접 재사용: ${draft.directCopySourcePostIds.join(", ") || "(없음)"}`
  );
  for (const span of draft.directCopySpans ?? []) {
    lines.push(`  · ${span.sourcePostId} — "${span.text}"`);
  }
  for (const log of draft.sourceTransformLog ?? []) {
    lines.push(`  변형 [${log.reason}] "${log.originalText}" -> "${log.transformedText}"`);
  }
  lines.push(`규칙: ${draft.ruleIdsUsed.join(", ") || "(없음)"}`);
  lines.push(`CTA: ${draft.cta.type} — ${draft.cta.text}`);
  lines.push(`승인자: ${draft.approvedBy ?? "(미승인)"} / 예약: ${draft.scheduledFor ?? "(없음)"}`);
  if (draft.missingFacts?.length) {
    lines.push("막힌 이유:");
    for (const reason of draft.missingFacts) lines.push(`  - ${reason}`);
  }
  lines.push("");
  for (const post of draft.posts) {
    lines.push(`── ${post.sequence} (${post.charCount}자) ──`);
    lines.push(post.body);
    lines.push("");
  }
  return lines.join("\n");
}
