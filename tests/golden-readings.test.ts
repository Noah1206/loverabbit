// 결정적인 층의 골든 픽스처 — 명식·켜진 규칙·지수·범위.
//
// 리딩에서 흔들리는 것은 문장뿐이다. 그 앞의 네 층은 같은 생년월일을 넣으면
// 언제나 같은 값이 나와야 한다. 축(reading-axis.ts)을 채우고 규칙 도메인을 넓힐
// 때 "근거 목록이 왜 달라졌나"를 정확히 잡으려면 그 값이 파일로 남아 있어야 한다.
//
// LLM 출력을 골든으로 잡지 않는다. 그건 비결정적이라 매번 흔들리고, 흔들리는
// 것을 기준으로 두면 아무도 그 실패를 믿지 않게 된다.
//
// 바꿀 때: UPDATE_GOLDEN=1 npm test -- 파일이 다시 써진다. diff 를 읽고,
// 달라진 이유를 커밋 메시지에 적는다. 이유를 못 적으면 바꾸면 안 되는 것이다.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { PRODUCT_MAP } from "@/lib/products";
import { matchRules } from "@/lib/reading-rules";
import { scopeOutline } from "@/lib/reading-scope";
import { buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import { computeSajuScore } from "@/lib/saju-score";

const DIR = path.join(process.cwd(), "tests", "golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

// 발급 시각을 고정한다. 대운·세운·월운이 여기서 갈리므로 바꾸면 전부 다시 써야 한다.
const NOW = new Date("2026-08-25T12:00:00+09:00");

type Person = Parameters<typeof buildSajuFacts>[0];

/**
 * 대표 명식. 경계를 하나씩 밟도록 골랐다.
 *
 *   canonical  저장소가 다른 테스트에서도 쓰는 기준 짝
 *   no-hour    시주 없음 — META-NO-HOUR 가 켜지고 시주 규칙이 꺼진다
 *   male-self  본인이 남성 — 배우자성이 재성으로 바뀐다 (SPOUSE-STAR-M, LUCK-JAE-M)
 */
const CASES: Record<string, { me: Person; partner: Person }> = {
  canonical: {
    me: { year: 1993, month: 1, day: 24, hour: 14, gender: "F" },
    partner: { year: 1991, month: 7, day: 8, hour: 20, gender: "M" },
  },
  "no-hour": {
    me: { year: 1996, month: 11, day: 3, hour: null, gender: "F" },
    partner: { year: 1994, month: 5, day: 17, hour: 9, gender: "M" },
  },
  "male-self": {
    me: { year: 1989, month: 6, day: 30, hour: 22, gender: "M" },
    partner: { year: 1990, month: 2, day: 14, hour: 3, gender: "F" },
  },
};

/**
 * 열세 상품 전부. 처음에는 축을 채우는 넷만 걸었는데, 축이 다 채워진 뒤로는 어느 상품의
 * 규칙 도메인이나 지수 배합을 건드려도 여기서 잡혀야 한다. 상품 목록과 어긋나면 아래
 * 테스트가 실패한다 — 상품을 더하고 골든을 안 만드는 일을 막는다.
 */
const PRODUCTS = [
  "sokgunghap", "jaehoe", "ibyeol", "yeonae",
  "bamgijil", "baramgi", "gyeolhon", "gwontaegi", "hwanseung", "sseom", "jjak", "bimil", "dohwasal",
  "jikeop", "jaemul", "gongbu",
] as const;

function pillar(p: { stem: string; branch: string } | null) {
  return p ? `${p.stem}${p.branch}` : null;
}

/** 파일에 남길 만큼만. 전체 SajuFacts 는 너무 커서 diff 가 읽히지 않는다. */
function slim(facts: SajuFacts) {
  return {
    pillars: {
      year: pillar(facts.fourPillars.year),
      month: pillar(facts.fourPillars.month),
      day: pillar(facts.fourPillars.day),
      hour: pillar(facts.fourPillars.hour),
    },
    dayMaster: facts.dayMaster,
    strength: { label: facts.strength.label, score: facts.strength.score },
    dominantTenGods: facts.dominantTenGods,
    missingElements: facts.missingElements,
    absentElements: facts.absentElements,
    shinsal: facts.shinsal.map((s) => s.name),
    relations: facts.notableRelations.map((r) => r.label),
    xing: facts.xing.map((x) => `${x.kind}:${x.branches.join("")}:${x.completeness}`),
    luck: {
      major: facts.luckContext.majorLuck
        ? `${facts.luckContext.majorLuck.currentPillar} ${facts.luckContext.majorLuck.currentTenGod}`
        : null,
      yearly: `${facts.luckContext.yearly.pillar} ${facts.luckContext.yearly.tenGod}`,
      monthly: `${facts.luckContext.monthly.pillar} ${facts.luckContext.monthly.tenGod}`,
      upcomingMonths: facts.luckContext.upcoming.months.length,
      nextYear: facts.luckContext.upcoming.nextYear?.pillar
        ? pillar(facts.luckContext.upcoming.nextYear.pillar)
        : null,
    },
  };
}

function snapshot(productId: (typeof PRODUCTS)[number], caseId: keyof typeof CASES) {
  const product = PRODUCT_MAP[productId];
  const { me, partner } = CASES[caseId];
  const meFacts = buildSajuFacts(me, NOW);
  const partnerFacts = product.needsPartner ? buildSajuFacts(partner, NOW) : null;

  const rules = matchRules(meFacts, partnerFacts, productId, Math.max(12, product.toc.length));
  const score = computeSajuScore(productId, meFacts, partnerFacts);
  const scoped = scopeOutline({
    product: productId,
    outline: product.toc,
    facts: meFacts,
    matchedRules: rules,
    label: product.promptLabel,
  });

  return {
    product: productId,
    case: caseId,
    now: NOW.toISOString(),
    me: { birth: me, ...slim(meFacts) },
    partner: partnerFacts ? { birth: partner, ...slim(partnerFacts) } : null,
    rules: rules.map((r) => r.id),
    score: {
      value: score.value,
      band: product.meterLabels[score.bandIndex] ?? null,
      factors: score.factors.map((f) => ({ label: f.label, delta: f.delta })),
    },
    scope: {
      label: scoped.label,
      outline: scoped.outline,
      dropped: scoped.dropped,
      notes: scoped.notes,
    },
  };
}

describe("골든: 명식·규칙·지수·범위", () => {
  it("판매 중인 상품은 전부 골든이 있다", () => {
    assert.deepEqual([...PRODUCTS].sort(), Object.keys(PRODUCT_MAP).sort());
  });

  for (const productId of PRODUCTS) {
    for (const caseId of Object.keys(CASES) as (keyof typeof CASES)[]) {
      it(`${productId} / ${caseId}`, () => {
        const actual = snapshot(productId, caseId);
        const file = path.join(DIR, `${productId}.${caseId}.json`);

        if (UPDATE) {
          mkdirSync(DIR, { recursive: true });
          writeFileSync(file, JSON.stringify(actual, null, 2) + "\n");
          return;
        }
        assert.ok(
          existsSync(file),
          `골든이 없다: ${path.relative(process.cwd(), file)} — UPDATE_GOLDEN=1 npm test 로 만든다`
        );
        const expected = JSON.parse(readFileSync(file, "utf8"));
        assert.deepEqual(
          actual,
          expected,
          `${productId}/${caseId} 가 골든과 다르다. 의도한 변경이면 UPDATE_GOLDEN=1 로 다시 쓰고 이유를 커밋에 적는다.`
        );
      });
    }
  }

  it("같은 두 명식이면 재회와 이별은 같은 상대 규칙을 받는다 — 둘을 가르는 것은 축이다", () => {
    // 자르지 않고 전부 켠다. 목차 길이(15 vs 10)로 잘린 차이를 규칙 풀의 차이로 읽지 않기 위해서다.
    const { me, partner } = CASES.canonical;
    const meFacts = buildSajuFacts(me, NOW);
    const partnerFacts = buildSajuFacts(partner, NOW);
    const j = new Set(matchRules(meFacts, partnerFacts, "jaehoe", 100).map((r) => r.id));
    const i = new Set(matchRules(meFacts, partnerFacts, "ibyeol", 100).map((r) => r.id));
    const onlyJaehoe = [...j].filter((id) => !i.has(id));
    const onlyIbyeol = [...i].filter((id) => !j.has(id));

    // 2026-08-25 상대 규칙(P-*) 열한 개를 이별 도메인에 더했다. 이제 이별도 같은 두
    // 사람에서 같은 상대 근거를 받고, 남는 차이는 재회에만 켜는 편재·역마뿐이다.
    assert.deepEqual(
      onlyJaehoe.sort(),
      ["SIN-YEOKMA", "TG-PYEONJAE"].filter((id) => j.has(id)),
      "재회에만 있는 것은 편재·역마뿐이어야 한다 — 상대 규칙은 양쪽에 다 켜진다"
    );
    assert.ok([...i].some((id) => id.startsWith("P-")), "이별에도 상대 규칙이 켜진다");
    assert.deepEqual(onlyIbyeol, [], "이별에만 켜지는 규칙은 없다");
  });
});
