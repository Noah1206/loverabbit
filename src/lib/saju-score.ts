// 상품 게이지 지수 — 명식에서 산출한다.
//
// 이전에는 명식 문자열의 해시(h = h*31 + charCode)로 55~95를 냈다. 같은 사주면
// 같은 값이 나오긴 했지만 명리적 근거가 없었고, 그 숫자가 유료 상품의 핵심
// 표시였다. 여기서는 인자(factor)를 하나씩 계산하고, 그 인자와 근거를 함께
// 남긴다. 해금 후 화면에 "무엇 때문에 이 점수인지"를 그대로 보여줄 수 있다.
//
// 시간 의존성에 대하여:
//   luckFavor는 대운·세운을 보므로 같은 사람이라도 해가 바뀌면 값이 달라진다.
//   운을 보는 지수이니 그게 맞다. 대신 발급 시점의 값은 리딩과 함께 봉인한다.
//   봉인(SealedScore)에는 숫자만이 아니라 "어느 운을 보고 낸 값인가"(asOf)와
//   "어느 배합표로 냈는가"(engine)까지 넣는다. 이미 팔린 리딩은 해가 바뀌어도,
//   배합표를 고쳐도 다시 계산하지 않는다 — 저장된 봉인을 그대로 읽어 보여준다.

import { CHEONGAN, JIJI, type Ohaeng } from "./saju";
import {
  BRANCH_CLASHES,
  BRANCH_SIX_COMBOS,
  BRANCH_TRIPLES,
  CONTROLS,
  GENERATES,
  HEAVENLY_COMBOS,
  type SajuFacts,
} from "./saju-facts";
import { WONJIN } from "./saju-shinsal";
import { shinsalCount } from "./saju-shinsal";

export interface ScoreFactor {
  /** 화면에 그대로 찍히는 인자 이름 */
  label: string;
  /** 기준점에서 얼마나 밀었는가 */
  delta: number;
  /** 어느 글자에서 나왔는지 */
  basis: string;
  /** 운(대운·세운)에서 나온 인자인가 — 해가 바뀌면 달라지는 부분 */
  timeVarying?: boolean;
}

/** 지수를 낼 때 본 운의 창(窓). 봉인에 같이 넣어 나중에 되짚는다. */
export interface ScoreAsOf {
  /** 누구의 운을 봤는가. 바람기처럼 상대를 판정하는 상품이 있다. */
  subject: "me" | "partner";
  majorLuck: { pillar: string; range: string; tenGod: string } | null;
  yearly: { year: number; pillar: string; tenGod: string };
  monthly: { month: number; pillar: string; tenGod: string };
}

export interface SajuScore {
  /** 20~95. 0과 100은 내지 않는다 — 명리는 확정을 말하지 않는다. */
  value: number;
  /** products.meterLabels의 인덱스 (0~4) */
  bandIndex: number;
  factors: ScoreFactor[];
  /** 이 값을 낼 때 열려 있던 운 */
  asOf: ScoreAsOf;
  /** 배합표의 판(版) */
  engine: string;
}

/**
 * 발급 시점에 봉인되는 지수. 리딩 레코드에 통째로 저장되고, 해금할 때는
 * 다시 계산하지 않고 이걸 그대로 읽는다.
 */
export interface SealedScore extends SajuScore {
  /** 상품의 meterLabels 문구 */
  band: string | null;
  /** 상품의 지수 이름 ("재회 가능성" 같은) */
  label: string | null;
  /** 봉인한 시각 */
  issuedAt: string;
}

/**
 * 배합표·인자가 바뀌면 올린다. 옛 리딩의 봉인에 옛 판이 그대로 남으므로,
 * "이 숫자는 어느 규칙으로 나온 값인가"를 나중에도 답할 수 있다.
 */
// 2026-08-21: 강약 판정이 strength-v1 표로 바뀌었다. 같은 명식이 다른 강약을 내므로
// 점수도 달라진다 — 판을 올려 두어야 옛 봉인이 어느 셈법으로 나왔는지 남는다.
export const SCORE_ENGINE = "score-2026-08b";

