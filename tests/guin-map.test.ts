import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  birthProblem,
  nicknameProblem,
  shapeMapView,
  type GuinNodeView,
} from "../src/lib/guin-map";

const node = (id: string, score = 70): GuinNodeView => ({
  id,
  nickname: `친구${id}`,
  role: "benefactor",
  roleLabel: "귀인",
  roleTagline: "나를 살리는 사람",
  elementLabel: "번지는 불",
  score,
  strengths: ["강점"],
  cautions: ["주의"],
  conversationPrompt: "질문?",
  facts: [],
});

describe("별명 검사", () => {
  it("정상 별명은 통과한다", () => {
    for (const name of ["달토끼", "J", "베스트프렌드", "민지 🐰"]) {
      assert.equal(nicknameProblem(name), null, name);
    }
  });

  it("길이를 지킨다", () => {
    assert.ok(nicknameProblem(""));
    assert.ok(nicknameProblem("   "));
    assert.ok(nicknameProblem("가".repeat(21)));
    assert.equal(nicknameProblem("가".repeat(20)), null);
  });

  it("전화번호·연락처 패턴을 막되, 이유는 뭉뚱그려 말한다", () => {
    const GENERIC = "다른 사람에게 공개될 수 있는 정보는 입력하지 마세요.";
    for (const name of ["01012345678", "010-1234-5678", "kim@mail.com", "www.example.com", "123456"]) {
      assert.equal(nicknameProblem(name), GENERIC, name);
    }
  });
});

describe("생년월일 검사", () => {
  it("실제 있는 날짜만 통과한다", () => {
    assert.equal(birthProblem({ year: 1993, month: 8, day: 21, hour: null }), null);
    assert.equal(birthProblem({ year: 2000, month: 2, day: 29, hour: 23 }), null); // 윤년
    assert.ok(birthProblem({ year: 2001, month: 2, day: 29, hour: null })); // 평년
    assert.ok(birthProblem({ year: 1993, month: 13, day: 1, hour: null }));
    assert.ok(birthProblem({ year: 1993, month: 4, day: 31, hour: null }));
    assert.ok(birthProblem({ year: 1993, month: 8, day: 21, hour: 24 }));
    assert.ok(birthProblem({ year: 1888, month: 1, day: 1, hour: null }));
  });
});

describe("지도 화면용 정리", () => {
  const nodes = [node("a", 80), node("b", 60)];

  it("참여 전 방문자는 노드를 받지 못한다 — 인원과 역할 분포만", () => {
    const view = shapeMapView({ token: "t", ownerNickname: "주인", showScores: true, nodes, viewer: "stranger" });
    assert.equal(view.nodes.length, 0);
    assert.equal(view.count, 2);
    assert.equal(view.roleCounts.benefactor, 2);
  });

  it("점수 표시를 끄면 주인이 아닌 화면에서 점수가 사라진다", () => {
    const participant = shapeMapView({ token: "t", ownerNickname: "주인", showScores: false, nodes, viewer: "participant" });
    assert.ok(participant.nodes.every((item) => item.score === null));
    const owner = shapeMapView({ token: "t", ownerNickname: "주인", showScores: false, nodes, viewer: "owner" });
    assert.ok(owner.nodes.every((item) => item.score !== null));
  });
});

describe("공유 카피 배정 (지시문 12)", () => {
  it("A 50% / B 25% / C 25% 로 갈린다", async () => {
    const { assignCopyVariant, normalizeCopyVariant } = await import("../src/lib/guin-map");
    assert.equal(assignCopyVariant(() => 0.0), "A");
    assert.equal(assignCopyVariant(() => 0.49), "A");
    assert.equal(assignCopyVariant(() => 0.5), "B");
    assert.equal(assignCopyVariant(() => 0.74), "B");
    assert.equal(assignCopyVariant(() => 0.75), "C");
    assert.equal(assignCopyVariant(() => 0.99), "C");
    // URL 에서 온 값 — 이상한 건 전부 A 로 접는다
    assert.equal(normalizeCopyVariant("B"), "B");
    assert.equal(normalizeCopyVariant("x"), "A");
    assert.equal(normalizeCopyVariant(null), "A");
  });

  it("세 안의 공유 문구에 생년월일 자리 자체가 없다", async () => {
    const { GUIN_COPY } = await import("../src/lib/guin-map");
    for (const copy of Object.values(GUIN_COPY)) {
      const all = `${copy.shareText}${copy.inviteTitle}${copy.inviteBody}${copy.inviteCta}`;
      assert.ok(!/\d{6,8}/.test(all), "카피에 날짜 형태 숫자가 있다");
    }
  });
});
