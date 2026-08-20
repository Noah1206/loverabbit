// 기존 동작이 바뀌지 않았는지 붙잡아 두는 자물쇠.
//
// 이 값들은 이번 작업 **전에** 돌려 받아 적은 것이다. 지지 음양 모드를 정책 모듈로
// 옮기고, 형·통근·투간을 더하고, 지장간 표를 만드는 동안 계산 결과가 조용히
// 달라지지 않았음을 여기서 확인한다.
//
// 이 테스트가 깨지면 기대값을 고치지 말고 왜 달라졌는지부터 밝혀야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildSajuFacts } from "@/lib/saju-facts";
import { DEFAULT_BRANCH_YIN_YANG_MODE, branchYinYangMode } from "@/lib/myeongri/policy";

interface Baseline {
  label: string;
  birth: { year: number; month: number; day: number; hour: number | null; gender: "F" | "M" };
  pillars: string;
  tenGods: string;
  strength: string;
  score: number;
  shinsal: string;
}

const BASELINE: Baseline[] = [
  {
    label: "1999-10-02 14시 F",
    birth: { year: 1999, month: 10, day: 2, hour: 14, gender: "F" },
    pillars: "기묘 계유 정해 정미",
    tenGods: "연간=식신 연지=편인 월간=편관 월지=편재 일지=편관 시간=비견 시지=식신",
    strength: "신약",
    score: 18,
    shinsal: "홍염,화개",
  },
  {
    label: "1997-03-11 09시 M",
    birth: { year: 1997, month: 3, day: 11, hour: 9, gender: "M" },
    pillars: "정축 계묘 임자 갑진",
    tenGods: "연간=정재 연지=정관 월간=겁재 월지=상관 일지=비견 시간=식신 시지=편관",
    strength: "중화",
    score: 46,
    shinsal: "홍염,화개,양인",
  },
  {
    label: "2000-02-02 12시 F",
    birth: { year: 2000, month: 2, day: 2, hour: 12, gender: "F" },
    pillars: "기묘 정축 경인 임오",
    tenGods: "연간=정인 연지=정재 월간=정관 월지=정인 일지=편재 시간=식신 시지=편관",
    strength: "중화",
    score: 58,
    shinsal: "도화,원진",
  },
];

describe("운영 기본값", () => {
  it("지지 음양 모드의 기본값은 body 다 — 호환이 최우선", () => {
    assert.equal(DEFAULT_BRANCH_YIN_YANG_MODE, "body");
  });

  it("환경변수를 안 주면 body 로 돈다", () => {
    delete process.env.BRANCH_YIN_YANG_MODE;
    assert.equal(branchYinYangMode(), "body");
  });

  it("알 수 없는 값이면 경고하고 body 로 떨어진다", () => {
    process.env.BRANCH_YIN_YANG_MODE = "잘못된값";
    assert.equal(branchYinYangMode(), "body");
    delete process.env.BRANCH_YIN_YANG_MODE;
  });

  it("main_hidden_stem 을 명시하면 그대로 읽는다", () => {
    process.env.BRANCH_YIN_YANG_MODE = "main_hidden_stem";
    assert.equal(branchYinYangMode(), "main_hidden_stem");
    delete process.env.BRANCH_YIN_YANG_MODE;
  });
});

describe("작업 전 스냅샷과 같은 값을 낸다", () => {
  for (const b of BASELINE) {
    it(b.label, () => {
      delete process.env.BRANCH_YIN_YANG_MODE;
      const f = buildSajuFacts(b.birth);
      const pillars = [f.fourPillars.year, f.fourPillars.month, f.fourPillars.day, f.fourPillars.hour]
        .map((p) => (p ? p.stem + p.branch : "—"))
        .join(" ");
      assert.equal(pillars, b.pillars, "사주가 달라졌다");
      assert.equal(f.tenGods.map((t) => `${t.position}=${t.tenGod}`).join(" "), b.tenGods, "십성이 달라졌다");
      assert.equal(f.strength.label, b.strength, "강약 판정이 달라졌다");
      assert.equal(f.strength.score, b.score, "강약 점수가 달라졌다");
      assert.equal(f.shinsal.map((s) => s.name).join(","), b.shinsal, "신살이 달라졌다");
    });
  }
});

describe("새로 붙인 것이 기존 필드를 건드리지 않는다", () => {
  const f = buildSajuFacts(BASELINE[0].birth);

  it("형·통근·정책 표식이 실려 나온다", () => {
    assert.ok(Array.isArray(f.xing));
    assert.ok(Array.isArray(f.strengthEvidence.rooting));
    assert.ok(Array.isArray(f.strengthEvidence.exposed));
    assert.equal(f.policy.branchYinYangMode, "body");
    assert.ok(f.policy.calculationPolicyVersion);
    assert.ok(f.policy.hiddenStemTableVersion);
  });

  it("통근 증거가 있어도 강약 점수는 그대로다", () => {
    // 통근·투간은 증거일 뿐 점수에 반영되지 않는다. 반영하려면 정책이 정해져야 한다.
    assert.equal(f.strength.score, BASELINE[0].score);
  });
});
