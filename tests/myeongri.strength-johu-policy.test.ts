// P2 정책 — 켜져 있든 꺼져 있든 **지금 판정을 건드리지 않는다**.
//
// 이 파일이 지키는 것은 하나다. 강약과 조후는 기능이 아니라 해석 정책이라,
// 가중치와 출처를 정하지 않은 채 기본 결론이 바뀌면 그것이 곧 불투명한 엔진이다.
// 산 사람의 리딩이 배포 한 번으로 소급해 달라져서도 안 된다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeSaju } from "@/lib/saju";
import { buildSajuFacts } from "@/lib/saju-facts";
import {
  seasonalPhaseOf,
  strengthPolicyEvidence,
  STRENGTH_POLICY_STATUS,
} from "@/lib/myeongri/strength-policy";
import { johuEvidence, johuApproved, JOHU_POLICY_STATUS } from "@/lib/myeongri/johu";
import { slimFacts } from "@/lib/reading-prompt";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const BIRTH = { year: 1993, month: 1, day: 24, hour: 14 } as const;
const ME = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
const CHART = computeSaju(BIRTH);

describe("P2 는 아직 승인 전이다", () => {
  it("두 표 다 policy_proposed 다", () => {
    assert.equal(STRENGTH_POLICY_STATUS, "policy_proposed");
    assert.equal(JOHU_POLICY_STATUS, "policy_proposed");
    assert.equal(johuApproved(), false);
  });

  it("기본값에서 강약 라벨이 그대로다", () => {
    assert.equal(ME.strength.label, "신약");
    assert.equal(ME.strength.score, 36);
    assert.equal(ME.strengthPolicy.appliedToLabel, false);
  });

  it("정책을 켜도 라벨은 그대로다 — 증거만 늘어난다", () => {
    process.env.STRENGTH_POLICY = "evidence";
    const again = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);
    delete process.env.STRENGTH_POLICY;
    assert.equal(again.strength.label, ME.strength.label);
    assert.equal(again.strength.score, ME.strength.score);
    assert.equal(again.strengthPolicy.appliedToLabel, false);
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
  it("축월 목은 수(囚)다 — 지금 판정이 중립으로 두는 자리", () => {
    assert.equal(seasonalPhaseOf("목", "축"), "수");
    // 지금 판정의 근거 문구가 실제로 그렇게 말하고 있다.
    assert.ok(ME.strength.reasonCodes.some((code) => code.includes("월지는 중립")));
    assert.equal(ME.strengthPolicy.monthCommand.seasonalPhase, "수");
    assert.ok(ME.strengthPolicy.monthCommand.scoreDelta < 0);
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

  it("통근이 계산되고, 반영되지 않았다고 명시된다", () => {
    const roots = ME.strengthPolicy.rooting;
    assert.ok(roots.length > 0, "을목이 미(未)에 둔 뿌리가 안 잡혔다");
    assert.equal(roots.every((r) => r.applied === "not_applied"), true);
  });

  it("인성과다가 잡힌다 — 수 셋에 비겁 없음", () => {
    const excess = ME.strengthPolicy.supportExcess.find((s) => s.type === "인성과다");
    assert.equal(excess?.triggered, true, "수다목부 자리인데 임계가 안 걸렸다");
  });

  it("제안 점수에는 정책 판이 찍혀 있다", () => {
    assert.equal(ME.strengthPolicy.policyVersion, "strength-v1-proposed");
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
