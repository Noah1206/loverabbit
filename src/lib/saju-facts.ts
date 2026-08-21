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
  yearPillarOf,
  type Ohaeng,
  type Pillar,
  type SajuChart,
} from "./saju";
import type { BirthMoment } from "./korea-time";
import { nextMonthTerm, previousMonthTerm } from "./solar-terms";
import { findShinsal, type ShinsalFact } from "./saju-shinsal";
import { branchIsYang, calculationPolicyStamp, type CalculationPolicyStamp } from "@/lib/myeongri/policy";
import {
  completeXing,
  findXing,
  findXingWithLuck,
  type BranchSlot,
  type XingRelation,
} from "@/lib/myeongri/xing";
import { buildRelationBundles, type RelationBundle } from "@/lib/myeongri/relation-bundle";
import { hiddenStemsOf, stemElementOf } from "@/lib/myeongri/hidden-stems";
import { strengthEvidence, type StrengthEvidence } from "@/lib/myeongri/rooting";
import { strengthPolicyEvidence, type StrengthPolicyEvidence } from "@/lib/myeongri/strength-policy";
import { johuEvidence, type JohuEvidence } from "@/lib/myeongri/johu";
import { buildAdvancedFacts, type AdvancedMyeongriFacts } from "@/lib/myeongri/advanced-facts";

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
  /**
   * 그 글자들이 앉은 자리 — 연간/월간/일간/시간, 연지/월지/일지/시지.
   * 형(刑)은 처음부터 자리를 들고 있었는데 합·충은 없어서, 모델이 "축미충"을
   * 받아도 그것이 어느 자리인지 몰라 문장으로 옮기지 못했다. 근거 칸만 채우고
   * 본문에는 한 번도 못 쓰인 칩이 감사에서 두 건 나왔다.
   */
  pillarPositions: string[];
}

/**
 * 앞으로의 흐름.
 *
 * 감사에서 나온 문제: 목차는 "앞으로 6개월", "다음 기회가 또 오는지"를 팔고 있는데
 * luckContext 에는 이번 달 하나뿐이었다. 모델은 없는 달을 지어내지 않는 쪽을 골랐고
 * (그건 옳다), 그 결과 시기를 묻는 절 27곳이 전부 같은 달로 끝났다.
 * 데이터가 없어서 생긴 일은 프롬프트로 고칠 수 없다.
 *
 * 달의 경계는 달력이 아니라 절기다. 8월 7일 입추부터 9월 7일 백로까지가 신월이다.
 */
export interface UpcomingLuck {
  months: Array<{
    /** 그 절기월의 한가운데가 놓인 달력 연·월 — 사람에게 "9월"이라고 말할 때 쓰는 값 */
    year: number;
    month: number;
    pillar: { stem: string; branch: string };
    tenGod: string;
    /** 절입 시각 (ISO). 이 달이 실제로 시작하는 지점이다 */
    start: string;
    end: string;
  }>;
  nextYear: {
    year: number;
    pillar: { stem: string; branch: string };
    tenGod: string;
  } | null;
}

export interface MajorLuck {
  direction: "순행" | "역행";
  startAge: number;
  currentPillar: string;
  currentRange: string;
  currentTenGod: string;
}

