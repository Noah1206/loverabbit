// 사주지도의 파생값 — 자리 계산과 발견 문구.
//
// 화면은 못 재도 이 층은 잰다. 특히 두 가지가 깨지면 화면이 조용히 이상해진다:
// 노드가 상자 밖으로 나가는 것과, 같은 지도가 열 때마다 다른 그림이 되는 것.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  discoveryOf,
  groupOf,
  layoutNodes,
  maskName,
  ringCount,
  sortForMap,
  statusLine,
} from "@/lib/saju-map-view";
import type { GuinNodeView, GuinRole } from "@/lib/guin-map";

function nodes(count: number, role: GuinRole = "comforter") {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    role,
    score: 50 + (i % 40),
  }));
}

describe("고리 — 사람이 늘면 겹으로 쌓는다", () => {
  it("5명까지 한 겹, 10명까지 두 겹, 그 위 세 겹", () => {
    assert.equal(ringCount(1), 1);
    assert.equal(ringCount(5), 1);
    assert.equal(ringCount(6), 2);
    assert.equal(ringCount(10), 2);
    assert.equal(ringCount(11), 3);
    assert.equal(ringCount(40), 3);
  });
});

describe("자리 — 상자 안에 있고, 언제나 같다", () => {
  it("몇 명이든 0~100 안에 앉는다", () => {
    for (const count of [1, 4, 9, 17, 30]) {
      for (const spot of layoutNodes(nodes(count))) {
        assert.ok(spot.x > 2 && spot.x < 98, `x가 상자 밖: ${spot.x} (${count}명)`);
        assert.ok(spot.y > 2 && spot.y < 98, `y가 상자 밖: ${spot.y} (${count}명)`);
      }
    }
  });

  it("같은 입력이면 같은 자리 — 난수가 없다", () => {
    const a = layoutNodes(nodes(8));
    const b = layoutNodes(nodes(8));
    assert.deepEqual(a, b);
  });

  it("같은 역할이 여럿이어도 한 점에 겹치지 않는다", () => {
    const spots = layoutNodes(nodes(6, "right_hand"));
    const seen = new Set(spots.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`));
    assert.equal(seen.size, spots.length);
  });

  it("궁합이 높은 사람이 앞에 서고, 점수 없는 사람은 뒤로", () => {
    const sorted = sortForMap([
      { nickname: "가", score: 40 },
      { nickname: "나", score: null },
      { nickname: "다", score: 90 },
    ]);
    assert.deepEqual(sorted.map((n) => n.nickname), ["다", "가", "나"]);
  });
});

describe("관계 갈래", () => {
  it("연애로 묶이는 상태들", () => {
    assert.equal(groupOf("crush"), "love");
    assert.equal(groupOf("dating"), "love");
    assert.equal(groupOf("reunion"), "love");
  });

  it("상태를 안 골랐으면 친구 — 지어내지 않는다", () => {
    assert.equal(groupOf(null), "friend");
    assert.equal(statusLine(null), "");
  });

  it("가족·동료는 제 갈래로", () => {
    assert.equal(groupOf("family"), "family");
    assert.equal(groupOf("coworker"), "work");
  });
});

describe("발견 — 없는 사실을 만들지 않는다", () => {
  const base = {
    roleLabel: "안식처형",
    roleTagline: "마음을 편하게 해주는 사람",
    elementLabel: "목",
    strengths: [],
    cautions: [],
    conversationPrompt: "",
    facts: [],
  };
  const person = (id: string, nickname: string, role: GuinRole, score: number | null) =>
    ({ ...base, id, nickname, role, score }) as GuinNodeView;

  it("아무도 없으면 아무 말도 안 한다", () => {
    assert.equal(discoveryOf([]), null);
  });

  it("점수가 있으면 궁합 1위를 부른다", () => {
    const found = discoveryOf([
      person("a", "민지", "comforter", 70),
      person("b", "서연", "comforter", 94),
    ]);
    assert.equal(found?.nodeId, "b");
    assert.match(found?.text ?? "", /서연/);
  });

  it("점수가 가려진 지도에서는 점수를 말하지 않는다", () => {
    const found = discoveryOf([
      person("a", "민지", "right_hand", null),
      person("b", "서연", "comforter", null),
    ]);
    assert.equal(found?.nodeId, "a");
    assert.doesNotMatch(found?.text ?? "", /점/);
  });
});

describe("공유 카드 — 이름을 가린다", () => {
  it("첫 글자만 남는다", () => {
    assert.equal(maskName("민지"), "민*");
    assert.equal(maskName("김서연"), "김**");
  });

  it("한 글자는 그대로 — 가릴 것이 없다", () => {
    assert.equal(maskName("김"), "김");
  });
});
