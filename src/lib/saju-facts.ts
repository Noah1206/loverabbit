// 명식에서 해석 단서를 뽑아내는 규칙 엔진.
//
// 여기까지가 결정론적 계산의 끝이다. AI는 이 결과(saju_facts)만 근거로 쓰고,
// 여기 없는 명리 사실을 새로 만들어내서는 안 된다.
// 같은 생년월일시에는 언제나 같은 값이 나온다.

import {
  CHEONGAN,
  CHEONGAN_OHAENG,
  JIJI,
  JIJI_OHAENG,
  computeSaju,
  currentLuckPillars,
  pillarLabel,
  type Ohaeng,
  type Pillar,
  type SajuChart,
} from "./saju";
import type { BirthMoment } from "./korea-time";
import { nextMonthTerm, previousMonthTerm } from "./solar-terms";
import { findShinsal, type ShinsalFact } from "./saju-shinsal";

export type Gender = "M" | "F";

export interface ElementBalance {
  목: number;
  화: number;
  토: number;
  금: number;
  수: number;
}

export interface StrengthFact {
  label: "신강" | "중화" | "신약";
  score: number; // 0~100, 높을수록 신강
  reasonCodes: string[];
}

export interface TenGodFact {
  position: "연간" | "연지" | "월간" | "월지" | "일지" | "시간" | "시지";
  character: string;
  tenGod: string;
}

export interface RelationFact {
  kind: "천간합" | "지지충" | "지지육합" | "삼합";
  members: string[];
  label: string;
}

export interface MajorLuck {
  direction: "순행" | "역행";
  startAge: number;
  currentPillar: string;
  currentRange: string;
  currentTenGod: string;
}

export interface SajuFacts {
  fourPillars: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string } | null;
  };
  dayMaster: string; // 예: "무토"
  dayMasterElement: Ohaeng;
  elementBalance: ElementBalance;
  missingElements: Ohaeng[];
  strength: StrengthFact;
  tenGods: TenGodFact[];
  dominantTenGods: string[];
  notableRelations: RelationFact[];
  /** 도화·역마·화개·홍염·양인·원진 — 상품 목차가 약속한 값이라 계산으로 낸다 */
  shinsal: ShinsalFact[];
  luckContext: {
    majorLuck: MajorLuck | null;
    yearly: { year: number; pillar: string; tenGod: string };
    monthly: { month: number; pillar: string; tenGod: string };
  };
  calculationNotes: string[];
}

const ELEMENTS: Ohaeng[] = ["목", "화", "토", "금", "수"];

// 오행 상생: 목->화->토->금->수->목
const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
// 오행 상극: 목->토->수->화->금->목
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

function isYangStem(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

function isYangBranch(jiIdx: number): boolean {
  return jiIdx % 2 === 0;
}

/**
 * 십성 — 일간을 기준으로 다른 글자가 어떤 관계에 놓이는가.
 * 오행 관계(같음/생/극)와 음양의 같고 다름으로 열 가지가 갈린다.
 */
function tenGodOf(dayElement: Ohaeng, dayYang: boolean, targetElement: Ohaeng, targetYang: boolean): string {
  const sameYinYang = dayYang === targetYang;
  if (targetElement === dayElement) return sameYinYang ? "비견" : "겁재";
  if (GENERATES[dayElement] === targetElement) return sameYinYang ? "식신" : "상관";
  if (CONTROLS[dayElement] === targetElement) return sameYinYang ? "편재" : "정재";
  if (CONTROLS[targetElement] === dayElement) return sameYinYang ? "편관" : "정관";
  if (GENERATES[targetElement] === dayElement) return sameYinYang ? "편인" : "정인";
  return "비견";
}

function stemElement(ganIdx: number): Ohaeng {
  return CHEONGAN_OHAENG[ganIdx] as Ohaeng;
}

function branchElement(jiIdx: number): Ohaeng {
  return JIJI_OHAENG[jiIdx] as Ohaeng;
}

function countElements(chart: SajuChart): ElementBalance {
  const balance: ElementBalance = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean) as Pillar[];
  for (const p of pillars) {
    balance[stemElement(p.ganIdx)] += 1;
    balance[branchElement(p.jiIdx)] += 1;
  }
  return balance;
}