export interface SajuFacts {
  /** 남녀에 따라 십성의 의미가 갈린다 — 여자는 관성, 남자는 재성이 배우자성 */
  gender: Gender;
  fourPillars: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string } | null;
  };
  dayMaster: string; // 예: "무토"
  dayMasterElement: Ohaeng;
  elementBalance: ElementBalance;
  /** 천간·지지 본기에 드러나지 않은 오행. 지장간에 숨어 있을 수는 있다. */
  missingElements: Ohaeng[];
  /**
   * 지장간에만 있고 겉으로는 안 드러난 오행 — 암장(暗藏).
   *
   * missingElements 를 그냥 "없다"로 읽으면 절반이 틀린다. 기준 케이스의 상대는
   * 화·수가 둘 다 0으로 나오지만, 지장간을 열면 화는 미·술에 들어 있고 수는 없다.
   * 하나는 숨은 것이고 하나는 진짜 없는 것인데, 같은 말로 부르면 같은 해석이 나간다.
   */
  hiddenOnlyElements: Ohaeng[];
  /** 지장간까지 열어도 없는 오행 — 전무(全無). 여기부터가 진짜 "없다"이다. */
  absentElements: Ohaeng[];
  strength: StrengthFact;
  tenGods: TenGodFact[];
  dominantTenGods: string[];
  notableRelations: RelationFact[];
  /**
   * 같은 글자 묶음에 걸린 합·충·형을 하나로 모은 것.
   *
   * notableRelations 와 xing 을 각각 따로 보내면 사신합과 사신형이 두 개의
   * 독립된 구조처럼 읽힌다 — 실제로는 같은 두 글자다. 해석에 나가는 것은
   * 이쪽이고, 위의 두 벌은 계산 사실로 남는다.
   */
  relationBundles: RelationBundle[];
  /** 도화·역마·화개·홍염·양인·원진 — 상품 목차가 약속한 값이라 계산으로 낸다 */
  shinsal: ShinsalFact[];
  /** 본명식의 형(刑). 늘 있는 것이다. */
  xing: XingRelation[];
  /**
   * 운이 들어와 성립하는 형. 지나가는 것이라 본명식의 형과 나눠 둔다.
   * 시기를 짚을 때 쓴다 — "지금 구간에 이 자리가 흔들린다" 는 여기서만 나온다.
   */
  xingLuck: XingRelation[];
  /** 통근·투간 증거. 점수는 붙이지 않는다 — 가중치는 정책이 정할 일이다. */
  strengthEvidence: StrengthEvidence;
  /**
   * 확장된 강약 증거 — 왕상휴수사·설기·통근·인성과다.
   *
   * **strength.label 을 바꾸지 않는다.** proposedLabel 을 나란히 낼 뿐이다.
   * 강약은 기능이 아니라 해석 정책이라, 가중치를 정하지 않은 채 기본 결론을 갈아 끼우면
   * 이미 리딩을 받은 사람들의 결과가 소급해서 달라진다(myeongri-policy/strength-v1.json).
   */
  strengthPolicy: StrengthPolicyEvidence;
  /**
   * 조후 — 계절이 무엇을 필요로 하는가. 계산 artifact 다.
   * exposable 이 false 면 프롬프트에 실리지 않는다(myeongri-policy/johu-v1.json).
   */
  johu: JohuEvidence;
  /**
   * 조후·격국·용신 — 고급 해석 층.
   *
   * ADVANCED_MYEONGRI_MODE 가 evidence_only(기본값)인 동안 이 값은 계산·감사·관리
   * 화면에만 쓰인다. 사용자 리포트의 결론도 strength.label 도 바꾸지 않는다.
   * 여기서 나오는 어떤 값도 위층(P0/P1)의 판단을 덮지 못한다 — 얹혀 있을 뿐이다.
   */
  advanced: AdvancedMyeongriFacts;
  /** 어느 정책으로 뽑은 값인지. 나중에 결과를 재현할 때 기준이 된다. */
  policy: CalculationPolicyStamp;
  luckContext: {
    majorLuck: MajorLuck | null;
    yearly: { year: number; pillar: string; tenGod: string };
    monthly: { month: number; pillar: string; tenGod: string };
    /**
     * 앞으로의 달과 다음 해. 목차가 "앞으로 6개월"을 약속했는데 이것이 비어 있으면
     * 그 절은 약속을 지킬 수 없다 — reading-guard 가 그 어긋남을 막는다.
     */
    upcoming: UpcomingLuck;
  };
  calculationNotes: string[];
}

const ELEMENTS: Ohaeng[] = ["목", "화", "토", "금", "수"];

// 오행 상생: 목->화->토->금->수->목
export const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
// 오행 상극: 목->토->수->화->금->목
export const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

