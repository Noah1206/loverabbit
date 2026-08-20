// 대운·세운 해석 후보 플래그 — 계산이 아니라 **해석층으로 넘기는 입력**이다.
//
// 십성 자체는 성별과 무관하게 계산한다. 성별로 갈리는 것은 그 십성을 관계 맥락에서
// 어떻게 읽느냐뿐이고, 그 갈림은 여기서만 일어난다. 코어 계산값을 성별로 바꾸면
// 같은 명식이 성별에 따라 다른 사실을 갖게 되어 되돌릴 수 없다.
//
// 지금 관성·재성에는 성별 분기가 있는데(reading-rules.ts의 LUCK-GWAN/JAE-*)
// 식상에는 없다. 여자 사주에서 관성은 남편이고 상관이 그 관성을 극하므로
// (상관견관), 여자 명식의 상관운은 관계 사안으로 읽는 시각이 있다.
//
// 다만 **"여자 + 상관 대운"만으로 관계 위험을 말하지 않는다.** 상관과 관성이
// 실제로 함께 있고 부딪히는지를 구조로 확인한 뒤에야 후보로 올린다.
// 그리고 후보는 후보일 뿐, 문구를 고르는 것은 검수된 템플릿의 몫이다.

import type { SajuFacts } from "@/lib/saju-facts";
import { CALCULATION_POLICY_VERSION } from "@/lib/myeongri/policy";

/** 사용자가 입력한 성별. 추론하지 않는다 — 없으면 없는 대로 둔다. */
export type SexAtBirth = "female" | "male" | "unspecified";

export type LuckInterpretationFlag =
  | "shangguan_luck"
  | "shangguan_jian_guan_candidate"
  | "female_shangguan_relationship_policy_candidate";

export interface LuckInterpretationEvidence {
  flag: LuckInterpretationFlag;
  /** 이 플래그가 왜 켜졌는지 — 계산에서 온 근거만 적는다 */
  triggeredBy: string[];
  sexAtBirth: SexAtBirth;
  /** 사람이나 정책이 한 번 더 봐야 하는가 */
  requiresHumanOrPolicyReview: boolean;
  sourcePolicyId: string;
}

const POLICY_ID = "female-shangguan-relationship-v0";

/**
 * 여자 상관운 정책을 켤 것인가.
 *
 * **기본값은 2026-08-20 부터 켜짐이다.** 운영자의 지시로 정했다.
 *
 * 켠다고 문구가 저절로 생기지는 않는다. 플래그는 검수된 규칙을 고르는 입력일 뿐이고,
 * 실제로 나가는 말은 reading-rules.ts 의 LUCK-SANGGWAN-GYEONGWAN-F 하나뿐이다.
 * 그 규칙의 claim 과 forbidden 이 이 정책이 말할 수 있는 전부다.
 *
 * 되돌리려면 FEMALE_SHANGGUAN_POLICY=off 하나면 된다.
 */
export const DEFAULT_FEMALE_SHANGGUAN_POLICY = true;

export function femaleShangguanPolicyEnabled(): boolean {
  const raw = process.env.FEMALE_SHANGGUAN_POLICY;
  if (!raw) return DEFAULT_FEMALE_SHANGGUAN_POLICY;
  if (raw === "on") return true;
  if (raw === "off") return false;
  console.warn(
    `FEMALE_SHANGGUAN_POLICY="${raw}" 는 알 수 없는 값입니다. on | off 중 하나여야 합니다. ` +
      `기본값 "${DEFAULT_FEMALE_SHANGGUAN_POLICY ? "on" : "off"}" 로 진행합니다.`
  );
  return DEFAULT_FEMALE_SHANGGUAN_POLICY;
}

const GWAN = ["정관", "편관"];

function positionsWith(facts: SajuFacts, tenGods: string[]): string[] {
  return facts.tenGods.filter((t) => tenGods.includes(t.tenGod)).map((t) => t.position);
}

/**
 * 대운·세운·월운에서 상관이 들어오는지, 그리고 그 상관이 부딪힐 관성이
 * 명식에 실제로 있는지를 구조로 확인해 후보 플래그를 낸다.
 *
 * @param sexAtBirth 사용자가 명시적으로 입력한 값만. 미입력이면 "unspecified".
 */
export function luckInterpretationFlags(
  facts: SajuFacts,
  sexAtBirth: SexAtBirth
): LuckInterpretationEvidence[] {
  const out: LuckInterpretationEvidence[] = [];
  const luck = facts.luckContext;

  const shangguanAt: string[] = [];
  if (luck.majorLuck?.currentTenGod === "상관") shangguanAt.push(`대운=${luck.majorLuck.currentPillar}`);
  if (luck.yearly.tenGod === "상관") shangguanAt.push(`세운=${luck.yearly.year}년 ${luck.yearly.pillar}`);
  if (luck.monthly.tenGod === "상관") shangguanAt.push(`월운=${luck.monthly.month}월 ${luck.monthly.pillar}`);
  if (shangguanAt.length === 0) return out;

  // 1) 상관운이 들어왔다 — 성별과 무관한 사실
  out.push({
    flag: "shangguan_luck",
    triggeredBy: shangguanAt,
    sexAtBirth,
    requiresHumanOrPolicyReview: false,
    sourcePolicyId: POLICY_ID,
  });

  // 2) 상관견관 후보 — 부딪힐 관성이 명식에 실제로 있어야 한다
  const gwanPositions = positionsWith(facts, GWAN);
  if (gwanPositions.length === 0) return out;
  out.push({
    flag: "shangguan_jian_guan_candidate",
    triggeredBy: [...shangguanAt, `명식 관성=${gwanPositions.join(",")}`],
    sexAtBirth,
    requiresHumanOrPolicyReview: true,
    sourcePolicyId: POLICY_ID,
  });

  // 3) 여자 명식의 관계 해석 후보 — 성별을 명시했고 정책이 켜져 있을 때만
  if (sexAtBirth === "female" && femaleShangguanPolicyEnabled()) {
    out.push({
      flag: "female_shangguan_relationship_policy_candidate",
      triggeredBy: [...shangguanAt, `명식 관성=${gwanPositions.join(",")}`, "sexAtBirth=female"],
      // 여기서 나온 것을 그대로 문장으로 옮기면 안 된다. 검수된 템플릿을 골라야 한다.
      requiresHumanOrPolicyReview: true,
      sexAtBirth,
      sourcePolicyId: POLICY_ID,
    });
  }

  return out;
}

/** 저장·감사에 함께 남기는 표식 */
export const LUCK_FLAG_POLICY = {
  policyId: POLICY_ID,
  calculationPolicyVersion: CALCULATION_POLICY_VERSION,
} as const;