/**
 * 신강·신약 — 일간이 뿌리와 도움을 얼마나 받는지.
 * 득령(월지), 득지(일지), 득세(같은 편의 글자 수) 세 가지로 점수를 낸다.
 */
function judgeStrength(chart: SajuChart, balance: ElementBalance): StrengthFact {
  const dayElement = stemElement(chart.day.ganIdx);
  const supportElements = new Set<Ohaeng>([dayElement]);
  for (const e of ELEMENTS) if (GENERATES[e] === dayElement) supportElements.add(e); // 나를 생하는 인성

  const reasonCodes: string[] = [];
  let score = 30;

  // 득령 — 월지가 내 편인가. 계절의 기운이라 비중이 가장 크다.
  const monthElement = branchElement(chart.month.jiIdx);
  if (supportElements.has(monthElement)) {
    score += 30;
    reasonCodes.push("득령: 월지가 일간을 돕는다");
  } else if (CONTROLS[monthElement] === dayElement) {
    score -= 15;
    reasonCodes.push("실령: 월지가 일간을 누른다");
  } else {
    reasonCodes.push("월지는 중립");
  }

  // 득지 — 일지가 내 뿌리인가
  const dayBranchElement = branchElement(chart.day.jiIdx);
  if (supportElements.has(dayBranchElement)) {
    score += 18;
    reasonCodes.push("득지: 일지에 뿌리를 둔다");
  } else if (CONTROLS[dayBranchElement] === dayElement) {
    score -= 10;
    reasonCodes.push("일지가 일간을 눌러 뿌리가 얕다");
  }

  // 득세 — 판 전체에 내 편이 몇인가
  const allies = [...supportElements].reduce((sum, e) => sum + balance[e], 0);
  const total = ELEMENTS.reduce((sum, e) => sum + balance[e], 0) || 1;
  const ratio = allies / total;
  score += Math.round((ratio - 0.4) * 60);
  reasonCodes.push(`득세: 같은 편 글자 ${allies}자 / 전체 ${total}자`);

  const clamped = Math.max(0, Math.min(100, score));
  const label = clamped >= 62 ? "신강" : clamped <= 42 ? "신약" : "중화";
  return { label, score: clamped, reasonCodes };
}

const HEAVENLY_COMBOS: [number, number, string][] = [
  [0, 5, "갑기합토"],
  [1, 6, "을경합금"],
  [2, 7, "병신합수"],
  [3, 8, "정임합목"],
  [4, 9, "무계합화"],
];

const BRANCH_CLASHES: [number, number][] = [
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
];

const BRANCH_SIX_COMBOS: [number, number][] = [
  [0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7],
];

const BRANCH_TRIPLES: [number[], string][] = [
  [[8, 0, 4], "신자진 수국"],
  [[11, 3, 7], "해묘미 목국"],
  [[2, 6, 10], "인오술 화국"],
  [[5, 9, 1], "사유축 금국"],
];

function findRelations(chart: SajuChart): RelationFact[] {
  const pillars = [chart.year, chart.month, chart.day, chart.hour].filter(Boolean) as Pillar[];
  const stems = pillars.map((p) => p.ganIdx);
  const branches = pillars.map((p) => p.jiIdx);
  const relations: RelationFact[] = [];

  for (const [a, b, label] of HEAVENLY_COMBOS) {
    if (stems.includes(a) && stems.includes(b)) {
      relations.push({ kind: "천간합", members: [CHEONGAN[a], CHEONGAN[b]], label });
    }
  }
  for (const [a, b] of BRANCH_CLASHES) {
    if (branches.includes(a) && branches.includes(b)) {
      relations.push({ kind: "지지충", members: [JIJI[a], JIJI[b]], label: `${JIJI[a]}${JIJI[b]}충` });
    }
  }
  for (const [a, b] of BRANCH_SIX_COMBOS) {
    if (branches.includes(a) && branches.includes(b)) {
      relations.push({ kind: "지지육합", members: [JIJI[a], JIJI[b]], label: `${JIJI[a]}${JIJI[b]}합` });
    }
  }
  for (const [members, label] of BRANCH_TRIPLES) {
    const hit = members.filter((m) => branches.includes(m));
    if (hit.length === 3) {
      relations.push({ kind: "삼합", members: hit.map((m) => JIJI[m]), label });
    }
  }
  return relations;
}