type FactorName =
  | "pairHarmony"
  | "elementFlow"
  | "dohwaLoad"
  | "officialStar"
  | "luckFavor"
  | "stability";

interface Recipe {
  /** 어느 명식이 주인공인가. 바람기처럼 상대를 보는 상품이 있다. */
  subject: "me" | "partner";
  base: number;
  weights: Partial<Record<FactorName, number>>;
}

const stemIdx = (stem: string) => CHEONGAN.indexOf(stem as (typeof CHEONGAN)[number]);
const branchIdx = (branch: string) => JIJI.indexOf(branch as (typeof JIJI)[number]);

function dayStem(facts: SajuFacts): number {
  return stemIdx(facts.fourPillars.day.stem);
}

function dayBranch(facts: SajuFacts): number {
  return branchIdx(facts.fourPillars.day.branch);
}

function tripleOf(jiIdx: number): [number[], string] | null {
  return BRANCH_TRIPLES.find(([members]) => members.includes(jiIdx)) ?? null;
}

// ── 인자들 ──────────────────────────────────────────────────
// 각 인자는 -30 ~ +30 언저리를 낸다. 배합표의 가중치가 최종 크기를 정한다.

/** 두 일주가 서로를 당기는가 미는가 */
function pairHarmony(me: SajuFacts, partner: SajuFacts | null): ScoreFactor[] {
  if (!partner) return [];
  const out: ScoreFactor[] = [];
  const [a, b] = [dayBranch(me), dayBranch(partner)];
  const [ga, gb] = [dayStem(me), dayStem(partner)];

  if (BRANCH_SIX_COMBOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
    out.push({ label: "일지 육합", delta: 14, basis: `${JIJI[a]}·${JIJI[b]} 육합 — 서로 붙잡는 자리` });
  }
  const mine = tripleOf(a);
  if (mine && a !== b && mine[0].includes(b)) {
    out.push({ label: "일지 삼합", delta: 10, basis: `${JIJI[a]}·${JIJI[b]} 모두 ${mine[1]}` });
  }
  if (BRANCH_CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
    out.push({ label: "일지 충", delta: -14, basis: `${JIJI[a]}${JIJI[b]}충 — 같은 자리에서 부딪힌다` });
  }
  if (WONJIN.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
    out.push({ label: "일지 원진", delta: -9, basis: `${JIJI[a]}${JIJI[b]} 원진 — 이유 없이 걸린다` });
  }
  const combo = HEAVENLY_COMBOS.find(([x, y]) => (x === ga && y === gb) || (x === gb && y === ga));
  if (combo) {
    out.push({ label: "일간 천간합", delta: 11, basis: `${CHEONGAN[ga]}·${CHEONGAN[gb]} ${combo[2]}` });
  } else if (me.dayMasterElement === partner.dayMasterElement) {
    out.push({ label: "일간 같은 오행", delta: 4, basis: `둘 다 ${me.dayMasterElement} — 결이 비슷하다` });
  }
  return out;
}

