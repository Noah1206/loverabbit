// 강조 표기 — 화면에 대괄호가 새는 일만은 없어야 한다.
//
// 표기가 틀렸을 때 문장을 잃는 것과 대괄호를 보여주는 것 중에는 전자가 낫지만,
// 둘 다 안 하는 게 가장 낫다. 껍데기만 벗기고 글자는 남긴다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { countMarks, parseMarks, stripMarks, totalMarks } from "@/lib/reading-marks";

describe("표기를 조각으로 나눈다", () => {
  it("굵게", () => {
    assert.deepEqual(parseMarks("앞 **핵심** 뒤"), [
      { kind: "plain", text: "앞 " },
      { kind: "핵심", text: "핵심" },
      { kind: "plain", text: " 뒤" },
    ]);
  });

  it("색 셋을 모두 알아본다", () => {
    const t = parseMarks("[[주의|걸림]]과 [[시기|8월]]과 [[행동|해보기]]");
    assert.deepEqual(
      t.filter((x) => x.kind !== "plain"),
      [
        { kind: "주의", text: "걸림" },
        { kind: "시기", text: "8월" },
        { kind: "행동", text: "해보기" },
      ]
    );
  });

  it("표기가 없으면 통째로 plain 하나다", () => {
    assert.deepEqual(parseMarks("그냥 문장이에요."), [{ kind: "plain", text: "그냥 문장이에요." }]);
  });

  it("앞뒤 공백은 다듬는다", () => {
    assert.deepEqual(parseMarks("[[시기|  8월  ]]")[0], { kind: "시기", text: "8월" });
  });
});

describe("망가진 표기에도 글자를 잃지 않는다", () => {
  it("모르는 이름표면 껍데기만 벗긴다", () => {
    assert.equal(stripMarks("[[뭐지|중요한 말]]이에요."), "중요한 말이에요.");
  });

  it("이름표가 아예 없어도 안쪽은 살린다", () => {
    assert.equal(stripMarks("[[중요한 말]]이에요."), "중요한 말이에요.");
  });

  it("짝이 안 맞는 별표는 지우고 글자는 남긴다", () => {
    assert.equal(stripMarks("**열리고 안 닫힌 문장이에요."), "열리고 안 닫힌 문장이에요.");
  });

  it("닫히지 않은 대괄호도 화면에 새지 않는다", () => {
    const out = stripMarks("[[주의|닫히지 않았어요.");
    assert.equal(out.includes("["), false, "대괄호가 남았다");
  });

  it("어떤 입력이든 결과에 표기 문자가 남지 않는다", () => {
    const inputs = [
      "**",
      "[[",
      "]]",
      "[[|]]",
      "**[[주의|겹쳤어요]]**",
      "[[주의|하나]] 그리고 [[주의|둘]]",
      "별표 *하나*는 그대로 둬요.",
    ];
    for (const input of inputs) {
      const out = stripMarks(input);
      assert.equal(out.includes("[["), false, `[[ 가 남았다: ${input}`);
      assert.equal(out.includes("]]"), false, `]] 가 남았다: ${input}`);
      assert.equal(out.includes("**"), false, `** 가 남았다: ${input}`);
    }
  });

  it("별표 하나짜리는 강조가 아니다 — 그냥 글자다", () => {
    assert.equal(stripMarks("별표 *하나*는 그대로 둬요."), "별표 *하나*는 그대로 둬요.");
  });
});

describe("세어서 가드에 넘긴다", () => {
  it("종류별로 센다", () => {
    const c = countMarks("**하나** [[주의|둘]] [[주의|셋]] [[시기|넷]]");
    assert.equal(c.핵심, 1);
    assert.equal(c.주의, 2);
    assert.equal(c.시기, 1);
    assert.equal(c.행동, 0);
    assert.equal(totalMarks("**하나** [[주의|둘]] [[주의|셋]] [[시기|넷]]"), 4);
  });

  it("표기가 없으면 0이다", () => {
    assert.equal(totalMarks("아무것도 없어요."), 0);
  });
});

describe("stripMarks 는 되돌릴 수 있게 남긴다", () => {
  it("표기만 빠지고 글자는 그대로다", () => {
    const marked = "당신은 **곧게 시작하지만**, [[시기|2026년 8월]]에는 [[주의|같은 자리]]에서 걸려요.";
    const plain = "당신은 곧게 시작하지만, 2026년 8월에는 같은 자리에서 걸려요.";
    assert.equal(stripMarks(marked), plain);
  });

  it("이미 깨끗한 문장은 건드리지 않는다", () => {
    const plain = "이미 아무 표기도 없는 문장이에요.";
    assert.equal(stripMarks(plain), plain);
  });
});
