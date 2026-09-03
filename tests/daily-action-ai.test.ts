import assert from "node:assert";
import test from "node:test";

import { personalizeDailyAction } from "../src/lib/daily-action-ai";
import { buildFlagAction } from "../src/lib/daily-action";

// AI 개인화의 계약은 하나다 — 무슨 일이 있어도 throw 하지 않고, 못 만들면
// null 을 준다. null 이면 표 문구가 나가므로 화면은 항상 안전하다.
test("AI 키가 없으면 조용히 null — 표 문구 폴백", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_PROVIDER;

  const base = buildFlagAction("재성", "money");
  const result = await personalizeDailyAction({
    today: "2026-09-04",
    dayGanji: "갑자",
    dayMaster: "갑",
    flow: "재성",
    pickedOhaeng: "금",
    relationLabel: "네가 다룰 수 있는 기운이야.",
    domain: "money",
    base: {
      action: base.action,
      reason: base.reason,
      avoidAction: base.avoidAction,
      rabbitLine: base.rabbit.line,
    },
    me: null,
  });
  assert.equal(result, null);
});
