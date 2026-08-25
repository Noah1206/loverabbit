import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildReadingInput, READING_SYSTEM_PROMPT, type ReadingInput } from "@/lib/reading-prompt";
import { axisFor, READING_AXES } from "@/lib/reading-axis";
import { buildSajuFacts } from "@/lib/saju-facts";
import { PRODUCT_MAP } from "@/lib/products";

const base: ReadingInput = {
  facts: buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" }),
  partnerFacts: buildSajuFacts({ year: 1991, month: 6, day: 3, hour: 9, gender: "M" }),
  matchedRules: [],
  productLabel: "속궁합",
  outline: ["1장 01. 첫 절"],
  focus: "relationship",
  currentScene: "",
  characterId: null,
  characterName: null,
  now: new Date(2026, 7, 24),
};

describe("상품 축", () => {
  it("속궁합에는 축이 실린다", () => {
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "sokgunghap" }));
    const axis = payload.delivery.product_axis;
    assert.ok(axis, "속궁합에 축이 없다");
    assert.equal(axis.question, READING_AXES.sokgunghap.question);
    assert.ok(axis.axes.length >= 3, "축이 셋도 안 된다 — 열두 절이 한 축에 몰린다");
    assert.ok(axis.avoid.length > 0, "옆 상품의 물음을 막는 줄이 없다");
  });

  it("선이 없는 상품은 빈 칸도 보내지 않는다", () => {
    // 속궁합은 성인 확인을 받은 사람만 사므로 수위 선을 걷어냈다. 빈 목록을 보내면
    // 모델이 "여기 뭔가 있어야 하는데" 로 읽고 없는 선을 지어낸다.
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "sokgunghap" }));
    assert.equal("line" in payload.delivery.product_axis, false);
    assert.equal(READING_AXES.sokgunghap.line, undefined);
  });

  it("축이 없는 상품은 그 칸 자체가 안 나간다", () => {
    // 열셋 전부 축이 있으므로, 없는 상품 id 로 그 길을 확인한다.
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "no-such-product" }));
    assert.equal("product_axis" in payload.delivery, false);
    assert.equal(axisFor("no-such-product"), null);
  });

  it("판매 중인 모든 상품에 축이 있다 — 제목만 다른 리포트를 팔지 않는다", () => {
    for (const id of Object.keys(PRODUCT_MAP)) {
      const axis = READING_AXES[id];
      assert.ok(axis, `${id} 에 축이 없다`);
      assert.ok(axis.axes.length >= 3, `${id} 축이 셋도 안 된다`);
      assert.ok(axis.avoid.length >= 2, `${id} 가 옆 상품의 물음을 막지 않는다`);
      assert.ok(axis.question.length > 20, `${id} 물음이 너무 짧다`);
    }
  });

  it("재회 축 — 선이 있고, 옆 상품 셋의 물음을 막고, 지수를 판다", () => {
    // 2026-08-25 초안. 속궁합과 달리 선(line)이 하나 있다 — 재접근을 부추기는 글이
    // 되면 안 되기 때문이다. 선이 있으면 그대로 실려야 한다.
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "jaehoe" }));
    const axis = payload.delivery.product_axis;
    assert.ok(axis, "재회에 축이 없다");
    assert.equal(axis.question, READING_AXES.jaehoe.question);
    assert.equal(axis.axes.length, 4);
    assert.ok(Array.isArray(axis.line) && axis.line.length === 1, "재접근을 부추기지 않는 선 하나");
    // 옆 상품이 답할 물음은 여기서 답하지 않는다. 셋 다 이름이 적혀 있어야 한다.
    for (const neighbour of ["속궁합", "결혼", "이별"]) {
      assert.ok(axis.avoid.some((a: string) => a.includes(neighbour)), `${neighbour} 의 물음을 막는 줄이 없다`);
    }
    assert.equal(READING_AXES.jaehoe.usesScore, true);
  });

  it("productId 를 안 넘기면 예전 그대로다", () => {
    const payload = JSON.parse(buildReadingInput(base));
    assert.equal("product_axis" in payload.delivery, false);
  });

  it("지시문이 축을 어떻게 다룰지 말해 둔다", () => {
    assert.ok(READING_SYSTEM_PROMPT.includes("delivery.product_axis"));
    // 축이 규칙을 이기면 승인되지 않은 명리 주장이 문장으로 나간다.
    assert.ok(READING_SYSTEM_PROMPT.includes("축은 규칙을 이기지 못한다"));
  });

  it("READING_AXIS_OFF 로 상품 하나의 축을 배포 없이 끈다", () => {
    // 비교 하네스가 쓰고, 운영에서 축 하나가 리포트를 망가뜨렸을 때 되돌리는 스위치.
    // 표를 고치는 방식은 모듈 인스턴스가 둘일 때 안 통했다 — 환경변수는 프로세스가 같이 본다.
    const before = process.env.READING_AXIS_OFF;
    try {
      process.env.READING_AXIS_OFF = "jaehoe, ibyeol";
      assert.equal(axisFor("jaehoe"), null, "끈 상품은 축이 없다");
      assert.ok(axisFor("sokgunghap"), "안 끈 상품은 그대로다");
      const payload = JSON.parse(buildReadingInput({ ...base, productId: "jaehoe" }));
      assert.equal("product_axis" in payload.delivery, false);
      assert.equal("product_score" in payload.delivery, false, "축이 꺼지면 지수도 안 간다");
    } finally {
      if (before === undefined) delete process.env.READING_AXIS_OFF;
      else process.env.READING_AXIS_OFF = before;
    }
  });

  it("축을 단 상품은 실제로 있는 상품이다", () => {
    for (const id of Object.keys(READING_AXES)) {
      assert.ok(PRODUCT_MAP[id], `${id} 는 상품 목록에 없다`);
    }
  });
});