function isYangStem(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

/**
 * 지지의 음양 — 판정은 정책 모듈이 한다(myeongri/policy.ts).
 *
 * 체(體)로 볼 것인가 지장간 본기로 볼 것인가는 유파가 갈리는 선택이고,
 * 그런 선택을 계산 파일 안에 흩어 두면 나중에 어디를 바꿔야 하는지 알 수 없게 된다.
 * 십성을 매길 때만 쓴다 — 지지의 오행, 합·충·형, 삼합은 지지 그 자체로 본다.
 */
function isYangBranch(jiIdx: number): boolean {
  return branchIsYang(jiIdx);
}

/**
 * 십성 — 일간을 기준으로 다른 글자가 어떤 관계에 놓이는가.
 * 오행 관계(같음/생/극)와 음양의 같고 다름으로 열 가지가 갈린다.
 *
 * threads-inputs.ts 가 "오늘 일진이 이 일간에게 무슨 십성인가"를 재느라 밖에서 부른다.
 * 명식 하나를 통째로 만들지 않고도 확정되는 몇 안 되는 값이라, 그쪽에서 이 함수가 없으면
 * 같은 계산을 다시 쓰게 된다.
 */
export function tenGodOf(dayElement: Ohaeng, dayYang: boolean, targetElement: Ohaeng, targetYang: boolean): string {
  const sameYinYang = dayYang === targetYang;
  if (targetElement === dayElement) return sameYinYang ? "비견" : "겁재";
  if (GENERATES[dayElement] === targetElement) return sameYinYang ? "식신" : "상관";
  if (CONTROLS[dayElement] === targetElement) return sameYinYang ? "편재" : "정재";
  if (CONTROLS[targetElement] === dayElement) return sameYinYang ? "편관" : "정관";
  if (GENERATES[targetElement] === dayElement) return sameYinYang ? "편인" : "정인";
  return "비견";
}

export function stemElement(ganIdx: number): Ohaeng {
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

export const HEAVENLY_COMBOS: [number, number, string][] = [
  [0, 5, "갑기합토"],
  [1, 6, "을경합금"],
  [2, 7, "병신합수"],
  [3, 8, "정임합목"],
  [4, 9, "무계합화"],
];

export const BRANCH_CLASHES: [number, number][] = [
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
];

export const BRANCH_SIX_COMBOS: [number, number][] = [
  [0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7],
];

export const BRANCH_TRIPLES: [number[], string][] = [
  [[8, 0, 4], "신자진 수국"],
  [[11, 3, 7], "해묘미 목국"],
  [[2, 6, 10], "인오술 화국"],
  [[5, 9, 1], "사유축 금국"],
];

function findRelations(chart: SajuChart): RelationFact[] {
  // 자리를 잃지 않으려면 filter(Boolean) 뒤의 색인이 아니라 기둥 이름을 들고 다녀야 한다.
  const slots = [
    { stemPos: "연간", branchPos: "연지", pillar: chart.year },
    { stemPos: "월간", branchPos: "월지", pillar: chart.month },
    { stemPos: "일간", branchPos: "일지", pillar: chart.day },
    { stemPos: "시간", branchPos: "시지", pillar: chart.hour },
  ].filter((slot) => slot.pillar) as { stemPos: string; branchPos: string; pillar: Pillar }[];

  const stems = slots.map((slot) => slot.pillar.ganIdx);
  const branches = slots.map((slot) => slot.pillar.jiIdx);
  const stemsAt = (...idx: number[]) =>
    slots.filter((slot) => idx.includes(slot.pillar.ganIdx)).map((slot) => slot.stemPos);
  const branchesAt = (...idx: number[]) =>
    slots.filter((slot) => idx.includes(slot.pillar.jiIdx)).map((slot) => slot.branchPos);

  const relations: RelationFact[] = [];

  for (const [a, b, label] of HEAVENLY_COMBOS) {
    if (stems.includes(a) && stems.includes(b)) {
      relations.push({
        kind: "천간합",
        members: [CHEONGAN[a], CHEONGAN[b]],
        label,
        pillarPositions: stemsAt(a, b),
      });
    }
  }
  for (const [a, b] of BRANCH_CLASHES) {
    if (branches.includes(a) && branches.includes(b)) {
      relations.push({
        kind: "지지충",
        members: [JIJI[a], JIJI[b]],
        label: `${JIJI[a]}${JIJI[b]}충`,
        pillarPositions: branchesAt(a, b),
      });
    }
  }
  for (const [a, b] of BRANCH_SIX_COMBOS) {
    if (branches.includes(a) && branches.includes(b)) {
      relations.push({
        kind: "지지육합",
        members: [JIJI[a], JIJI[b]],
        label: `${JIJI[a]}${JIJI[b]}합`,
        pillarPositions: branchesAt(a, b),
      });
    }
  }
  for (const [members, label] of BRANCH_TRIPLES) {
    const hit = members.filter((m) => branches.includes(m));
    if (hit.length === 3) {
      relations.push({
        kind: "삼합",
        members: hit.map((m) => JIJI[m]),
        label,
        pillarPositions: branchesAt(...hit),
      });
    }
  }
  return relations;
}

/** 형을 볼 때 쓰는 지지 자리 목록 — 시각을 모르면 시지는 없다 */
function branchSlotsOf(chart: SajuChart): BranchSlot[] {
  const slots: BranchSlot[] = [
    { position: "연지", jiIdx: chart.year.jiIdx },
    { position: "월지", jiIdx: chart.month.jiIdx },
    { position: "일지", jiIdx: chart.day.jiIdx },
  ];
  if (chart.hour) slots.push({ position: "시지", jiIdx: chart.hour.jiIdx });
  return slots;
}

/**
 * 대운·세운·월운의 지지. 형을 볼 때 본명식 지지와 함께 넣는다.
 * 대운은 기둥 문자열에서 지지 한 글자를 다시 꺼내야 해서 색인으로 되돌린다.
 */
function luckSlotsOf(
  chart: SajuChart,
  gender: Gender,
  ageNow: number,
  luck: { year: Pillar; month: Pillar }
): BranchSlot[] {
  const slots: BranchSlot[] = [
    { position: "세운", jiIdx: luck.year.jiIdx },
    { position: "월운", jiIdx: luck.month.jiIdx },
  ];
  const major = computeMajorLuck(chart, gender, ageNow);
  if (major) {
    // currentPillar 는 "병자" 처럼 천간+지지 두 글자다. 뒷 글자가 지지다.
    const ji = JIJI.indexOf(major.currentPillar.slice(1) as (typeof JIJI)[number]);
    if (ji >= 0) slots.push({ position: "대운", jiIdx: ji });
  }
  return slots;
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

/**
 * 지금 달 다음부터 count 개월. 경계는 절기로 걷는다.
 *
 * 달력 달로 걸으면 절입 전후 며칠이 통째로 어긋난다 — 9월 3일은 달력으로 9월이지만
 * 사주로는 아직 신월(8월)이다. 그 며칠에 "9월에는" 이라고 말하면 틀린 달을 짚는다.
 */
function upcomingMonths(
  chart: SajuChart,
  now: Date,
  count: number
): UpcomingLuck["months"] {
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);
  const out: UpcomingLuck["months"] = [];

  let start = previousMonthTerm(now.getTime()).utcMs;
  for (let i = 0; i < count; i += 1) {
    // 절입 시각에서 한 시간 뒤를 물어야 "지금 달"이 아니라 "다음 절입"이 나온다.
    const boundary = nextMonthTerm(start + 3600_000);
    const mid = (start + boundary.utcMs) / 2;
    const at = new Date(mid);
    const luck = currentLuckPillars(at);
    out.push({
      year: at.getFullYear(),
      month: at.getMonth() + 1,
      pillar: { stem: luck.month.gan, branch: luck.month.ji },
      tenGod: tenGodOf(dayElement, dayYang, stemElement(luck.month.ganIdx), isYangStem(luck.month.ganIdx)),
      start: new Date(start).toISOString(),
      end: new Date(boundary.utcMs).toISOString(),
    });
    start = boundary.utcMs;
  }
  // 첫 칸은 지금 달이다. 앞으로를 묻는 자리에는 그 다음부터가 필요하다.
  return out.slice(1);
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

  // 지지 속에 숨은 오행 — 겉으로 안 드러난 것과 아예 없는 것을 가르는 데 쓴다.
  const hiddenElements = new Set<Ohaeng>(
    [chart.year, chart.month, chart.day, chart.hour]
      .filter(Boolean)
      .flatMap((pillar) => hiddenStemsOf(pillar!.jiIdx).map((h) => stemElementOf(h.stem)))
  );

  const relations = findRelations(chart);
  const natalXing = findXing(branchSlotsOf(chart));

  const notes = [...chart.moment.notes];
  if (chart.hour === null) notes.push("시주 미상이라 시간대 관련 해석은 근거가 약하다");
  notes.push("절기는 태양 황경으로 계산 (오차 15분 이내)");

  return {
    gender: birth.gender,
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
    hiddenOnlyElements: ELEMENTS.filter((e) => balance[e] === 0 && hiddenElements.has(e)),
    absentElements: ELEMENTS.filter((e) => balance[e] === 0 && !hiddenElements.has(e)),
    strength: judgeStrength(chart, balance),
    tenGods,
    dominantTenGods,
    notableRelations: relations,
    // 부분 성립을 실질로 볼지는 XING_PARTIAL_POLICY 가 정한다. 번들에는 그 정책을
    // 통과한 것만 넣는다 — 규칙(matches)이 보는 것과 같은 집합이어야 한다.
    relationBundles: buildRelationBundles(relations, completeXing(natalXing)),
    shinsal: findShinsal(chart),
    xing: natalXing,
    xingLuck: findXingWithLuck(branchSlotsOf(chart), luckSlotsOf(chart, birth.gender, ageNow, luck)),
    strengthEvidence: strengthEvidence(chart),
    strengthPolicy: strengthPolicyEvidence(chart),
    johu: johuEvidence(chart, judgeStrength(chart, balance).label),
    advanced: buildAdvancedFacts(chart, judgeStrength(chart, balance).label),
    policy: calculationPolicyStamp(),
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
      upcoming: {
        // 6개월을 약속하는 목차가 있으므로 6개월을 낸다. 지금 달을 빼고 세려면 7칸을 걸어야 한다.
        months: upcomingMonths(chart, now, 7),
        nextYear: (() => {
          const next = yearPillarOf(luck.sajuYear + 1);
          return {
            year: luck.sajuYear + 1,
            pillar: { stem: next.gan, branch: next.ji },
            tenGod: tenGodOf(dayElement, dayYang, stemElement(next.ganIdx), isYangStem(next.ganIdx)),
          };
        })(),
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
