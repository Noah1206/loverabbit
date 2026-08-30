// 귀인 지도 — 두 사람의 관계 계산 (guin-1).
//
// 리딩과 같은 계산기를 쓴다. computeSaju 가 자시(밤 11시 전후 날짜)·입춘
// 경계를 이미 처리하고, 십성·합·충 표는 saju-facts.ts 에 있다. 여기서는 그
// 프리미티브를 조합만 한다 — 명리 규칙을 새로 쓰지 않는다.
//
// 삼주(연·월·일) 중심이다 (지시문 6항). 태어난 시간이 들어와도 관계 점수에는
// 넣지 않는다 — 한쪽만 시간을 알면 점수가 비대칭으로 기울고, "시간을 몰라서
// 점수가 낮다"는 인상을 만든다. 시간은 개인 캐릭터(personaOf)에만 쓴다.
//
// 방향이 있다: relate(mine, theirs) 는 "상대가 나에게 무엇인가"다.
// 지도에는 주인 기준(relate(주인, 참여자))을 싣는다.
//
// 점수는 서비스 내부 배합의 결과다. 배합을 고치면 GUIN_CALC_VERSION 을 올려
// 이미 만들어진 지도의 숫자를 소급해 바꾸지 않는다.

import {
  CHEONGAN,
  JIJI_OHAENG,
  computeSaju,
  type Ohaeng,
  type SajuChart,
} from "@/lib/saju";
import {
  BRANCH_CLASHES,
  BRANCH_SIX_COMBOS,
  BRANCH_TRIPLES,
  GENERATES,
  HEAVENLY_COMBOS,
  stemElement,
  tenGodOf,
} from "@/lib/saju-facts";
import {
  GUIN_ROLES,
  type GuinBirthInput,
  type GuinRelationshipResult,
  type GuinRole,
} from "@/lib/guin-map";

export const GUIN_CALC_VERSION = "guin-1";

/**
 * 십성 → 역할. 열 가지가 일곱 역할로 접힌다.
 * 부정적인 역할명은 없다 — 충이 있어도 역할은 그대로 두고 주의점에만 적는다.
 */
const TEN_GOD_ROLE: Record<string, GuinRole> = {
  정인: "benefactor",
  편인: "benefactor",
  정재: "right_hand",
  편재: "right_hand",
  정관: "growth_teacher",
  편관: "growth_teacher",
  비견: "mirror",
  겁재: "stimulator",
  상관: "stimulator",
  식신: "comforter",
};

/** 역할 기본치. 순위가 아니라 관계가 붙는 속도의 차이다 — 주의점이 균형을 잡는다. */
const ROLE_BASE: Record<GuinRole, number> = {
  benefactor: 15,
  right_hand: 12,
  comforter: 10,
  growth_teacher: 8,
  mirror: 8,
  stimulator: 5,
  neutral: 0,
};

/** 오행 캐릭터 — 점수보다 먼저 읽히는 말랑한 이름 (지시문 11항) */
const ELEMENT_CHARACTER: Record<Ohaeng, string> = {
  목: "자라나는 나무",
  화: "번지는 불",
  토: "단단한 땅",
  금: "벼려진 쇠",
  수: "흐르는 물",
};