describe("상품 지수", () => {
  const score = {
    value: 71,
    label: "속궁합 지수",
    band: "쉽게 안 식는 합",
    factors: [{ label: "일지 육합", delta: 8, basis: "사신합" }],
  };

  it("지수를 파는 상품에는 숫자가 간다", () => {
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "sokgunghap", score }));
    assert.equal(payload.delivery.product_score.value, 71);
    assert.equal(payload.delivery.product_score.band, "쉽게 안 식는 합");
  });

  it("지수를 팔지 않는 상품에는 숫자를 줘도 안 나간다", () => {
    // 연애 기질의 게이지는 등급이 아니라 유형 이름이라 본문이 숫자를 부르면 어색하다.
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "bamgijil", score }));
    assert.equal("product_score" in payload.delivery, false);
    assert.equal(READING_AXES.bamgijil.usesScore, undefined);
  });

  it("재회는 지수를 판다 — 화면의 재회 가능성이 본문에도 간다", () => {
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "jaehoe", score }));
    assert.equal(payload.delivery.product_score.value, 71);
  });

  it("숫자가 없으면 그 칸도 없다", () => {
    const payload = JSON.parse(buildReadingInput({ ...base, productId: "sokgunghap" }));
    assert.equal("product_score" in payload.delivery, false);
  });

  it("없는 것을 이름으로 부르는 인자는 안 보낸다", () => {
    // "도화 없음" 이 문장으로 들어가면 독자는 자기 명식에 도화가 있다고 읽는다.
    const payload = JSON.parse(
      buildReadingInput({
        ...base,
        productId: "sokgunghap",
        score: {
          ...score,
          factors: [
            { label: "도화 없음", delta: -10, basis: "명식에 도화·홍염이 앉지 않았다" },
            { label: "관성 없음", delta: -9, basis: "명식에 정관·편관이 없다" },
            { label: "일지 충", delta: -14, basis: "사해충" },
          ],
        },
      })
    );
    const labels = payload.delivery.product_score.factors.map((f: { label: string }) => f.label);
    assert.deepEqual(labels, ["일지 충"]);
  });

  it("인자는 셋까지만 간다", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ label: `인자${i}`, delta: 5, basis: "" }));
    const payload = JSON.parse(
      buildReadingInput({ ...base, productId: "sokgunghap", score: { ...score, factors: many } })
    );
    assert.equal(payload.delivery.product_score.factors.length, 3);
  });

  it("지시문이 숫자를 다시 매기지 말라고 못 박는다", () => {
    assert.ok(READING_SYSTEM_PROMPT.includes("delivery.product_score"));
    assert.ok(READING_SYSTEM_PROMPT.includes("facts_used 에 적지 않는다"));
  });
});
