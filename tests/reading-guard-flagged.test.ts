// 막힌 위반을 "다시 쓸 절" 로 옮기는 자리.
//
// 여기가 틀리면 두 방향으로 조용히 샌다. 절을 못 찾으면 걸린 글이 그대로 팔리고,
// 엉뚱한 절을 집으면 멀쩡한 절이 돈을 들여 다시 쓰인다. 둘 다 로그만 보면 성공한
// 것처럼 보인다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { flaggedSections, type GuardViolation } from "@/lib/reading-guard";

const TITLES = ["1장 01. 시작", "1장 02. 균열", "2장 01. 사인", "2장 02. 시기"];

function violation(where: string, detail: string, blocking = true): GuardViolation {
  return { kind: "명리", where, detail, blocking };
}

describe("다시 쓸 절 고르기", () => {
  it("절 번호를 where 에서 읽는다", () => {
    const out = flaggedSections([violation("sections[2]", "상대 성향 단정")], TITLES);
    assert.deepEqual(out, [{ title: "2장 01. 사인", notes: ["상대 성향 단정"] }]);
  });

  it("절 안쪽을 가리켜도 그 절로 친다", () => {
    const out = flaggedSections(
      [
        violation("sections[1].paragraphs[2]", "근거 없음"),
        violation("sections[1].rule_ids", "안 켜진 규칙"),
      ],
      TITLES
    );
    // 같은 절의 지적은 한 번에 모아 보낸다 — 두 번 시키면 두 번 청구된다.
    assert.equal(out.length, 1);
    assert.equal(out[0].title, "1장 02. 균열");
    assert.deepEqual(out[0].notes, ["근거 없음", "안 켜진 규칙"]);
  });

  it("자문 위반은 다시 쓰지 않는다", () => {
    // 강조가 많다거나 용어가 딱딱하다는 것은 돈을 더 써서 고칠 일이 아니다.
    const out = flaggedSections([violation("sections[0]", "강조가 8개", false)], TITLES);
    assert.deepEqual(out, []);
  });

  it("리포트 전체를 두고 센 지적은 다시 쓰는 절에 함께 실린다", () => {
    const out = flaggedSections(
      [violation("sections[3]", "근거 없음"), violation("sections", "계절을 5번 말했다")],
      TITLES
    );
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].notes, ["근거 없음", "계절을 5번 말했다"]);
  });

  it("전체 지적만 있으면 아무 절도 다시 쓰지 않는다", () => {
    // 고칠 자리를 특정할 수 없는데 아무 절이나 다시 쓰는 것은 고치는 게 아니라 굴리는 것이다.
    assert.deepEqual(flaggedSections([violation("sections", "계절을 5번 말했다")], TITLES), []);
  });

  it("있지도 않은 절 번호는 버린다", () => {
    assert.deepEqual(flaggedSections([violation("sections[9]", "근거 없음")], TITLES), []);
    assert.deepEqual(flaggedSections([violation("sections[-1]", "근거 없음")], TITLES), []);
  });

  it("여러 절이 걸리면 목차 순서로 준다", () => {
    const out = flaggedSections(
      [violation("sections[3]", "c"), violation("sections[0]", "a"), violation("sections[2]", "b")],
      TITLES
    );
    assert.deepEqual(out.map((item) => item.title), [
      "1장 01. 시작",
      "2장 01. 사인",
      "2장 02. 시기",
    ]);
  });

  it("걸린 것이 없으면 빈 배열", () => {
    assert.deepEqual(flaggedSections([], TITLES), []);
  });
});
