// 귀인 지도 — 관계 축 계산 (guin-v2).
//
// 명리학의 객관적 사실을 주장하는 것이 아니라, 제품 안에서 일관되게 동작하는
// 재현 가능한 콘텐츠 알고리즘이다 (지시문 머리말). 그래서 결과에는 항상
// calculationVersion 이 붙고, 배합을 고치면 버전을 올린다 — 이미 만들어진
// 지도의 숫자를 소급해 바꾸지 않는다.
//
// 사주 자체는 리딩과 같은 계산기를 쓴다. computeSaju 가 자시(밤 11시 전후
// 날짜)·입춘 경계를 처리하고, 오행·상생·상극 표는 saju-facts.ts 에 있다 —
// 만세력을 중복 구현하지 않는다.
//
// guin-1(십성 역할)과의 차이: v2 는 일간 오행의 생극 관계에서 feature 를
// 뽑고, 그 feature 로 네 관계 축(편안함·현실적 도움·대화·새로운 자극)을
// 채점한다. 역할은 가장 높은 축이다. 케미는 네 축의 가중 평균이다.
//
// 방향은 항상 owner -> participant 다. 시간 미상이어도 감점하지 않는다 —
// 일간의 오행·음양은 날짜만으로 확정되므로 축 계산에 시간이 아예 안 들어간다.

import { CHEONGAN, computeSaju, type Ohaeng } from "@/lib/saju";
import { GENERATES, CONTROLS, stemElement } from "@/lib/saju-facts";
import {
  GUIN_AXES,
  GUIN_ROLES,
  scoreBandOf,
  type GuinAxes,
  type GuinAxisKey,
  type GuinBirthInput,
  type GuinRelationshipResult,
  type GuinRole,
} from "@/lib/guin-map";

export const GUIN_CALC_VERSION = "guin-v2";

// ── 오행 관계 → feature (지시문 8.2, 8.3) ─────────────────

export type ElementRelation =
  | "same"
  | "participant_generates_owner"
  | "owner_generates_participant"
  | "owner_controls_participant"
  | "participant_controls_owner";

export function getElementRelation(owner: Ohaeng, participant: Ohaeng): ElementRelation {
  if (owner === participant) return "same";
  if (GENERATES[participant] === owner) return "participant_generates_owner";
  if (GENERATES[owner] === participant) return "owner_generates_participant";
  if (CONTROLS[owner] === participant) return "owner_controls_participant";
  if (CONTROLS[participant] === owner) return "participant_controls_owner";
  // 오행 다섯 개 사이에는 위 다섯 관계뿐이다 — 여기 오면 표가 깨진 것이다.
  throw new Error(`오행 관계를 알 수 없음: ${owner} -> ${participant}`);
}

export interface RelationshipFeatures {
  elementRelation: ElementRelation;
  sameElement: number;
  supportToOwner: number;
  practicalComplement: number;
  tension: number;
  polarityHarmony: number;
  seasonalHarmony: number;
}

/** 지시문 8.3 의 feature 표 그대로. 숫자를 고치면 버전을 올려라. */
const FEATURE_TABLE: Record<
  ElementRelation,
  Pick<RelationshipFeatures, "sameElement" | "supportToOwner" | "practicalComplement" | "tension">
> = {
  same: { sameElement: 1.0, supportToOwner: 0.45, practicalComplement: 0.45, tension: 0.1 },
  participant_generates_owner: { sameElement: 0.25, supportToOwner: 1.0, practicalComplement: 0.65, tension: 0.1 },
  owner_generates_participant: { sameElement: 0.2, supportToOwner: 0.35, practicalComplement: 0.8, tension: 0.25 },
  owner_controls_participant: { sameElement: 0.1, supportToOwner: 0.25, practicalComplement: 0.9, tension: 0.75 },
  participant_controls_owner: { sameElement: 0.1, supportToOwner: 0.2, practicalComplement: 0.35, tension: 0.9 },
};

/** 계절 강도는 기존 엔진에서 아직 안 끌어온다 — 중립값 고정 (지시문 8.3). */
const NEUTRAL_SEASONAL = 0.6;

export function computeFeatures(params: {
  ownerElement: Ohaeng;
  participantElement: Ohaeng;
  /** 둘 다 알 때만 넘긴다. 없으면 중립 0.60. */
  polarity?: { ownerYang: boolean; participantYang: boolean };
}): RelationshipFeatures {
  const elementRelation = getElementRelation(params.ownerElement, params.participantElement);
  const polarityHarmony = params.polarity
    ? params.polarity.ownerYang === params.polarity.participantYang
      ? 0.7
      : 0.9
    : 0.6;
  return {
    elementRelation,
    ...FEATURE_TABLE[elementRelation],
    polarityHarmony,
    seasonalHarmony: NEUTRAL_SEASONAL,
  };
}