function collectTenGods(chart: SajuChart): TenGodFact[] {
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);
  const facts: TenGodFact[] = [];

  const push = (position: TenGodFact["position"], character: string, element: Ohaeng, yang: boolean) => {
    facts.push({ position, character, tenGod: tenGodOf(dayElement, dayYang, element, yang) });
  };

  push("연간", chart.year.gan, stemElement(chart.year.ganIdx), isYangStem(chart.year.ganIdx));
  push("연지", chart.year.ji, branchElement(chart.year.jiIdx), isYangBranch(chart.year.jiIdx));
  push("월간", chart.month.gan, stemElement(chart.month.ganIdx), isYangStem(chart.month.ganIdx));
  push("월지", chart.month.ji, branchElement(chart.month.jiIdx), isYangBranch(chart.month.jiIdx));
  push("일지", chart.day.ji, branchElement(chart.day.jiIdx), isYangBranch(chart.day.jiIdx));
  if (chart.hour) {
    push("시간", chart.hour.gan, stemElement(chart.hour.ganIdx), isYangStem(chart.hour.ganIdx));
    push("시지", chart.hour.ji, branchElement(chart.hour.jiIdx), isYangBranch(chart.hour.jiIdx));
  }
  return facts;
}

/**
 * 대운 — 월주에서 출발해 10년마다 한 칸씩 옮겨 간다.
 * 양간년 남자와 음간년 여자는 순행, 나머지는 역행. 시작 나이는 절입까지의 거리를 3일=1년으로 환산한다.
 */
function computeMajorLuck(chart: SajuChart, gender: Gender, ageNow: number): MajorLuck | null {
  const yearYang = isYangStem(chart.year.ganIdx);
  const forward = (yearYang && gender === "M") || (!yearYang && gender === "F");

  const boundary = forward
    ? nextMonthTerm(chart.moment.instantUtcMs).utcMs
    : previousMonthTerm(chart.moment.instantUtcMs).utcMs;
  const days = Math.abs(boundary - chart.moment.instantUtcMs) / 86400000;
  const startAge = Math.max(1, Math.round(days / 3));

  if (ageNow < startAge) return null; // 아직 대운에 들지 않음

  // 대운은 월주에서 60갑자를 따라 한 칸씩 옮겨 간다.
  // 월 순서(0~11)로 돌리면 12에서 되감기면서 천간이 어긋나므로, 간지를 각각 밀어야 한다.
  const step = Math.floor((ageNow - startAge) / 10);
  const moves = forward ? step + 1 : -(step + 1);
  const pillar = {
    gan: CHEONGAN[(((chart.month.ganIdx + moves) % 10) + 10) % 10],
    ji: JIJI[(((chart.month.jiIdx + moves) % 12) + 12) % 12],
    ganIdx: (((chart.month.ganIdx + moves) % 10) + 10) % 10,
    jiIdx: (((chart.month.jiIdx + moves) % 12) + 12) % 12,
  };

  const from = startAge + step * 10;
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);

  return {
    direction: forward ? "순행" : "역행",
    startAge,
    currentPillar: pillarLabel(pillar),
    currentRange: `${from}~${from + 9}세`,
    currentTenGod: tenGodOf(dayElement, dayYang, stemElement(pillar.ganIdx), isYangStem(pillar.ganIdx)),
  };
}

