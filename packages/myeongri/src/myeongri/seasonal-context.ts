// 계절 맥락 — 고급 해석에서 **유일하게 결론이 아닌 층**.
//
// 이 파일이 내는 값은 학설이 갈리지 않는다. 축월이 겨울이라는 것, 그 사람이 소한과
// 입춘 사이에 태어났다는 것, 진·축이 습토이고 술·미가 조토라는 것은 계산이다.
// 그래서 이것만은 내부 정책(SRC-INTERNAL-CLIMATE)으로 서고 고전 출처를 필요로 하지 않는다.
//
// 반대로 "그래서 화가 필요하다" 는 결론이다. 그건 여기서 내지 않는다 — johu.ts 로 넘긴다.
// 둘을 한 파일에 두면 계산과 결론이 같은 무게로 읽히고, 그 순간 되돌릴 수 없게 섞인다.

import { JIJI, type Ohaeng, type SajuChart } from "../saju";
import { MONTH_TERM_NAMES, nextMonthTerm, previousMonthTerm } from "../solar-terms";
import { hiddenStemsOf, stemElementOf } from "../myeongri/hidden-stems";
import { CALCULATION_POLICY_VERSION } from "../myeongri/policy";

export type Season = "spring" | "summer" | "autumn" | "winter" | "transition";
export type Temperature = "cold" | "cool" | "balanced" | "warm" | "hot";
export type Moisture = "dry" | "balanced" | "wet";

export interface SeasonalContext {
  monthBranch: string;
  solarTermWindow: {
    /** 이 사람이 태어난 절기 구간의 시작 절기 */
    birthSolarTerm: string;
    season: Season;
    /** 절입에 가까운가 — 사흘 안쪽이면 경계로 본다 */
    beforeOrAfterTerm?: "before" | "after" | "at_boundary";
    /** 절입으로부터 며칠째인가. 심천(深淺)을 말할 때 쓴다. */
    daysIntoTerm: number;
  };
  climateAxes: {
    temperature: Temperature;
    moisture: Moisture;
  };
  evidence: Array<{
    kind: "month_branch" | "solar_term" | "stem_branch" | "hidden_stem";
    value: string;
    source: string;
  }>;
  calculationPolicyVersion: string;
}

/** 월지의 계절 — 진술축미는 각 계절의 끝이라 transition 으로 따로 둔다 */
const SEASON_OF_BRANCH: Record<string, Season> = {
  인: "spring", 묘: "spring",
  사: "summer", 오: "summer",
  신: "autumn", 유: "autumn",
  해: "winter", 자: "winter",
  진: "transition", 술: "transition", 축: "transition", 미: "transition",
};

/**
 * 월지의 온도.
 *
 * 진술축미는 사계(四季)지만 온도가 다르다. 축은 한겨울 끝의 언 흙이고 미는 한여름
 * 끝의 마른 흙이다. 사계라는 이유로 넷을 balanced 로 묶으면 조후가 가장 필요한
 * 두 자리(축·미)가 사라진다.
 */
const TEMPERATURE_OF_BRANCH: Record<string, Temperature> = {
  해: "cold", 자: "cold", 축: "cold",
  인: "cool", 묘: "cool", 진: "balanced",
  사: "warm", 오: "hot", 미: "hot",
  신: "balanced", 유: "cool", 술: "cool",
};

/** 월지의 습도. 진·축은 습토, 술·미는 조토. */
const MOISTURE_OF_BRANCH: Record<string, Moisture> = {
  해: "wet", 자: "wet", 축: "wet", 진: "wet",
  인: "balanced", 묘: "balanced", 사: "balanced", 신: "balanced", 유: "balanced",
  오: "dry", 미: "dry", 술: "dry",
};

const SRC = "SRC-INTERNAL-CLIMATE";
const BOUNDARY_DAYS = 3;
const DAY_MS = 86400000;

export function seasonalContext(chart: SajuChart): SeasonalContext {
  const monthBranch = chart.month.ji;
  const at = chart.moment.instantUtcMs;
  const opened = previousMonthTerm(at);
  const closes = nextMonthTerm(at);
  const daysIntoTerm = Math.floor((at - opened.utcMs) / DAY_MS);
  const daysToNext = Math.floor((closes.utcMs - at) / DAY_MS);

  const boundary: SeasonalContext["solarTermWindow"]["beforeOrAfterTerm"] =
    daysIntoTerm <= BOUNDARY_DAYS
      ? "after"
      : daysToNext <= BOUNDARY_DAYS
        ? "before"
        : undefined;

  const temperature = TEMPERATURE_OF_BRANCH[monthBranch] ?? "balanced";
  const moisture = MOISTURE_OF_BRANCH[monthBranch] ?? "balanced";

  const evidence: SeasonalContext["evidence"] = [
    { kind: "month_branch", value: `월지 ${monthBranch}`, source: SRC },
    {
      kind: "solar_term",
      value: `${opened.name} 이후 ${daysIntoTerm}일 (다음 절입 ${closes.name}까지 ${daysToNext}일)`,
      source: SRC,
    },
  ];

  // 천간·지지 전체에서 화·수가 실제로 얼마나 있는지 — 계절만으로는 못 보는 것
  const branches = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean);
  const stems = branches.map((p) => p!.gan);
  evidence.push({
    kind: "stem_branch",
    value: `천간 ${stems.join("")} / 지지 ${branches.map((p) => p!.ji).join("")}`,
    source: SRC,
  });

  // 월지 지장간 — 같은 축월이어도 계수만 쓸 때와 신금까지 볼 때가 다르다
  const monthHidden = hiddenStemsOf(chart.month.jiIdx);
  evidence.push({
    kind: "hidden_stem",
    value: `월지 지장간 ${monthHidden.map((h) => `${h.stem}(${h.role})`).join(" ")}`,
    source: SRC,
  });

  return {
    monthBranch,
    solarTermWindow: {
      birthSolarTerm: opened.name,
      season: SEASON_OF_BRANCH[monthBranch] ?? "transition",
      ...(boundary ? { beforeOrAfterTerm: boundary } : {}),
      daysIntoTerm,
    },
    climateAxes: { temperature, moisture },
    evidence,
    calculationPolicyVersion: CALCULATION_POLICY_VERSION,
  };
}

/** 절기 이름이 표에 있는 열두 개 중 하나인가 — 회귀 테스트가 쓴다 */
export function isMonthTermName(name: string): boolean {
  return MONTH_TERM_NAMES.includes(name);
}

/** 명식 전체에 그 오행이 (지장간까지 열어) 있는가 — 조후 후보가 명식 안에 있는지 볼 때 */
export function elementsPresent(chart: SajuChart): Set<Ohaeng> {
  const out = new Set<Ohaeng>();
  for (const pillar of [chart.year, chart.month, chart.day, chart.hour]) {
    if (!pillar) continue;
    out.add(stemElementOf(pillar.gan));
    for (const hidden of hiddenStemsOf(pillar.jiIdx)) out.add(stemElementOf(hidden.stem));
  }
  return out;
}

/** 지지 이름에서 색인으로 — 표를 다룰 때 쓴다 */
export function branchIndex(name: string): number {
  return JIJI.indexOf(name as (typeof JIJI)[number]);
}