// ── 네 축 채점 (지시문 8.4) ───────────────────────────────

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreAxes(f: RelationshipFeatures): GuinAxes {
  const comfort = clamp100(
    100 * (0.4 * f.sameElement + 0.3 * f.supportToOwner + 0.15 * f.polarityHarmony + 0.15 * (1 - f.tension))
  );
  const practicalHelp = clamp100(
    100 * (0.4 * f.practicalComplement + 0.3 * f.supportToOwner + 0.15 * f.seasonalHarmony + 0.15 * (1 - f.tension * 0.5))
  );
  const communication = clamp100(
    100 * (0.3 * f.sameElement + 0.25 * f.polarityHarmony + 0.2 * f.supportToOwner + 0.25 * (1 - f.tension * 0.65))
  );
  const stimulation = clamp100(
    100 * (0.4 * f.practicalComplement + 0.3 * f.tension + 0.15 * (1 - f.sameElement) + 0.15 * (1 - f.polarityHarmony * 0.5))
  );
  return { comfort, practicalHelp, communication, stimulation };
}

// ── 역할 선택 (지시문 8.5) ────────────────────────────────

const AXIS_ROLE: Record<GuinAxisKey, GuinRole> = {
  comfort: "comforter",
  practicalHelp: "right_hand",
  communication: "communicator",
  stimulation: "growth_teacher",
};

export function chooseRole(axes: GuinAxes): {
  primaryRole: GuinRole;
  secondaryRole: GuinRole | null;
  primaryScore: number;
} {
  // GUIN_AXES 순서로 돌므로 동점이면 앞선 축이 이긴다 — 매번 같은 답이 나온다.
  const sorted = GUIN_AXES.map((key) => [key, axes[key]] as const).sort((a, b) => b[1] - a[1]);
  const [primaryKey, primaryScore] = sorted[0];
  const [secondaryKey, secondaryScore] = sorted[1];
  return {
    primaryRole: AXIS_ROLE[primaryKey],
    // 5점 미만 차이는 사실상 같은 크기다 — 억지로 하나만 고르지 않는다.
    secondaryRole: primaryScore - secondaryScore < 5 ? AXIS_ROLE[secondaryKey] : null,
    primaryScore,
  };
}

/** 케미 = 네 축의 가중 평균 (지시문 8.6) */
export function chemistryOf(axes: GuinAxes): number {
  return clamp100(
    axes.comfort * 0.3 + axes.practicalHelp * 0.25 + axes.communication * 0.25 + axes.stimulation * 0.2
  );
}

// ── 개인 캐릭터 ───────────────────────────────────────────

const ELEMENT_CHARACTER: Record<Ohaeng, string> = {
  목: "자라나는 나무",
  화: "번지는 불",
  토: "단단한 땅",
  금: "벼려진 쇠",
  수: "흐르는 물",
};

/** 지도 머리·공유 카드용. 생년월일은 돌려주지 않는다. */
export function personaOf(birth: GuinBirthInput): {
  elementLabel: string;
  animal: string;
  dayGan: string;
} {
  const chart = computeSaju({ year: birth.year, month: birth.month, day: birth.day, hour: birth.hour });
  return {
    elementLabel: ELEMENT_CHARACTER[stemElement(chart.day.ganIdx)],
    animal: chart.animal,
    dayGan: CHEONGAN[chart.day.ganIdx],
  };
}

// ── 관계 하나 (owner -> participant) ──────────────────────

export function relate(owner: GuinBirthInput, participant: GuinBirthInput): GuinRelationshipResult {
  // 일간의 오행·음양은 날짜만으로 확정된다. 시간은 축 계산에 안 들어간다 —
  // 시간 미상 사용자의 점수를 임의로 낮추지 않는다 (지시문 8.1).
  const ownerChart = computeSaju({ year: owner.year, month: owner.month, day: owner.day, hour: null });
  const participantChart = computeSaju({
    year: participant.year,
    month: participant.month,
    day: participant.day,
    hour: null,
  });

  const features = computeFeatures({
    ownerElement: stemElement(ownerChart.day.ganIdx),
    participantElement: stemElement(participantChart.day.ganIdx),
    polarity: {
      ownerYang: ownerChart.day.ganIdx % 2 === 0,
      participantYang: participantChart.day.ganIdx % 2 === 0,
    },
  });
  const axes = scoreAxes(features);
  const { primaryRole, secondaryRole } = chooseRole(axes);
  const score = chemistryOf(axes);
  const info = GUIN_ROLES[primaryRole];

  return {
    score,
    scoreBand: scoreBandOf(score),
    role: primaryRole,
    roleLabel: info.label,
    roleTagline: info.tagline,
    secondaryRole,
    secondaryRoleLabel: secondaryRole ? GUIN_ROLES[secondaryRole].label : null,
    axes,
    elementLabel: ELEMENT_CHARACTER[stemElement(participantChart.day.ganIdx)],
    strengths: info.strengths,
    cautions: info.cautions,
    conversationPrompt: info.conversationPrompt,
    facts: [],
    calculationVersion: GUIN_CALC_VERSION,
  };
}