export function buildSajuFacts(
  birth: BirthMoment & { gender: Gender },
  now = new Date()
): SajuFacts {
  const chart = computeSaju(birth);
  const balance = countElements(chart);
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);

  const tenGods = collectTenGods(chart);
  const counts = new Map<string, number>();
  for (const fact of tenGods) counts.set(fact.tenGod, (counts.get(fact.tenGod) ?? 0) + 1);
  const dominantTenGods = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);

  const ageNow = now.getFullYear() - birth.year + 1; // 세는나이 — 대운 표기 관행
  const luck = currentLuckPillars(now);

  const notes = [...chart.moment.notes];
  if (chart.hour === null) notes.push("시주 미상이라 시간대 관련 해석은 근거가 약하다");
  notes.push("절기는 태양 황경으로 계산 (오차 15분 이내)");

  return {
    fourPillars: {
      year: { stem: chart.year.gan, branch: chart.year.ji },
      month: { stem: chart.month.gan, branch: chart.month.ji },
      day: { stem: chart.day.gan, branch: chart.day.ji },
      hour: chart.hour ? { stem: chart.hour.gan, branch: chart.hour.ji } : null,
    },
    dayMaster: `${chart.day.gan}${dayElement}`,
    dayMasterElement: dayElement,
    elementBalance: balance,
    missingElements: ELEMENTS.filter((e) => balance[e] === 0),
    strength: judgeStrength(chart, balance),
    tenGods,
    dominantTenGods,
    notableRelations: findRelations(chart),
    shinsal: findShinsal(chart),
    luckContext: {
      majorLuck: computeMajorLuck(chart, birth.gender, ageNow),
      yearly: {
        year: luck.sajuYear,
        pillar: pillarLabel(luck.year),
        tenGod: tenGodOf(dayElement, dayYang, stemElement(luck.year.ganIdx), isYangStem(luck.year.ganIdx)),
      },
      monthly: {
        month: now.getMonth() + 1,
        pillar: pillarLabel(luck.month),
        tenGod: tenGodOf(dayElement, dayYang, stemElement(luck.month.ganIdx), isYangStem(luck.month.ganIdx)),
      },
    },
    calculationNotes: notes,
  };
}

/** AI 프롬프트에 실어 보낼 요약 문자열 (사람이 읽어도 이해되는 형태) */
export function factsSummary(facts: SajuFacts): string {
  const fp = facts.fourPillars;
  const balance = ELEMENTS.map((e) => `${e} ${facts.elementBalance[e]}`).join(", ");
  const lines = [
    `사주: 연 ${fp.year.stem}${fp.year.branch} / 월 ${fp.month.stem}${fp.month.branch} / 일 ${fp.day.stem}${fp.day.branch} / 시 ${fp.hour ? `${fp.hour.stem}${fp.hour.branch}` : "미상"}`,
    `일간: ${facts.dayMaster} (${facts.dayMasterElement})`,
    `오행 분포: ${balance}${facts.missingElements.length ? ` / 없는 오행: ${facts.missingElements.join(", ")}` : ""}`,
    `강약: ${facts.strength.label} (${facts.strength.score}점) — ${facts.strength.reasonCodes.join("; ")}`,
    `십성: ${facts.tenGods.map((t) => `${t.position} ${t.character}=${t.tenGod}`).join(", ")}`,
    `두드러진 십성: ${facts.dominantTenGods.join(", ")}`,
    facts.notableRelations.length
      ? `합충: ${facts.notableRelations.map((r) => r.label).join(", ")}`
      : "합충: 두드러진 관계 없음",
    facts.shinsal.length
      ? `신살: ${facts.shinsal.map((item) => `${item.name}(${item.positions.join("·")})`).join(", ")}`
      : "신살: 두드러진 신살 없음",
  ];
  const luck = facts.luckContext;
  if (luck.majorLuck) {
    lines.push(
      `대운: ${luck.majorLuck.currentPillar} (${luck.majorLuck.currentRange}, ${luck.majorLuck.direction}, 십성 ${luck.majorLuck.currentTenGod})`
    );
  } else {
    lines.push("대운: 아직 첫 대운 전");
  }
  lines.push(`세운: ${luck.yearly.year}년 ${luck.yearly.pillar} (십성 ${luck.yearly.tenGod})`);
  lines.push(`월운: ${luck.monthly.month}월 ${luck.monthly.pillar} (십성 ${luck.monthly.tenGod})`);
  lines.push(`계산 노트: ${facts.calculationNotes.join(" / ")}`);
  return lines.join("\n");
}