/** 상대의 일간 오행이 내 강약에 유리한 방향인가 */
function elementFlow(me: SajuFacts, partner: SajuFacts | null): ScoreFactor[] {
  if (!partner) return [];
  const mineEl = me.dayMasterElement as Ohaeng;
  const theirs = partner.dayMasterElement as Ohaeng;
  const supports = GENERATES[theirs] === mineEl || theirs === mineEl; // 인성·비겁
  const drains = GENERATES[mineEl] === theirs || CONTROLS[mineEl] === theirs; // 식상·재성
  const presses = CONTROLS[theirs] === mineEl; // 관성

  if (me.strength.label === "신약") {
    if (supports) return [{ label: "상대가 나를 받쳐준다", delta: 12, basis: `내 ${mineEl}이 약한데 상대 ${theirs}이 힘을 보탠다` }];
    if (presses) return [{ label: "상대가 나를 누른다", delta: -8, basis: `약한 ${mineEl}을 상대 ${theirs}이 극한다` }];
    return [{ label: "상대가 나를 덜어낸다", delta: -3, basis: `약한 ${mineEl}에서 ${theirs}으로 기운이 빠진다` }];
  }
  if (me.strength.label === "신강") {
    if (drains || presses) return [{ label: "상대가 나를 풀어준다", delta: 12, basis: `과한 ${mineEl}을 상대 ${theirs}이 덜어낸다` }];
    return [{ label: "상대가 나를 더 채운다", delta: -6, basis: `이미 강한 ${mineEl}에 ${theirs}이 더해진다` }];
  }
  return [{ label: "오행이 무난하다", delta: 3, basis: `중화된 ${mineEl}에 상대 ${theirs}이 크게 흔들지 않는다` }];
}

/** 도화·홍염 — 이성을 끌어당기는 힘 */
function dohwaLoad(facts: SajuFacts): ScoreFactor[] {
  const dohwa = shinsalCount(facts.shinsal, "도화");
  const hongyeom = shinsalCount(facts.shinsal, "홍염");
  if (dohwa + hongyeom === 0) {
    return [{ label: "도화 없음", delta: -10, basis: "명식에 도화·홍염이 앉지 않았다" }];
  }
  const out: ScoreFactor[] = [];
  if (dohwa > 0) {
    out.push({
      label: `도화 ${dohwa}자리`,
      delta: Math.min(24, dohwa * 9),
      basis: facts.shinsal.find((s) => s.name === "도화")?.positions.join("·") ?? "",
    });
  }
  if (hongyeom > 0) {
    out.push({
      label: `홍염 ${hongyeom}자리`,
      delta: Math.min(14, hongyeom * 7),
      basis: facts.shinsal.find((s) => s.name === "홍염")?.positions.join("·") ?? "",
    });
  }
  return out;
}

/** 관성 — 관계를 붙들어두는 축. 결혼·재회에서 크게 본다. */
function officialStar(facts: SajuFacts): ScoreFactor[] {
  const jeonggwan = facts.tenGods.filter((t) => t.tenGod === "정관").length;
  const pyeongwan = facts.tenGods.filter((t) => t.tenGod === "편관").length;
  if (jeonggwan === 0 && pyeongwan === 0) {
    return [{ label: "관성 없음", delta: -9, basis: "명식에 정관·편관이 없다 — 매이는 힘이 약하다" }];
  }
  const out: ScoreFactor[] = [];
  if (jeonggwan > 0) out.push({ label: `정관 ${jeonggwan}개`, delta: Math.min(16, jeonggwan * 8), basis: "관계를 형태로 지키는 힘" });
  if (pyeongwan > 0) out.push({ label: `편관 ${pyeongwan}개`, delta: Math.min(8, pyeongwan * 4), basis: "당기지만 거칠게 작용한다" });
  return out;
}

// 운의 십성이 관계에 어떻게 걸리는가
const LUCK_WEIGHT: Record<string, number> = {
  정인: 7, 정관: 8, 정재: 7, 식신: 6,
  편인: -2, 편관: -5, 편재: 2, 상관: -7, 겁재: -6, 비견: 0,
};

/** 대운·세운·월운이 지금 관계 쪽으로 열려 있는가 */
function luckFavor(facts: SajuFacts): ScoreFactor[] {
  const out: ScoreFactor[] = [];
  const major = facts.luckContext.majorLuck;
  if (major) {
    const delta = (LUCK_WEIGHT[major.currentTenGod] ?? 0) * 1.4;
    out.push({
      label: `대운 ${major.currentTenGod}`,
      delta: Math.round(delta),
      basis: `${major.currentPillar} (${major.currentRange})`,
      timeVarying: true,
    });
  }
  const yearly = facts.luckContext.yearly;
  out.push({
    label: `세운 ${yearly.tenGod}`,
    delta: LUCK_WEIGHT[yearly.tenGod] ?? 0,
    basis: `${yearly.year}년 ${yearly.pillar}`,
    timeVarying: true,
  });
  return out.filter((factor) => factor.delta !== 0);
}

