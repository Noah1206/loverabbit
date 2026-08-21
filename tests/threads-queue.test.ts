// 초안이 승인을 건너뛰지 못하는지.
//
// 발행 자체는 이제 이 저장소에 없다 — 별도 콘솔(loverabbit-threads)이 한다.
// 여기 남은 것은 생성기가 만들어 내보내는 초안의 상태 규칙이고, 그 규칙이
// 깨지면 콘솔이 무엇을 받든 소용이 없다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  canTransition,
  publishBlockReason,
  publishMode,
  transition,
  ThreadStateError,
  type GeneratedThreadDraft,
} from "@/lib/threads-content";
import { approve, previewOf, schedule } from "@/lib/threads-queue";

function draftWith(over: Partial<GeneratedThreadDraft> = {}): GeneratedThreadDraft {
  return {
    id: "draft-1",
    status: "draft",
    inputId: "t1",
    patternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
    benchmarkSourcePostIds: [],
    directCopySourcePostIds: [],
    directCopyExcerpts: [],
    reuseMode: "pattern_only",
    directCopySpans: [],
    sourceTransformLog: [],
    posts: [
      { sequence: 1, body: "첫 글이에요.", charCount: 7 },
      { sequence: 2, body: "둘째 글이에요.", charCount: 8 },
    ],
    ruleIdsUsed: [],
    claimIdsUsed: [],
    cta: { type: "comment", text: "댓글로 알려줘요." },
    guardResult: null,
    llmReviewResult: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    ...over,
  };
}

describe("기본 모드는 draft_only", () => {
  it("환경변수가 없으면 draft_only", () => {
    assert.equal(publishMode({}), "draft_only");
  });

  it("오타는 게시 모드로 읽지 않는다", () => {
    assert.equal(publishMode({ THREADS_PUBLISH_MODE: "aproved_manual" }), "draft_only");
    assert.equal(publishMode({ THREADS_PUBLISH_MODE: "" }), "draft_only");
  });

  it("draft_only 면 승인·예약이 끝났어도 막는다", () => {
    const ready = draftWith({
      status: "scheduled",
      approvedBy: "운영자",
      scheduledFor: "2026-08-22T09:00:00+09:00",
    });
    assert.match(publishBlockReason(ready, "draft_only") ?? "", /draft_only/);
  });
});

describe("상태 전이", () => {
  it("draft에서 곧장 published로 못 간다", () => {
    assert.equal(canTransition("draft", "published"), false);
    assert.throws(() => transition(draftWith(), "published"), ThreadStateError);
  });

  it("guard_failed는 다시 draft로만 간다", () => {
    assert.equal(canTransition("guard_failed", "approved"), false);
    assert.equal(canTransition("guard_failed", "draft"), true);
  });

  it("막힌 초안은 승인으로 못 간다", () => {
    assert.equal(canTransition("blocked_by_missing_facts", "approved"), false);
  });

  it("published는 끝이다", () => {
    assert.equal(canTransition("published", "approved"), false);
  });
});

describe("허가 대기 상태는 승인으로 가지 못한다", () => {
  it("needs_permission_metadata -> approved 는 막힌다", () => {
    assert.equal(canTransition("needs_permission_metadata", "approved"), false);
    assert.throws(
      () =>
        approve(
          draftWith({ status: "needs_permission_metadata" }),
          "운영자",
          "2026-08-20T00:00:00.000Z"
        ),
      ThreadStateError
    );
  });

  // 증빙을 채우면 다시 생성으로 돌아간다. 증빙이 생겼다고 글이 검수된 것은 아니다.
  it("증빙을 채우면 draft 로 돌아간다", () => {
    assert.equal(canTransition("needs_permission_metadata", "draft"), true);
  });
});

describe("승인 대기열", () => {
  it("승인자 없이 승인할 수 없다", () => {
    assert.throws(() => approve(draftWith(), "  ", "2026-08-20T00:00:00.000Z"), ThreadStateError);
  });

  it("승인되지 않은 초안은 예약할 수 없다", () => {
    assert.throws(
      () => schedule(draftWith({ status: "approved" }), "2026-08-22T09:00:00+09:00"),
      ThreadStateError
    );
  });

  it("승인 → 예약 순서는 통과한다", () => {
    const approved = approve(draftWith(), "운영자", "2026-08-20T00:00:00.000Z");
    const scheduled = schedule(approved, "2026-08-22T09:00:00+09:00");
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.approvedBy, "운영자");
  });

  it("미리보기에 상태·모드·본문이 함께 나온다", () => {
    const preview = previewOf(draftWith());
    assert.match(preview, /\[draft\] draft-1/);
    assert.match(preview, /모드 pattern_only/);
    assert.match(preview, /첫 글이에요/);
  });
});
