// 관계 리포트 문구 — 모델 없이 표에서 조립한다.
//
// 이 층이 지켜야 하는 것은 둘이다.
//   1. 같은 입력이면 같은 문장 (오늘 본 해석과 내일 본 해석이 같아야 한다)
//   2. 어떤 역할·점수·상태가 와도 빈 칸이 없다 (표에 구멍이 있으면 화면이 빈다)

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUIN_STATUSES, type GuinRole } from "../src/lib/guin-map";
import { bandOf, buildGuinReport } from "../src/lib/guin-templates";

const ROLES: GuinRole[] = [
  "right_hand",
  "comforter",
  "communicator",
  "growth_teacher",
  "benefactor",
  "mirror",
  "stimulator",
  "neutral",
];

const base = {
  participantId: "p1",
  participantNickname: "민지",
  role: "right_hand" as GuinRole,
  score: 82,
  status: null,
  conversationPrompt: "요즘 어땠어?",
};

describe("점수 구간", () => {
  it("높음·중간·낮음으로 갈린다", () => {
    assert.equal(bandOf(94), "high");
    assert.equal(bandOf(78), "high");
    assert.equal(bandOf(60), "mid");
    assert.equal(bandOf(30), "low");
  });
});

describe("같은 입력이면 같은 문장 — 뽑기가 아니다", () => {
  it("두 번 불러도 똑같다", () => {
    const a = buildGuinReport(base);
    const b = buildGuinReport(base);
    assert.deepEqual(a, b);
  });

  it("사람이 다르면 문장도 갈린다", () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, i) =>
        buildGuinReport({ ...base, participantId: `p${i}` }).summary
      )
    );
    // 표가 하나뿐이면 다 같아진다 — 최소한 둘 이상으로 갈려야 표를 쓰는 뜻이 있다
    assert.ok(seen.size >= 2, `문장이 하나로 몰렸다: ${[...seen]}`);
  });

  it("점수 구간이 바뀌면 문장도 바뀔 수 있다", () => {
    const high = buildGuinReport({ ...base, score: 95 });
    const low = buildGuinReport({ ...base, score: 30 });
    assert.notEqual(high.summary, low.summary);
  });
});

describe("빈 칸이 없다 — 어떤 역할이 와도", () => {
  it("모든 역할 × 모든 구간에 문장이 있다", () => {
    for (const role of ROLES) {
      for (const score of [95, 60, 20]) {
        const r = buildGuinReport({ ...base, role, score });
        assert.ok(r.summary.length > 0, `${role}/${score} summary 비었다`);
        assert.ok(r.roleExplanation.length > 0, `${role}/${score} 근거 비었다`);
        assert.equal(r.strengths.length, 2, `${role}/${score} 강점이 둘이 아니다`);
        assert.ok(r.caution.length > 0, `${role}/${score} 주의 비었다`);
        assert.ok(r.suggestedAction.length > 0, `${role}/${score} 행동 비었다`);
      }
    }
  });

  it("모든 관계 상태에 한 줄이 붙는다", () => {
    for (const status of GUIN_STATUSES) {
      const r = buildGuinReport({ ...base, status });
      assert.ok(r.currentContext.length > 0, `${status} 문맥 비었다`);
    }
  });

  it("상태를 안 골랐으면 문맥은 비운다 — 지어내지 않는다", () => {
    assert.equal(buildGuinReport({ ...base, status: null }).currentContext, "");
  });
});

describe("고지는 서비스 표준 문구로 통일된다", () => {
  it("모든 리포트에 같은 고지가 붙는다", () => {
    const a = buildGuinReport(base);
    const b = buildGuinReport({ ...base, role: "mirror", score: 40 });
    assert.equal(a.disclaimer, b.disclaimer);
    assert.ok(a.disclaimer.length > 0);
  });
});