function isYang(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

function pairIn(pairs: readonly (readonly [number, number])[], a: number, b: number): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function sharedTriple(a: number, b: number): string | null {
  if (a === b) return null; // 같은 글자는 삼합이 아니다
  for (const [members, label] of BRANCH_TRIPLES) {
    if (members.includes(a) && members.includes(b)) return label;
  }
  return null;
}

/** 개인 캐릭터 — 지도 머리와 공유 카드에 쓴다. 생년월일은 돌려주지 않는다. */
export function personaOf(birth: GuinBirthInput): {
  elementLabel: string;
  animal: string;
  dayGan: string;
} {
  const chart = computeSaju({ year: birth.year, month: birth.month, day: birth.day, hour: birth.hour });
  const element = stemElement(chart.day.ganIdx);
  return {
    elementLabel: ELEMENT_CHARACTER[element],
    animal: chart.animal,
    dayGan: CHEONGAN[chart.day.ganIdx],
  };
}

/**
 * 상대(theirs)가 나(mine)에게 어떤 인연인가.
 *
 * 역할: 상대 일간이 내 일간에게 무슨 십성인가.
 * 점수: 50 + 역할 기본치 + 관계 사실 가감. 5~99 로 자른다 — 0과 100 은
 * "확정"으로 읽히는 숫자라 만들지 않는다.
 */
export function relate(mine: GuinBirthInput, theirs: GuinBirthInput): GuinRelationshipResult {
  // 시간은 점수에 안 넣는다 (파일 머리말). null 로 눌러 삼주만 계산한다.
  const my = computeSaju({ year: mine.year, month: mine.month, day: mine.day, hour: null });
  const their = computeSaju({ year: theirs.year, month: theirs.month, day: theirs.day, hour: null });

  const myElement = stemElement(my.day.ganIdx);
  const theirElement = stemElement(their.day.ganIdx);
  const tenGod = tenGodOf(myElement, isYang(my.day.ganIdx), theirElement, isYang(their.day.ganIdx));
  const role: GuinRole = TEN_GOD_ROLE[tenGod] ?? "neutral";
  const info = GUIN_ROLES[role];

  let score = 50 + ROLE_BASE[role];
  const facts: string[] = [];
  const extraStrengths: string[] = [];
  const extraCautions: string[] = [];

  // 일간 천간합 — 처음부터 결이 붙는 조합
  if (pairIn(HEAVENLY_COMBOS.map(([a, b]) => [a, b] as const), my.day.ganIdx, their.day.ganIdx)) {
    score += 12;
    facts.push("일간 천간합");
    extraStrengths.push("처음부터 결이 잘 붙는 조합이에요");
  }

  // 일지 — 육합 > 삼합 > 충 순서로 하나만 본다. 같은 두 글자에 셋이 겹치지는
  // 않지만, 순서를 못박아 두면 표가 바뀌어도 결과가 흔들리지 않는다.
  if (pairIn(BRANCH_SIX_COMBOS, my.day.jiIdx, their.day.jiIdx)) {
    score += 10;
    facts.push("일지 육합");
    extraStrengths.push("일상의 리듬이 자연스럽게 맞는 편이에요");
  } else if (sharedTriple(my.day.jiIdx, their.day.jiIdx)) {
    score += 8;
    facts.push("일지 삼합");
    extraStrengths.push("같은 방향을 볼 때 힘이 배로 붙는 조합이에요");
  } else if (pairIn(BRANCH_CLASHES, my.day.jiIdx, their.day.jiIdx)) {
    score -= 12;
    facts.push("일지 충");
    extraCautions.push("생각이 정면으로 부딪히는 날이 있어요 — 부딪힌 다음 날 한 번 더 이야기하면 오히려 가까워져요");
  }

  // 연지 — 세대·바탕의 결. 일지보다 가볍게 반영한다.
  if (pairIn(BRANCH_SIX_COMBOS, my.year.jiIdx, their.year.jiIdx)) {
    score += 4;
    facts.push("연지 육합");
  } else if (pairIn(BRANCH_CLASHES, my.year.jiIdx, their.year.jiIdx)) {
    score -= 4;
    facts.push("연지 충");
  }

  // 오행 보완 — 상대의 삼주(간·지)가 내 일간을 생하는 기운을 몇 개나 갖고 있나.
  score += Math.min(6, complementCount(their, myElement) * 2);

  const clamped = Math.max(5, Math.min(99, score));

  return {
    score: clamped,
    role,
    roleLabel: info.label,
    roleTagline: info.tagline,
    elementLabel: ELEMENT_CHARACTER[theirElement],
    // 역할 문구 + 관계 사실 문구. 강점 2개·주의 1개 안으로 자른다 —
    // 지시문 3.4: 근거는 3문장 이하로 이해되게.
    strengths: [...extraStrengths, ...info.strengths].slice(0, 2),
    cautions: [...extraCautions, ...info.cautions].slice(0, 1),
    conversationPrompt: info.conversationPrompt,
    facts,
    calculationVersion: GUIN_CALC_VERSION,
  };
}

/** 상대 삼주에서 내 일간을 생하는 오행 글자 수 (간 3 + 지 3) */
function complementCount(their: SajuChart, myElement: Ohaeng): number {
  const feeds = (element: Ohaeng) => GENERATES[element] === myElement;
  let count = 0;
  for (const pillar of [their.year, their.month, their.day]) {
    if (feeds(stemElement(pillar.ganIdx))) count += 1;
    if (feeds(JIJI_OHAENG[pillar.jiIdx] as Ohaeng)) count += 1;
  }
  return count;
}