/** 명식 자체가 흔들리지 않는가 */
function stability(facts: SajuFacts): ScoreFactor[] {
  const out: ScoreFactor[] = [];
  const distance = Math.abs(facts.strength.score - 50);
  out.push({
    label: distance <= 12 ? "중화에 가깝다" : `${facts.strength.label}으로 기울었다`,
    delta: Math.round(10 - distance / 3),
    basis: `강약 ${facts.strength.score}점`,
  });
  const clashes = facts.notableRelations.filter((r) => r.kind === "지지충").length;
  if (clashes > 0) {
    out.push({
      label: `명식 안의 충 ${clashes}개`,
      delta: -5 * clashes,
      basis: facts.notableRelations.filter((r) => r.kind === "지지충").map((r) => r.label).join(", "),
    });
  }
  return out;
}

// ── 상품별 배합표 ──────────────────────────────────────────
// subject를 생략하면 본인 명식을 본다. 바람기처럼 상대를 판정하는 상품만 partner.

const DEFAULT_RECIPE: Recipe = {
  subject: "me",
  base: 52,
  weights: { stability: 1, luckFavor: 1, pairHarmony: 0.8, elementFlow: 0.6 },
};

const RECIPES: Record<string, Recipe> = {
  // 속궁합 — 두 일주의 당김이 전부
  sokgunghap: { subject: "me", base: 50, weights: { pairHarmony: 1.2, elementFlow: 0.9, dohwaLoad: 0.4 } },
  // 재회 — 남은 인력 + 지금 운이 열렸는가
  jaehoe: { subject: "me", base: 46, weights: { pairHarmony: 1.0, luckFavor: 1.1, officialStar: 0.5 } },
  // 연애 기질(숨은 매력) — 도화와 명식의 균형
  bamgijil: { subject: "me", base: 52, weights: { dohwaLoad: 1.1, stability: 0.8, luckFavor: 0.4 } },
  // 바람기 — 판정 대상은 상대. 높을수록 위험하므로 관성은 뺀다.
  baramgi: { subject: "partner", base: 40, weights: { dohwaLoad: 1.3, officialStar: -0.8, stability: -0.5 } },
  // 결혼 상성 — 관성과 두 일주의 합, 그리고 흔들리지 않음
  gyeolhon: { subject: "me", base: 48, weights: { pairHarmony: 1.0, officialStar: 0.9, stability: 0.8, elementFlow: 0.5 } },
  // 권태기 회복력 — 지금 운과 두 사람의 결
  gwontaegi: { subject: "me", base: 48, weights: { luckFavor: 1.1, pairHarmony: 0.9, stability: 0.7 } },
  // 환승 손익 — 새 길이 유리한가. 지금 관계의 합이 강할수록 낮게 본다.
  hwanseung: { subject: "me", base: 52, weights: { luckFavor: 1.2, pairHarmony: -0.8, dohwaLoad: 0.6 } },
  // 썸 성사 — 당김과 운
  sseom: { subject: "me", base: 50, weights: { pairHarmony: 1.1, luckFavor: 0.9, dohwaLoad: 0.5 } },
  // 고백 성공률 — 상대 쪽 관성과 두 사람의 합
  jjak: { subject: "me", base: 44, weights: { pairHarmony: 1.2, luckFavor: 0.8, elementFlow: 0.7 } },
  // 비밀연애 지속력 — 붙드는 힘과 안정
  bimil: { subject: "me", base: 48, weights: { pairHarmony: 1.0, officialStar: 0.7, stability: 0.9 } },
  // 이별 회복 진행률 — 지금 운이 얼마나 풀렸는가
  ibyeol: { subject: "me", base: 50, weights: { luckFavor: 1.3, stability: 0.9, pairHarmony: -0.5 } },
  // 도화 지수 — 이름 그대로
  dohwasal: { subject: "me", base: 42, weights: { dohwaLoad: 1.5, luckFavor: 0.4, stability: 0.3 } },
  // 인연 근접도 — 운이 열렸는가 + 끌어당기는 힘
  insun: { subject: "me", base: 46, weights: { luckFavor: 1.3, dohwaLoad: 0.8, officialStar: 0.5 } },
  // 올해 연애운 — 세운 중심
  yeonae: { subject: "me", base: 48, weights: { luckFavor: 1.5, dohwaLoad: 0.6, stability: 0.5 } },
};

