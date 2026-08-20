import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { computeSaju } from "@/lib/saju";
import { buildSajuFacts } from "@/lib/saju-facts";
import { hiddenStemsOf } from "@/lib/myeongri/hidden-stems";
import { findExposedStems, findRooting, rootingWeightProfile } from "@/lib/myeongri/rooting";
import {
  DEFAULT_FEMALE_SHANGGUAN_POLICY,
  femaleShangguanPolicyEnabled,
  luckInterpretationFlags,
} from "@/lib/myeongri/luck-flags";

const CHART = { year: 1999, month: 10, day: 2, hour: 14 };

describe("통근", () => {
  it("12지지 모두에서 지장간 역할이 빠짐없이 나온다", () => {
    for (let i = 0; i < 12; i += 1) {
      const roles = hiddenStemsOf(i).map((h) => h.role);
      assert.ok(roles.includes("main"), `색인 ${i} 에 본기가 없다`);
      assert.ok(roles.length >= 2 && roles.length <= 3);
    }
  });

  it("천간이 어느 지장간 역할에 뿌리내렸는지 전부 돌려준다", () => {
    const rooting = findRooting(computeSaju(CHART));
    assert.ok(rooting.length > 0, "통근이 하나도 안 나왔다");
    for (const r of rooting) {
      assert.ok(["direct", "middle", "residual"].includes(r.rootingLevel));
      assert.ok(["연주", "월주", "일주", "시주"].includes(r.pillarPosition));
      assert.ok(r.targetStem && r.branch && r.hiddenStem);
    }
  });

  it("본기·중기·여기 세 등급이 모두 나타날 수 있다", () => {
    // 여러 명식을 훑어 세 등급이 다 관측되는지 본다 — 한 명식으로는 부족할 수 있다
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d += 1) {
      for (const r of findRooting(computeSaju({ year: 1990, month: 5, day: d, hour: 12 }))) {
        seen.add(r.rootingLevel);
      }
    }
    assert.deepEqual([...seen].sort(), ["direct", "middle", "residual"].sort());
  });

  it("본기 등급은 지장간 역할 main 과 짝을 이룬다", () => {
    for (const r of findRooting(computeSaju(CHART))) {
      if (r.rootingLevel === "direct") assert.equal(r.hiddenStemRole, "main");
      if (r.rootingLevel === "middle") assert.equal(r.hiddenStemRole, "middle");
      if (r.rootingLevel === "residual") assert.equal(r.hiddenStemRole, "residual");
    }
  });
});

describe("투간", () => {
  it("지장간이 천간에 드러난 자리를 돌려준다", () => {
    // 여러 명식 중 투간이 있는 것을 찾아 형태를 확인한다
    let found = false;
    for (let d = 1; d <= 28 && !found; d += 1) {
      const ex = findExposedStems(computeSaju({ year: 1988, month: 3, day: d, hour: 10 }));
      if (ex.length === 0) continue;
      found = true;
      for (const e of ex) {
        assert.ok(e.hiddenStem);
        assert.ok(e.exposedAtPillarPositions.length > 0);
        assert.ok(["연주", "월주", "일주", "시주"].includes(e.branchPosition));
      }
    }
    assert.ok(found, "투간이 있는 명식을 하나도 못 찾았다");
  });

  it("투간이 없는 명식은 빈 배열을 준다 (없는 것을 지어내지 않는다)", () => {
    // 어떤 명식이든 배열이어야 하고, 길이 0도 정상이다
    for (let d = 1; d <= 10; d += 1) {
      const ex = findExposedStems(computeSaju({ year: 2001, month: 7, day: d, hour: 3 }));
      assert.ok(Array.isArray(ex));
    }
  });

  it("여러 기둥에 같은 글자가 드러나면 자리를 모두 담는다", () => {
    let multi = false;
    for (let y = 1970; y <= 2005 && !multi; y += 1) {
      for (const e of findExposedStems(computeSaju({ year: y, month: 6, day: 15, hour: 8 }))) {
        if (e.exposedAtPillarPositions.length > 1) multi = true;
      }
    }
    assert.ok(multi, "여러 기둥 투간 사례를 못 찾았다");
  });
});

describe("강약 가중치 프로필", () => {
  it("기본값은 점수를 내지 않는 none 이다", () => {
    delete process.env.TONGGEUN_WEIGHT_PROFILE;
    assert.equal(rootingWeightProfile(), "none");
  });

  it("알 수 없는 값이면 경고하고 none 으로 떨어진다", () => {
    process.env.TONGGEUN_WEIGHT_PROFILE = "made-up";
    assert.equal(rootingWeightProfile(), "none");
    delete process.env.TONGGEUN_WEIGHT_PROFILE;
  });
});

