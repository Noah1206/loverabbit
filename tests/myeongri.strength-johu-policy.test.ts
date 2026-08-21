// P2 정책 — 강약은 승인돼 켜졌고, 조후는 아직 아니다.
//
// 이 파일이 지키는 것은 두 가지다.
//   1) 강약 표(2026-08-21 승인)가 실제로 판정하고, legacy 로 되돌릴 길이 살아 있다
//   2) 조후는 출처가 없어 여전히 사용자에게 안 나간다
//
// 강약과 조후를 같이 승인하지 않은 이유가 이 파일에 남아 있다. 강약의 가중치는
// 고정 명식 32건으로 분포를 재고 정할 수 있었지만, 조후용신은 판본이 있어야 한다.
// 잴 수 있는 것과 없는 것이 다르면 승인 시점도 달라야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeSaju } from "@/lib/saju";
import { buildSajuFacts } from "@/lib/saju-facts";
import {
  seasonalPhaseOf,
  strengthPolicyEvidence,
  STRENGTH_POLICY_STATUS,
  STRENGTH_POLICY_VERSION,
} from "@/lib/myeongri/strength-policy";
import { johuEvidence, johuApproved, JOHU_POLICY_STATUS } from "@/lib/myeongri/johu";
import { slimFacts } from "@/lib/reading-prompt";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const BIRTH = { year: 1993, month: 1, day: 24, hour: 14 } as const;
const ME = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
const CHART = computeSaju(BIRTH);

describe("강약은 승인됐고 조후는 아직이다", () => {
  it("강약 표는 approved, 조후는 아직 아니다", () => {
    assert.equal(STRENGTH_POLICY_STATUS, "approved");
    assert.equal(JOHU_POLICY_STATUS, "policy_proposed");
    assert.equal(johuApproved(), false);
  });

  it("승인된 표가 실제로 판정한다", () => {
    assert.equal(ME.strength.label, "신약");
    assert.equal(ME.strength.score, 30);
    assert.equal(ME.strengthPolicy.appliedToLabel, true);
  });

  it("legacy 로 되돌리면 옛 판정이 돌아온다", () => {
    // 가중치가 갈리는 층이라 되돌릴 길이 막히면 안 된다.
    process.env.STRENGTH_POLICY = "legacy";
    const back = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
    delete process.env.STRENGTH_POLICY;
    assert.equal(back.strength.label, "신약");
    assert.equal(back.strength.score, 36);
    assert.equal(back.strengthPolicy.appliedToLabel, false);
  });

  it("승인 흔적이 표에 남아 있다", () => {
    assert.ok(STRENGTH_POLICY_VERSION.includes("2026-08"));
  });

  it("조후는 프롬프트에 실리지 않는다", () => {
    const payload = slimFacts(ME) as Record<string, unknown>;
    assert.equal("johu" in payload, false, "승인 전인데 조후가 모델에게 갔다");
  });

  it("우선순위 정책만 켜도 승인 전이면 노출되지 않는다", () => {
    process.env.JOOHU_PRIORITY_POLICY = "johu_first_in_extreme";
    const again = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
    delete process.env.JOOHU_PRIORITY_POLICY;
    assert.equal(again.johu.exposable, false, "표가 승인되지 않았는데 정책만으로 문이 열렸다");
  });
});

describe("왕상휴수사", () => {
  it("축월 목은 수(囚)다 — 옛 판정이 중립으로 두던 자리", () => {
    assert.equal(seasonalPhaseOf("목", "축"), "수");
    assert.equal(ME.strengthPolicy.monthCommand.seasonalPhase, "수");
    assert.ok(ME.strengthPolicy.monthCommand.scoreDelta < 0);
    // 옛 셈법은 이 자리를 중립으로 뒀다. 그게 이 표를 만든 이유다.
    process.env.STRENGTH_POLICY = "legacy";
    const back = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
    delete process.env.STRENGTH_POLICY;
    assert.ok(back.strength.reasonCodes.some((code) => code.includes("월지는 중립")));
    assert.ok(ME.strength.reasonCodes.some((code) => code.includes("실령")));
  });

  it("다섯 자리가 다 나온다", () => {
    assert.equal(seasonalPhaseOf("목", "묘"), "왕"); // 봄의 목
    assert.equal(seasonalPhaseOf("목", "자"), "상"); // 수가 목을 생함
    assert.equal(seasonalPhaseOf("목", "오"), "휴"); // 목이 화를 생함
    assert.equal(seasonalPhaseOf("목", "미"), "수"); // 목이 토를 극함
    assert.equal(seasonalPhaseOf("목", "유"), "사"); // 금이 목을 극함
  });
});

describe("지금 판정이 0점으로 두던 것들이 증거로 나온다", () => {
  it("일지 상관의 설기가 잡힌다", () => {
    const drain = ME.strengthPolicy.draining.find((d) => d.source === "일지");
    assert.ok(drain, "일지 사화의 설기가 안 잡혔다");
    assert.equal(drain!.tenGod, "식상");
    assert.ok(drain!.scoreDelta < 0);
  });

  it("통근이 계산되고 판정에 실제로 들어간다", () => {
    const roots = ME.strengthPolicy.rooting;
    assert.ok(roots.length > 0, "을목이 미(未)에 둔 뿌리가 안 잡혔다");
    assert.ok(ME.strength.reasonCodes.some((code) => code.startsWith("통근")));
  });

  it("득세가 점수에 들어간다 — 처음 표에서 통째로 빠져 있던 축이다", () => {
    assert.ok(ME.strengthPolicy.support.length > 0, "인성·비겁이 한 자리도 안 잡혔다");
    assert.ok(ME.strength.reasonCodes.some((code) => code.startsWith("득세")));
  });

  it("인성과다가 잡힌다 — 수 셋에 비겁 없음", () => {
    const excess = ME.strengthPolicy.supportExcess.find((s) => s.type === "인성과다");
    assert.equal(excess?.triggered, true, "수다목부 자리인데 임계가 안 걸렸다");
  });

  it("점수에는 정책 판이 찍혀 있다", () => {
    assert.equal(ME.strengthPolicy.policyVersion, "strength-v1-2026-08");
  });
});

describe("조후와 억부가 부딪히는 것을 인지한다", () => {
  it("축월은 한랭이고 화를 부른다", () => {
    assert.equal(ME.johu.climate, "cold");
    assert.deepEqual(
      ME.johu.seasonalNeed.map((n) => n.element),
      ["화", "목"]
    );
  });

  it("신약한 목에게 화는 설기라 충돌로 잡힌다", () => {
    assert.equal(ME.johu.conflictsWithStrength, true);
    assert.ok(ME.johu.conflictResolution?.includes("미정"));
  });

  it("우선순위를 정하면 조정 문구가 달라진다", () => {
    process.env.JOOHU_PRIORITY_POLICY = "johu_first_in_extreme";
    const johu = johuEvidence(CHART, "신약");
    delete process.env.JOOHU_PRIORITY_POLICY;
    assert.ok(johu.conflictResolution?.includes("조후 우선"));
  });

  it("어느 출처에서 나온 필요인지 함께 나온다", () => {
    for (const need of ME.johu.seasonalNeed) {
      assert.ok(need.sourceId.length > 0);
      assert.ok(need.sourceLocation.includes("조후"));
    }
  });
});