const FACTORS: Record<FactorName, (subject: SajuFacts, other: SajuFacts | null) => ScoreFactor[]> = {
  pairHarmony,
  elementFlow,
  dohwaLoad: (subject) => dohwaLoad(subject),
  officialStar: (subject) => officialStar(subject),
  luckFavor: (subject) => luckFavor(subject),
  stability: (subject) => stability(subject),
};

/** 20~95를 다섯 구간으로 — products.meterLabels의 인덱스가 된다 */
function bandOf(value: number): number {
  if (value < 35) return 0;
  if (value < 50) return 1;
  if (value < 65) return 2;
  if (value < 80) return 3;
  return 4;
}

/**
 * 상품별 지수. 주인공 명식과 상대 명식을 받아 인자를 더하고, 근거를 함께 돌려준다.
 * 상대가 없는 상품은 두 명식이 필요한 인자를 그냥 건너뛴다.
 */
export function computeSajuScore(
  productId: string,
  me: SajuFacts,
  partner: SajuFacts | null
): SajuScore {
  const recipe = RECIPES[productId] ?? DEFAULT_RECIPE;
  // 주인공이 상대인 상품(바람기)인데 상대가 없으면 본인 명식으로 되돌린다
  const subject = recipe.subject === "partner" && partner ? partner : me;
  const other = subject === me ? partner : me;

  const factors: ScoreFactor[] = [];
  let total = recipe.base;

  for (const [name, weight] of Object.entries(recipe.weights) as [FactorName, number][]) {
    for (const factor of FACTORS[name](subject, other)) {
      const delta = Math.round(factor.delta * weight);
      if (delta === 0) continue;
      total += delta;
      factors.push({ ...factor, delta });
    }
  }

  const value = Math.max(20, Math.min(95, Math.round(total)));
  return {
    value,
    bandIndex: bandOf(value),
    // 영향이 큰 근거부터 보여준다
    factors: factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    asOf: asOfFrom(subject, subject === me ? "me" : "partner"),
    engine: SCORE_ENGINE,
  };
}

/** 지수를 낼 때 본 운을 그대로 옮겨 적는다 */
function asOfFrom(subject: SajuFacts, whose: "me" | "partner"): ScoreAsOf {
  const major = subject.luckContext.majorLuck;
  return {
    subject: whose,
    majorLuck: major
      ? { pillar: major.currentPillar, range: major.currentRange, tenGod: major.currentTenGod }
      : null,
    yearly: { ...subject.luckContext.yearly },
    monthly: { ...subject.luckContext.monthly },
  };
}

/**
 * 계산 결과에 상품 문구와 발급 시각을 붙여 봉인 형태로 만든다.
 * 이 값이 리딩 레코드에 저장되고, 해금·재조회는 전부 여기서 읽는다.
 */
export function sealScore(
  score: SajuScore,
  meta: { band: string | null; label: string | null; issuedAt: string }
): SealedScore {
  return { ...score, band: meta.band, label: meta.label, issuedAt: meta.issuedAt };
}

/** 운에서 온 인자가 하나라도 있으면, 그 숫자는 발급 시점에 묶인 값이다 */
export function isTimeBound(seal: Pick<SealedScore, "factors">): boolean {
  return seal.factors.some((factor) => factor.timeVarying === true);
}
