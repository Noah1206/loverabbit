import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { JIJI } from "@/lib/saju";
import { completeXing, findXing, type BranchSlot } from "@/lib/myeongri/xing";

const ji = (s: string) => JIJI.indexOf(s as (typeof JIJI)[number]);
const POS: BranchSlot["position"][] = ["연지", "월지", "일지", "시지"];

/** 지지 이름들을 연·월·일·시 순으로 자리에 앉힌다 */
const slots = (...branches: string[]): BranchSlot[] =>
  branches.map((b, i) => ({ position: POS[i], jiIdx: ji(b) }));

describe("삼형", () => {
  it("인사신 셋이 다 있으면 complete", () => {
    const x = findXing(slots("인", "사", "신", "자"));
    const found = x.find((r) => r.kind === "yin_si_shen_three_xing");
    assert.ok(found, "인사신 삼형을 못 찾았다");
    assert.equal(found.completeness, "complete");
    assert.deepEqual(found.branches.sort(), ["사", "신", "인"].sort());
    assert.deepEqual(found.pillarPositions.sort(), ["연지", "월지", "일지"].sort());
  });

  it("축술미 셋이 다 있으면 complete", () => {
    const found = findXing(slots("축", "술", "미")).find((r) => r.kind === "chou_xu_wei_three_xing");
    assert.ok(found);
    assert.equal(found.completeness, "complete");
  });

  it("두 글자만 있으면 partial 이고 complete 목록에서 빠진다", () => {
    const all = findXing(slots("인", "사", "자", "묘"));
    const found = all.find((r) => r.kind === "yin_si_shen_three_xing");
    assert.ok(found, "부분 삼형을 감지하지 못했다");
    assert.equal(found.completeness, "partial");
    assert.deepEqual(found.branches.sort(), ["사", "인"].sort());

    const usable = completeXing(all);
    assert.equal(
      usable.some((r) => r.kind === "yin_si_shen_three_xing"),
      false,
      "partial 이 점수·서술에 쓰이는 목록에 들어갔다"
    );
  });

  it("한 글자뿐이면 아무것도 감지하지 않는다", () => {
    const x = findXing(slots("인", "묘", "진", "오"));
    assert.equal(x.some((r) => r.kind === "yin_si_shen_three_xing"), false);
  });
});

describe("자묘 상형", () => {
  it("자와 묘가 함께 있으면 성립", () => {
    const found = findXing(slots("자", "묘", "인")).find((r) => r.kind === "zi_mao_mutual_xing");
    assert.ok(found);
    assert.equal(found.completeness, "complete");
    assert.deepEqual(found.branches, ["자", "묘"]);
  });

  it("한쪽만 있으면 성립하지 않는다", () => {
    assert.equal(findXing(slots("자", "축", "인")).some((r) => r.kind === "zi_mao_mutual_xing"), false);
    assert.equal(findXing(slots("묘", "축", "인")).some((r) => r.kind === "zi_mao_mutual_xing"), false);
  });
});

describe("자형", () => {
  const CASES: [string, string][] = [
    ["진", "chen_chen_self_xing"],
    ["오", "wu_wu_self_xing"],
    ["유", "you_you_self_xing"],
    ["해", "hai_hai_self_xing"],
  ];

  for (const [branch, kind] of CASES) {
    it(`${branch}${branch} 가 둘 있으면 성립`, () => {
      const found = findXing(slots(branch, "축", branch)).find((r) => r.kind === kind);
      assert.ok(found, `${branch} 자형을 못 찾았다`);
      assert.equal(found.completeness, "complete");
      assert.equal(found.branches.length, 2);
      assert.deepEqual(found.pillarPositions.sort(), ["연지", "일지"].sort());
    });

    it(`${branch} 가 하나뿐이면 성립하지 않는다`, () => {
      assert.equal(findXing(slots(branch, "축", "인")).some((r) => r.kind === kind), false);
    });
  }

  it("같은 글자가 셋이면 자리 셋을 모두 돌려준다", () => {
    const found = findXing(slots("진", "진", "진")).find((r) => r.kind === "chen_chen_self_xing");
    assert.ok(found);
    assert.equal(found.pillarPositions.length, 3);
  });
});

describe("다른 관계와 함께 있을 때", () => {
  it("형·충·합이 겹쳐도 형만 정확히 골라낸다", () => {
    // 자(자형 아님) 오(충) 묘(자묘 상형) 유(묘유충)
    const x = findXing(slots("자", "오", "묘", "유"));
    const kinds = x.map((r) => r.kind).sort();
    assert.deepEqual(kinds, ["zi_mao_mutual_xing"], `예상 밖의 형: ${kinds.join(",")}`);
  });

  it("정책 버전을 함께 실어 보낸다", () => {
    for (const r of findXing(slots("인", "사", "신"))) {
      assert.ok(r.calculationPolicyVersion, "정책 버전이 비었다");
    }
  });

  it("시각을 몰라 지지가 셋뿐이어도 동작한다", () => {
    const found = findXing(slots("축", "술", "미")).find((r) => r.kind === "chou_xu_wei_three_xing");
    assert.ok(found);
    assert.equal(found.completeness, "complete");
  });
});
