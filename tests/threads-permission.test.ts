// 허가 레지스트리가 무엇을 열고 무엇을 잠그는지.
//
// 이 파일이 지키는 것은 "허가는 사람이 준다"는 한 줄이다. 코드가 스스로 여는
// 경로가 생기면 레지스트리는 장식이 된다. 그래서 증빙이 비어 있는 지금 상태에서
// verbatim_* 가 잠겨 있다는 것을 못 박아 둔다 — 나중에 누가 편의로 여는 날
// 이 테스트가 먼저 말한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  PERMISSION_REGISTRY,
  hasEvidence,
  isVerbatim,
  permissionFor,
  registryReport,
  reuseDecision,
  type AuthorizedSourcePermission,
} from "@/content/reference/sajushiba/permission-registry";
import { loadCorpus } from "@/lib/threads-corpus";

const corpus = loadCorpus().rows;

describe("레지스트리와 코퍼스가 맞물린다", () => {
  it("코퍼스의 11개 게시물이 전부 레지스트리에 있다", () => {
    for (const row of corpus) {
      assert.notEqual(permissionFor(row.post_id), null, `${row.post_id} 가 레지스트리에 없다`);
    }
  });

  it("레지스트리에 코퍼스 밖 게시물이 없다", () => {
    const known = new Set(corpus.map((r) => r.post_id));
    for (const permission of PERMISSION_REGISTRY) {
      assert.equal(known.has(permission.sourcePostId), true, permission.sourcePostId);
    }
  });

  it("모든 항목이 최소한 pattern_only는 허용한다", () => {
    for (const permission of PERMISSION_REGISTRY) {
      assert.equal(permission.allowedModes.includes("pattern_only"), true, permission.sourcePostId);
    }
  });
});

describe("증빙이 없으면 원문 재사용이 열리지 않는다", () => {
  it("지금은 증빙이 비어 있다", () => {
    const report = registryReport();
    assert.equal(report.evidenceReady, false, "증빙이 채워졌다면 이 테스트를 갱신해야 한다");
    assert.equal(report.needsMetadata, report.total);
  });

  it("verbatim_excerpt를 허용한 게시물도 needs_permission_metadata로 막힌다", () => {
    const candidates = PERMISSION_REGISTRY.filter((p) => p.allowedModes.includes("verbatim_excerpt"));
    assert.equal(candidates.length > 0, true, "verbatim 후보가 하나는 있어야 한다");
    for (const permission of candidates) {
      const decision = reuseDecision(permission.sourcePostId, "verbatim_excerpt", {
        extractionStatus: "complete",
      });
      assert.equal(decision.ok, false, permission.sourcePostId);
      if (!decision.ok) assert.equal(decision.status, "needs_permission_metadata");
    }
  });

  // 앞의 두 모드는 원문 문장을 옮기지 않으므로 증빙 없이 돈다.
  // 이게 열려 있어야 파이프라인 전체가 증빙을 기다리며 멈추지 않는다.
  it("pattern_only와 close_adaptation은 증빙 없이 열린다", () => {
    for (const mode of ["pattern_only", "close_adaptation"] as const) {
      const decision = reuseDecision("SS-20260805-HIDDEN-PAIN", mode);
      assert.equal(decision.ok, true, `${mode} 가 막혔다`);
    }
  });

  it("증빙 세 줄이 다 채워져야 hasEvidence가 참이다", () => {
    const base: AuthorizedSourcePermission = {
      sourcePostId: "X",
      allowed: true,
      allowedModes: ["verbatim_excerpt"],
      permissionEvidencePath: "docs/permissions/x.png",
      approvedBy: "운영자",
      approvedAt: "2026-08-20",
    };
    assert.equal(hasEvidence(base), true);
    assert.equal(hasEvidence({ ...base, approvedBy: "" }), false);
    assert.equal(hasEvidence({ ...base, approvedAt: "   " }), false);
    assert.equal(hasEvidence({ ...base, permissionEvidencePath: "" }), false);
  });
});

describe("허가되지 않은 조합은 이유를 남기고 막힌다", () => {
  it("코퍼스 밖 게시물", () => {
    const decision = reuseDecision("OTHER-ACCOUNT-001", "pattern_only");
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, "unknown_source");
  });

  it("그 게시물이 허용하지 않는 모드", () => {
    // 부모 글이 없는 행은 pattern_only 만 허용한다.
    const decision = reuseDecision("SS-20260731-WEEKLY-LOVE-REPLIES", "verbatim_excerpt");
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, "mode_not_allowed");
  });

  it("문맥이 잘린 원문은 verbatim이 막힌다", () => {
    // allowedModes 를 넉넉히 준 게시물이라도 추출 상태가 잘려 있으면 막는다.
    const decision = reuseDecision("SS-20260805-HIDDEN-PAIN", "verbatim_excerpt", {
      extractionStatus: "partial_parent_unavailable",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, "context_truncated");
  });

  it("전문 재사용은 브랜드·시의성이 없는 둘만 후보다", () => {
    const full = PERMISSION_REGISTRY.filter((p) => p.allowedModes.includes("verbatim_full_post"));
    assert.deepEqual(
      full.map((p) => p.sourcePostId).sort(),
      ["SS-20260805-HIDDEN-PAIN", "SS-20260807-HIDDEN-MIND"]
    );
  });
});

describe("isVerbatim", () => {
  it("두 verbatim 모드만 참이다", () => {
    assert.equal(isVerbatim("verbatim_excerpt"), true);
    assert.equal(isVerbatim("verbatim_full_post"), true);
    assert.equal(isVerbatim("close_adaptation"), false);
    assert.equal(isVerbatim("pattern_only"), false);
  });
});
