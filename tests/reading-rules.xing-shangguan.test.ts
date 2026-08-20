// 새로 붙인 규칙이 실제로 리딩까지 닿는지 붙잡아 둔다.
//
// 계산에 형이 있어도 규칙이 안 켜지면 사용자에게는 없는 것과 같다.
// 반대로 정책을 끄면 확실히 사라져야 한다 — 되돌릴 길이 살아 있어야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildSajuFacts } from "@/lib/saju-facts";
import { READING_RULES, matchRules } from "@/lib/reading-rules";

const PRODUCTS = [
  "ibyeol", "gwontaegi", "jaehoe", "gyeolhon", "pyeongsaeng",
  "sokgunghap", "bamgijil", "sseom", "jjak", "bimil",
  "yeonae", "hwanseung", "insun", "dohwasal", "baramgi",
];

/** 무작위에 가까운 표본. 날짜를 고정해 두어 결과가 매번 같다. */
function sample(): ReturnType<typeof buildSajuFacts>[] {
  const out = [];
  for (let y = 1975; y <= 2006; y += 1) {
    for (const m of [2, 5, 8, 11]) {
      for (const g of ["F", "M"] as const) {
        out.push(buildSajuFacts({ year: y, month: m, day: 13, hour: 9, gender: g }));
      }
    }
  }
  return out;
}

function firedIds(facts: ReturnType<typeof buildSajuFacts>): Set<string> {
  const hit = new Set<string>();
  for (const p of PRODUCTS) for (const r of matchRules(facts, null, p, 999)) hit.add(r.id);
  return hit;
}

const XING_RULE_IDS = READING_RULES.filter((r) => r.id.startsWith("XING-")).map((r) => r.id);

describe("형 규칙이 리딩까지 닿는다", () => {
  it("여덟 종류가 다 등록돼 있다", () => {
    assert.equal(XING_RULE_IDS.length, 7, "형 규칙 수가 달라졌다");
  });

  it("표본 안에서 모든 형 규칙이 한 번은 켜진다", () => {
    delete process.env.XING_PARTIAL_POLICY;
    const fired = new Set<string>();
    for (const f of sample()) for (const id of firedIds(f)) fired.add(id);
    const dead = XING_RULE_IDS.filter((id) => !fired.has(id));
    assert.deepEqual(dead, [], `한 번도 안 켜지는 형 규칙: ${dead.join(", ")}`);
  });

  it("운의 형 규칙은 원국의 형 규칙보다 뒤에 선다", () => {
    // 3분의 2가 공유하는 신호를 맨 앞에 세우면 리딩이 서로 비슷해진다.
    const natal = READING_RULES.filter((r) => r.when.xingKind).map((r) => r.priority);
    const spouse = READING_RULES.find((r) => r.id === "XING-SPOUSE-PALACE")!.priority;
    const luckNow = READING_RULES.find((r) => r.id === "XING-LUCK-NOW")!.priority;
    const luckMonth = READING_RULES.find((r) => r.id === "XING-LUCK-MONTH")!.priority;
    assert.ok(luckNow < spouse, "운의 형이 배우자궁의 형보다 앞선다");
    assert.ok(luckNow < Math.max(...natal), "운의 형이 원국의 형보다 앞선다");
    assert.ok(luckMonth < luckNow, "월운이 대운·세운보다 앞선다");
  });

  it("부분 삼형 정책을 끄면 삼형 규칙이 켜지는 명식이 줄어든다", () => {
    const charts = sample();
    const countWith = (mode: string) => {
      if (mode) process.env.XING_PARTIAL_POLICY = mode;
      else delete process.env.XING_PARTIAL_POLICY;
      return charts.filter((f) => {
        const ids = firedIds(f);
        return ids.has("XING-YINSISHEN") || ids.has("XING-CHOUXUWEI");
      }).length;
    };
    const on = countWith("on");
    const off = countWith("off");
    delete process.env.XING_PARTIAL_POLICY;
    assert.ok(off < on, `정책이 결과를 못 바꾼다 (on=${on}, off=${off})`);
    assert.ok(off > 0, "완전 삼형만으로도 켜지는 명식은 있어야 한다");
  });

  it("형 규칙의 금지선에 결과 확정 표현이 들어 있다", () => {
    // 형은 갈등으로 읽히기 쉬워 확정 표현이 새기 쉬운 자리다.
    for (const id of XING_RULE_IDS) {
      const rule = READING_RULES.find((r) => r.id === id)!;
      assert.ok(rule.forbidden.length >= 2, `${id}: 금지선이 너무 얇다`);
      assert.ok(rule.source.startsWith("형") || rule.source.includes("형"), `${id}: source 에 근거가 없다`);
    }
  });
});

describe("여자 상관운 규칙", () => {
  const id = "LUCK-SANGGWAN-GYEONGWAN-F";

  it("규칙이 하나뿐이다 — 플래그가 말할 수 있는 전부다", () => {
    const found = READING_RULES.filter((r) => r.when.femaleShangguanCandidate !== undefined);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, id);
  });

  it("표본 안에서 한 번은 켜진다", () => {
    delete process.env.FEMALE_SHANGGUAN_POLICY;
    const fired = sample().some((f) => firedIds(f).has(id));
    assert.equal(fired, true, "기본값이 켜짐인데 한 번도 안 켜진다");
  });

  it("정책을 끄면 한 번도 안 켜진다", () => {
    process.env.FEMALE_SHANGGUAN_POLICY = "off";
    const fired = sample().some((f) => firedIds(f).has(id));
    process.env.FEMALE_SHANGGUAN_POLICY = "";
    delete process.env.FEMALE_SHANGGUAN_POLICY;
    assert.equal(fired, false, "정책을 껐는데도 켜진다 — 되돌릴 길이 막혔다");
  });

  it("남자 명식에서는 켜지지 않는다", () => {
    delete process.env.FEMALE_SHANGGUAN_POLICY;
    const men = sample().filter((f) => f.gender === "M");
    assert.equal(men.some((f) => firedIds(f).has(id)), false);
  });

  it("결과를 확정하는 말을 금지선에 담고 있다", () => {
    const rule = READING_RULES.find((r) => r.id === id)!;
    for (const word of ["이혼한다", "관계가 끝난다"]) {
      assert.ok(rule.forbidden.includes(word), `금지선에 "${word}" 가 없다`);
    }
  });
});