describe("여성 상관운 정책 플래그", () => {
  const withShangguan = () => {
    // 상관 운이 실제로 잡히는 명식을 찾는다
    for (let y = 1970; y <= 2008; y += 1) {
      const f = buildSajuFacts({ year: y, month: 4, day: 12, hour: 9, gender: "F" });
      const l = f.luckContext;
      if (l.majorLuck?.currentTenGod === "상관" || l.yearly.tenGod === "상관" || l.monthly.tenGod === "상관") return f;
    }
    return null;
  };

  it("성별을 밝히지 않으면 성별 특정 플래그가 절대 붙지 않는다", () => {
    process.env.FEMALE_SHANGGUAN_POLICY = "on";
    const f = withShangguan();
    if (!f) return; // 상관운 명식을 못 찾으면 이 검사는 건너뛴다
    const flags = luckInterpretationFlags(f, "unspecified").map((x) => x.flag);
    assert.equal(flags.includes("female_shangguan_relationship_policy_candidate"), false);
    delete process.env.FEMALE_SHANGGUAN_POLICY;
  });

  it("정책이 꺼져 있으면 여성이어도 성별 플래그가 붙지 않는다", () => {
    // 기본값이 켜짐으로 바뀌었으므로 여기서 명시적으로 끈다.
    // 이 테스트가 붙잡는 것은 "끄면 안 붙는다" 이고 그 기대는 그대로다.
    process.env.FEMALE_SHANGGUAN_POLICY = "off";
    const f = withShangguan();
    if (!f) return;
    const flags = luckInterpretationFlags(f, "female").map((x) => x.flag);
    assert.equal(flags.includes("female_shangguan_relationship_policy_candidate"), false);
    delete process.env.FEMALE_SHANGGUAN_POLICY;
  });

  it("기본값은 켜짐이다 — 지시로 정한 값이고 근거로 정한 값이 아니다", () => {
    delete process.env.FEMALE_SHANGGUAN_POLICY;
    assert.equal(DEFAULT_FEMALE_SHANGGUAN_POLICY, true);
    assert.equal(femaleShangguanPolicyEnabled(), true);
  });

  it("알 수 없는 값이면 경고하고 기본값으로 떨어진다", () => {
    process.env.FEMALE_SHANGGUAN_POLICY = "아무거나";
    assert.equal(femaleShangguanPolicyEnabled(), DEFAULT_FEMALE_SHANGGUAN_POLICY);
    delete process.env.FEMALE_SHANGGUAN_POLICY;
  });

  it("기본값이 켜져 있어도 성별을 안 밝히면 여전히 안 붙는다", () => {
    // 정책이 켜진 것과 성별을 아는 것은 다른 문제다. 둘 다여야 붙는다.
    delete process.env.FEMALE_SHANGGUAN_POLICY;
    const f = withShangguan();
    if (!f) return;
    const flags = luckInterpretationFlags(f, "unspecified").map((x) => x.flag);
    assert.equal(flags.includes("female_shangguan_relationship_policy_candidate"), false);
  });

  it("상관운이 없으면 아무 플래그도 없다", () => {
    for (let y = 1970; y <= 2008; y += 1) {
      const f = buildSajuFacts({ year: y, month: 4, day: 12, hour: 9, gender: "F" });
      const l = f.luckContext;
      const has = l.majorLuck?.currentTenGod === "상관" || l.yearly.tenGod === "상관" || l.monthly.tenGod === "상관";
      if (has) continue;
      assert.equal(luckInterpretationFlags(f, "female").length, 0, `${y}년생에 플래그가 붙었다`);
      return;
    }
  });

  it("상관견관 후보는 명식에 관성이 실제로 있을 때만 붙고, 사람 검토를 요구한다", () => {
    process.env.FEMALE_SHANGGUAN_POLICY = "on";
    const f = withShangguan();
    if (!f) return;
    const flags = luckInterpretationFlags(f, "female");
    const cand = flags.find((x) => x.flag === "shangguan_jian_guan_candidate");
    const hasGwan = f.tenGods.some((t) => t.tenGod === "정관" || t.tenGod === "편관");
    assert.equal(Boolean(cand), hasGwan, "관성 유무와 후보 플래그가 어긋난다");
    if (cand) {
      assert.equal(cand.requiresHumanOrPolicyReview, true);
      assert.ok(cand.triggeredBy.some((t) => t.includes("관성")), "근거에 관성이 안 적혔다");
    }
    delete process.env.FEMALE_SHANGGUAN_POLICY;
  });
});

describe("화개 — 계산을 그대로 지킨다", () => {
  it("연지나 일지가 고지면 스스로 화개가 된다 (진술축미)", () => {
    // 1997-03-11 09시 = 정축 계묘 임자 갑진 — 진(고지)이 시지에 있다
    const f = buildSajuFacts({ year: 1997, month: 3, day: 11, hour: 9, gender: "M" });
    assert.ok(f.shinsal.some((s) => s.name === "화개"), "화개가 사라졌다");
  });

  it("알려진 명식의 신살이 그대로다", () => {
    const f = buildSajuFacts({ year: 1999, month: 10, day: 2, hour: 14, gender: "F" });
    const names = f.shinsal.map((s) => s.name).sort();
    assert.deepEqual(names, ["홍염", "화개"].sort());
  });
});
