// 목차가 약속한 앞날과 계산이 감당하는 앞날을 맞추는 자리.
//
// 결혼 상품이 "3년 흐름"을 팔았는데 계산은 일곱 달 + 다음 해였고, 예전 정규식은
// "개월·내년"만 알아서 그 약속이 그대로 모델에게 갔다. 여기서는 그 어긋남을
// 달로 환산해 잡는지, 그리고 잡았을 때 이름과 목차를 같은 말로 좁히는지 본다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSajuFacts, UPCOMING_MONTHS } from "@/lib/saju-facts";
import { matchRules } from "@/lib/reading-rules";
import { computedHorizonMonths, promiseHorizonMonths, scopeOutline } from "@/lib/reading-scope";

const NOW = new Date("2026-08-25T12:00:00+09:00");
const ME = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" }, NOW);
const PARTNER = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" }, NOW);

describe("약속 길이 읽기", () => {
  it("개월·년·년차·내년을 달로 환산한다", () => {
    assert.equal(promiseHorizonMonths("앞으로 6개월, 두 사람의 흐름"), 6);
    assert.equal(promiseHorizonMonths("결혼 후 1년차, 2년차, 3년차 흐름"), 36);
    assert.equal(promiseHorizonMonths("궁합과 3년 흐름"), 36);
    assert.equal(promiseHorizonMonths("내년 상반기"), 12);
  });

  it("숫자가 없으면 모른다고 한다 — 지어내지 않는다", () => {
    assert.equal(promiseHorizonMonths("연락이 다시 올 확률, 그리고 그 시기"), null);
    assert.equal(promiseHorizonMonths("다음 기회가 또 오는지"), null);
  });

  it("계산이 감당하는 길이는 앞달 수 + 다음 해 열두 달", () => {
    const upcoming = ME.luckContext.upcoming;
    assert.equal(upcoming.months.length, UPCOMING_MONTHS);
    assert.ok(upcoming.nextYear);
    assert.equal(computedHorizonMonths(upcoming), UPCOMING_MONTHS + 12);
  });
});

describe("범위 맞추기", () => {
  const rules = matchRules(ME, PARTNER, "gyeolhon", 12);

  it("계산보다 긴 해 약속은 좁히고 사유를 남긴다", () => {
    const scoped = scopeOutline({
      product: "gyeolhon",
      outline: ["5장 01. 결혼 후 1년차, 2년차, 3년차 흐름", "5장 02. 두 사람의 결혼 적기"],
      facts: ME,
      matchedRules: rules,
      label: "결혼운 (이 상대와 결혼했을 때의 궁합과 3년 흐름)",
    });
    assert.equal(scoped.outline[0], "5장 01. 결혼 후 첫 해 흐름");
    assert.equal(scoped.outline[1], "5장 02. 두 사람의 결혼 적기", "약속 없는 절은 손대지 않는다");
    assert.equal(scoped.label, "결혼운 (이 상대와 결혼했을 때의 궁합과 지금 구간 흐름)");
    assert.equal(scoped.dropped.length, 0, "바꿔 쓸 말이 있으면 자르지 않는다");
    assert.ok(scoped.notes.some((n) => n.includes("36개월")), "몇 달을 약속했는지 사유에 적는다");
    assert.ok(scoped.notes.some((n) => n.includes("이름")), "이름을 좁혔다는 것도 남긴다");
  });

  it("계산 안에 드는 약속은 그대로 둔다", () => {
    const scoped = scopeOutline({
      product: "jaehoe",
      outline: ["4장 02. 앞으로 6개월, 두 사람의 흐름", "3장 01. 내년의 자리"],
      facts: ME,
      matchedRules: rules,
      label: "재회운",
    });
    assert.deepEqual(scoped.outline, ["4장 02. 앞으로 6개월, 두 사람의 흐름", "3장 01. 내년의 자리"]);
    assert.equal(scoped.label, "재회운");
    assert.equal(scoped.notes.filter((n) => n.includes("좁혔어요")).length, 0);
  });

  it("이름을 주지 않으면 이름을 돌려주지 않는다", () => {
    const scoped = scopeOutline({ product: "jaehoe", outline: ["1장 01. 처음"], facts: ME, matchedRules: rules });
    assert.equal(scoped.label, null);
  });
});
