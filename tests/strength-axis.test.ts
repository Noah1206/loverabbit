// 속궁합 4장 01(낮이밤져·낮져밤이·낮져밤져)이 근거 없이 서지 않는다.
//
// 이 절은 세 갈래로 판다. 강약 축 세 규칙이 그 셋을 닫는다 — 기울거나,
// 반대로 기울거나, 같거나. 어떤 짝을 넣어도 셋 중 하나는 켜져야 하고,
// 켜지는 것만으로는 부족해서 12자리 안에 들어와야 한다.
//
// 규칙이 있는데 자리에 못 드는 상황이 실제로 있었다 — 기준 케이스에서
// P-STRENGTH-GAP 이 조건에 맞는데도 우선순위에 밀려 그 절이 비었다.

import assert from "node:assert/strict";
import test from "node:test";

import { OUT_OF_SCOPE } from "@/lib/reading-guard";
import { matchRules } from "@/lib/reading-rules";
import { buildSajuFacts } from "@/lib/saju-facts";

const NOW = new Date("2026-08-25T12:00:00+09:00");
const AXIS = ["P-STRENGTH-GAP", "P-STRENGTH-GAP-REVERSED", "P-STRENGTH-EVEN"];

const PAIRS: [string, any, any][] = [
  ["canonical", { year: 1993, month: 1, day: 24, hour: 14, gender: "F" }, { year: 1991, month: 7, day: 8, hour: 20, gender: "M" }],
  ["no-hour", { year: 1996, month: 11, day: 3, hour: null, gender: "F" }, { year: 1994, month: 5, day: 17, hour: 9, gender: "M" }],
  ["male-self", { year: 1989, month: 6, day: 30, hour: 22, gender: "M" }, { year: 1990, month: 2, day: 14, hour: 3, gender: "F" }],
];

test("어떤 짝이 와도 강약 축이 정확히 하나 켜진다", () => {
  for (const [label, a, b] of PAIRS) {
    const me = buildSajuFacts(a, NOW);
    const partner = buildSajuFacts(b, NOW);
    const all = matchRules(me, partner, "sokgunghap", 99).map((r) => r.id);
    const on = all.filter((id) => AXIS.includes(id));
    assert.equal(on.length, 1, `${label}: 강약 축이 ${on.length}개 (${on.join(",")})`);
  }
});

test("강약 축은 12자리 안에 반드시 들어온다 — 목차가 그 절을 판다", () => {
  for (const [label, a, b] of PAIRS) {
    const me = buildSajuFacts(a, NOW);
    const partner = buildSajuFacts(b, NOW);
    const ids = matchRules(me, partner, "sokgunghap").map((r) => r.id);
    assert.ok(
      ids.some((id) => AXIS.includes(id)),
      `${label}: 4장 01 이 근거 없이 선다 — 켜진 규칙 ${ids.join(",")}`
    );
  }
});

test("축 자리를 만드느라 상대 규칙을 빼앗지 않는다", () => {
  // 상대 자리(PARTNER_RULE_FLOOR)와 축 자리가 서로를 지우면 둘 다 무의미해진다.
  for (const [label, a, b] of PAIRS) {
    const me = buildSajuFacts(a, NOW);
    const partner = buildSajuFacts(b, NOW);
    const ids = matchRules(me, partner, "sokgunghap").map((r) => r.id);
    const partnerCount = ids.filter((id) => id.startsWith("P-")).length;
    assert.ok(partnerCount >= 4, `${label}: 상대 규칙이 ${partnerCount}개뿐이다`);
  }
});

test("강약 축을 팔지 않는 상품의 근거 목록은 건드리지 않는다", () => {
  // 목차가 파는 곳에만 거는 장치다. 아니면 열 상품의 근거 목록이 같이 흔들린다.
  // 재회는 P-STRENGTH-GAP 이 도메인에 있지만 그 축을 절로 팔지는 않는다.
  const me = buildSajuFacts(PAIRS[0][1], NOW);
  const partner = buildSajuFacts(PAIRS[0][2], NOW);
  const ids = matchRules(me, partner, "jaehoe").map((r) => r.id);

  // 자리 되돌리기가 걸렸다면 12개를 넘거나 축이 끼어들었을 것이다.
  assert.ok(ids.length <= 12, `재회가 ${ids.length}개를 받았다`);
  assert.equal(
    ids.filter((id) => AXIS.includes(id)).length,
    matchRules(me, partner, "jaehoe", 99)
      .map((r) => r.id)
      .filter((id) => AXIS.includes(id) && ids.includes(id)).length,
    "재회에 축 자리가 억지로 만들어졌다"
  );
});

// ── 목차가 부르는 이름과 본문이 쓸 수 있는 말은 다르다 ──
//
// 4장 01 의 제목은 "낮이밤져·낮져밤이·낮져밤져" 다. 사람들이 아는 이름으로
// 절을 부르는 것이라 제목은 그대로 둔다. 하지만 규칙 층이 내주는 것은 강약의
// 기울기뿐이고 낮과 밤의 대비는 거기서 나오지 않아서, 본문이 셋 중 하나를
// 찍으면 그것은 근거 없는 판정이다. 가드가 그 선을 지킨다.

test("본문이 낮이밤져 셋 중 하나를 찍으면 막힌다", () => {
  const rule = OUT_OF_SCOPE.find(([, label]) => label === "낮이밤져 판정");
  assert.ok(rule, "낮이밤져 가드가 없다");
  const [re] = rule!;

  for (const text of [
    "두 사람은 낮이밤져다",
    "낮져밤이 스타일이에요",
    "낮져밤져 타입입니다",
    "너는 낮이밤져 쪽이야",
    "낮져밤이에 가깝다",
    "낮이밤져로 보인다",
    "이 조합은 낮져밤져라고 볼 수 있다",
  ]) {
    assert.ok(re.test(text), `안 막혔다: ${text}`);
  }
});

test("이름을 부르기만 하는 문장은 막지 않는다", () => {
  // 여기까지 막으면 목차 제목조차 본문에서 못 부른다.
  const [re] = OUT_OF_SCOPE.find(([, label]) => label === "낮이밤져 판정")!;
  for (const text of [
    "낮이밤져·낮져밤이·낮져밤져 중 어디에 가까운지는 두 사람이 겪으며 알게 된다",
    "평소의 호흡과 가까워졌을 때의 호흡이 뒤집히는 자리가 있다",
    "낮에는 네가 이끌고 밤에는 상대가 이끄는 식으로 고정돼 있지는 않다",
  ]) {
    assert.ok(!re.test(text), `잘못 막혔다: ${text}`);
  }
});
