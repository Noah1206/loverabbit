// 운에서 들어오는 형 — 타고난 것과 지나가는 것을 나눠 두는지 확인한다.
//
// 이 구분이 무너지면 "늘 그렇게 걸리는 자리"와 "올해만 겹치는 것"이 한 문장으로
// 붙어버린다. 시기를 짚는 말은 오직 luck 쪽에서만 나와야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { JIJI } from "@/lib/saju";
import {
  DEFAULT_XING_PARTIAL_POLICY,
  completeXing,
  findXing,
  findXingWithLuck,
  xingPartialPolicy,
  type BranchSlot,
} from "@/lib/myeongri/xing";

const at = (position: BranchSlot["position"], name: string): BranchSlot => ({
  position,
  jiIdx: JIJI.indexOf(name as (typeof JIJI)[number]),
});

describe("원국과 운을 가른다", () => {
  it("원국만 있으면 findXing 이 잡고 scope 는 natal 이다", () => {
    const natal = [at("연지", "자"), at("월지", "묘"), at("일지", "인")];
    const found = findXing(natal);
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, "zi_mao_mutual_xing");
    assert.equal(found[0].scope, "natal");
    assert.equal(found[0].luckSources, undefined);
  });

  it("운의 글자가 끼면 findXingWithLuck 만 잡고 scope 는 luck 이다", () => {
    // 원국에 묘만 있고 자는 대운에서 들어온다 — 타고난 형이 아니다
    const natal = [at("연지", "묘"), at("월지", "인"), at("일지", "축")];
    const luck = [at("대운", "자")];

    assert.deepEqual(findXing(natal), [], "원국만 보면 형이 없어야 한다");

    const found = findXingWithLuck(natal, luck);
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, "zi_mao_mutual_xing");
    assert.equal(found[0].scope, "luck");
    assert.deepEqual(found[0].luckSources, ["대운"]);
  });

  it("원국에서 이미 성립한 형은 운 쪽 결과에 섞이지 않는다", () => {
    const natal = [at("연지", "자"), at("월지", "묘")];
    const luck = [at("세운", "오")];
    const found = findXingWithLuck(natal, luck);
    // 자묘는 원국에서 이미 섰으니 luck 목록에 없어야 한다
    assert.equal(
      found.some((r) => r.kind === "zi_mao_mutual_xing"),
      false
    );
  });

  it("어느 운에서 왔는지 luckSources 로 구분된다", () => {
    const natal = [at("일지", "인"), at("월지", "사")];
    const found = findXingWithLuck(natal, [at("세운", "신")]);
    assert.equal(found.length, 1);
    assert.equal(found[0].completeness, "complete", "인사신 세 글자가 다 찼다");
    assert.deepEqual(found[0].luckSources, ["세운"]);
  });

  it("여러 운이 함께 끼면 모두 기록된다", () => {
    const natal = [at("일지", "인")];
    const found = findXingWithLuck(natal, [at("세운", "사"), at("월운", "신")]);
    assert.equal(found.length, 1);
    assert.deepEqual(found[0].luckSources?.slice().sort(), ["세운", "월운"]);
  });

  it("운의 글자끼리만 이룬 형도 luck 이다", () => {
    // 원국과 무관하게 세운·월운이 자·묘로 만나는 경우
    const found = findXingWithLuck([at("일지", "축")], [at("세운", "자"), at("월운", "묘")]);
    assert.equal(found.length, 1);
    assert.equal(found[0].scope, "luck");
  });
});

describe("부분 삼형 정책", () => {
  it("기본값은 on 이다 — 지시로 정한 값이고 근거로 정한 값이 아니다", () => {
    assert.equal(DEFAULT_XING_PARTIAL_POLICY, "on");
  });

  it("환경변수가 없으면 기본값으로 돈다", () => {
    delete process.env.XING_PARTIAL_POLICY;
    assert.equal(xingPartialPolicy(), DEFAULT_XING_PARTIAL_POLICY);
  });

  it("알 수 없는 값이면 경고하고 기본값으로 떨어진다", () => {
    process.env.XING_PARTIAL_POLICY = "아무거나";
    assert.equal(xingPartialPolicy(), DEFAULT_XING_PARTIAL_POLICY);
    delete process.env.XING_PARTIAL_POLICY;
  });

  it("off 면 부분 삼형이 completeXing 에서 빠진다", () => {
    process.env.XING_PARTIAL_POLICY = "off";
    const partial = findXing([at("연지", "인"), at("월지", "사"), at("일지", "묘")]);
    assert.equal(partial.length, 1);
    assert.equal(partial[0].completeness, "partial");
    assert.deepEqual(completeXing(partial), [], "off 면 걸러진다");
    delete process.env.XING_PARTIAL_POLICY;
  });

  it("on 이면 부분 삼형이 그대로 통과한다", () => {
    process.env.XING_PARTIAL_POLICY = "on";
    const partial = findXing([at("연지", "인"), at("월지", "사"), at("일지", "묘")]);
    assert.equal(completeXing(partial).length, 1);
    assert.equal(completeXing(partial)[0].completeness, "partial");
    delete process.env.XING_PARTIAL_POLICY;
  });

  it("정책과 무관하게 감지 자체는 언제나 일어난다", () => {
    // 정책은 '쓸 것인가'만 정한다. 계산은 정책을 모른다.
    const slots = [at("연지", "축"), at("월지", "술")];
    for (const mode of ["off", "on"]) {
      process.env.XING_PARTIAL_POLICY = mode;
      const found = findXing(slots);
      assert.equal(found.length, 1, `${mode}: 감지는 되어야 한다`);
      assert.equal(found[0].completeness, "partial");
    }
    delete process.env.XING_PARTIAL_POLICY;
  });
});
