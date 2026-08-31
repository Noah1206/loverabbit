import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GUIN_REPORT_FORBIDDEN,
  buildGuinReportPrompt,
  contextInstructionOf,
  parseGuinAiReport,
} from "../src/lib/guin-report";
import { GUIN_STATUSES, type GuinNodeView } from "../src/lib/guin-map";

const validReport = {
  summary: "두 사람은 서로 다른 속도를 가진 관계예요.",
  roleExplanation: "지도 주인에게 이 친구는 현실적인 실행을 도와주는 오른팔형으로 나타나요.",
  strengths: ["생각을 행동으로 옮길 때 힘이 되어줘요", "서로 다른 시선이 대화를 넓혀줘요"],
  caution: "속도가 다른 날에는 잠시 페이스를 맞추면 좋아요.",
  currentContext: "지금은 서로의 기대를 확인해보기 좋은 시기예요.",
  suggestedAction: "이번 주에 가볍게 안부를 물어보세요.",
  conversationPrompt: "요즘 서로에게 가장 힘이 됐던 순간은 언제였을까?",
  disclaimer: "재미와 자기성찰을 위한 해석이에요.",
};

const node: GuinNodeView = {
  id: "p1",
  nickname: "민지",
  role: "right_hand",
  roleLabel: "오른팔형",
  roleTagline: "현실적으로 내 편이 되어주는 사람",
  elementLabel: "단단한 땅",
  score: 82,
  axes: { comfort: 60, practicalHelp: 87, communication: 70, stimulation: 76, conflictRecovery: 64 },
  strengths: ["강점"],
  cautions: ["주의"],
  conversationPrompt: "질문?",
  facts: [],
};

describe("관계 상태 → 해석 지시 (지시문 8.2)", () => {
  it("모든 상태에 지시가 있고, 상태 없음(null)은 중립 지시로 떨어진다", () => {
    for (const status of GUIN_STATUSES) {
      const instruction = contextInstructionOf(status);
      assert.ok(instruction.focus.length > 0 && instruction.avoid.length > 0, status);
    }
    assert.deepEqual(contextInstructionOf(null), contextInstructionOf("unclear"));
  });
});

describe("AI 리포트 프롬프트 (지시문 9)", () => {
  it("입력에 생년월일이 없고, 서버가 계산한 점수·역할이 그대로 실린다", () => {
    const { user } = buildGuinReportPrompt({
      ownerNickname: "주인",
      participantNickname: "민지",
      node,
      status: "conflict",
    });
    assert.ok(user.includes('"chemistry":82'));
    assert.ok(user.includes("오른팔형"));
    assert.ok(user.includes("갈등"));
    assert.ok(!/19\d\d|20[0-2]\d/.test(user), "프롬프트에 연도(생년월일 흔적)가 있다");
  });
});

describe("AI 응답 검증 (지시문 9.3)", () => {
  it("올바른 JSON 은 통과한다 — 코드펜스가 붙어도", () => {
    assert.ok(parseGuinAiReport(JSON.stringify(validReport)));
    assert.ok(parseGuinAiReport("```json\n" + JSON.stringify(validReport) + "\n```"));
  });

  it("필드가 빠지면 버린다", () => {
    const { summary: _dropped, ...missing } = validReport;
    assert.equal(parseGuinAiReport(JSON.stringify(missing)), null);
  });

  it("길이를 넘으면 버린다", () => {
    assert.equal(parseGuinAiReport(JSON.stringify({ ...validReport, summary: "가".repeat(181) })), null);
  });

  it("강점이 2개가 아니면 버린다", () => {
    assert.equal(parseGuinAiReport(JSON.stringify({ ...validReport, strengths: ["하나뿐"] })), null);
  });

  it("금지 표현이 하나라도 있으면 리포트 전체를 버린다", () => {
    for (const word of GUIN_REPORT_FORBIDDEN.slice(0, 4)) {
      const poisoned = { ...validReport, caution: `이 관계는 ${word} 잘 됩니다.` };
      assert.equal(parseGuinAiReport(JSON.stringify(poisoned)), null, word);
    }
  });

  it("JSON 이 아니면 버린다", () => {
    assert.equal(parseGuinAiReport("사주를 보니 두 분은 천생연분입니다."), null);
  });
});
