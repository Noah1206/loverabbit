// 조후(調候) — 계절이 무엇을 필요로 하는가.
//
// 이 저장소에는 용신도 격국도 조후도 억부도 없었다. grep 으로 확인된 사실이다.
// 해석 축이 억부 하나뿐이면 축이 둘일 때만 보이는 것은 영원히 안 보인다.
//
// 기준 명식이 그 예다. 축월 을목 — 한겨울의 언 나무다. 2026년 병오년, 8월 병신월로
// 병화가 둘 들어온다. 억부로 보면 화는 식상, 일간을 빼내는 자리다. 조후로 보면
// 화는 얼어 있던 것을 녹이는 자리다. 같은 글자가 정반대로 읽힌다.
//
// 지금 시스템은 이것을 상관 마찰 하나로만 읽었다. 틀렸다기보다, **다른 쪽을 볼 눈이
// 없었다.** 그래서 리포트 전체에 부정 프레임이 씌워졌다.
//
// 다만 이 파일은 아직 사용자에게 나가지 않는다. 조후용신 표(일간×월지 120칸)의
// 출처를 확정하지 않은 채로 결론을 바꾸면, 감사에서 지적한 것과 똑같은 불투명한
// 엔진을 하나 더 만드는 일이 된다. 여기 있는 것은 계절의 한난조습까지다.

import { JIJI_OHAENG, type Ohaeng, type SajuChart } from "../saju";
import POLICY from "../myeongri-policy/johu-v1.json";

const CHEONGAN_ELEMENT: Ohaeng[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

export type Climate = "cold" | "hot" | "dry" | "wet" | "balanced";

export interface JohuEvidence {
  monthBranch: string;
  climate: Climate;
  seasonalNeed: Array<{
    element: Ohaeng;
    role: string;
    sourceId: string;
    sourceLocation: string;
    /** 그 오행이 명식에 있는가 — 없으면 운에서 와야 한다 */
    presentInChart: boolean;
  }>;
  appliedPolicyVersion: string;
  /**
   * 억부와 반대 방향을 가리키는가.
   *
   * 조후가 필요하다고 한 오행이 일간을 빼거나 누르는 자리이고, 그런데 일간이
   * 약할 때 참이 된다. 이때 둘 중 하나를 숨기면 그 리포트는 한쪽 눈으로 쓴 것이 된다.
   */
  conflictsWithStrength: boolean;
  conflictResolution?: string;
  /** 사용자 리포트에 나가도 되는가. 승인 전에는 언제나 false */
  exposable: boolean;
}

/**
 * 조후와 억부가 부딪힐 때 어느 쪽을 먼저 보는가.
 *
 * "off"                  조후를 계산만 하고 어디에도 노출하지 않는다. **기본값.**
 * "eokbu_first"          억부를 먼저 본다. 지금 시스템이 사실상 하던 것 —
 *                        다만 명시된 적이 없어 충돌이 있다는 것조차 몰랐다.
 * "johu_first_in_extreme" 겨울(해자축)·여름(사오미) 생에 한해 조후를 먼저 본다. 통설.
 *
 * 어느 쪽이든 켜려면 johu-v1.json 의 status 가 approved 여야 한다.
 * 정책만 켜고 표를 승인하지 않으면 출처 없는 결론이 사용자에게 간다.
 */
export type JohuPriorityPolicy = "off" | "eokbu_first" | "johu_first_in_extreme";

export const DEFAULT_JOHU_PRIORITY: JohuPriorityPolicy = "off";

export function johuPriorityPolicy(): JohuPriorityPolicy {
  const raw = process.env.JOOHU_PRIORITY_POLICY;
  if (raw === "off" || raw === "eokbu_first" || raw === "johu_first_in_extreme") return raw;
  if (raw) {
    console.warn(
      `JOOHU_PRIORITY_POLICY="${raw}" 는 알 수 없는 값입니다. ` +
        `off | eokbu_first | johu_first_in_extreme 중 하나여야 합니다. ` +
        `기본값 "${DEFAULT_JOHU_PRIORITY}" 로 진행합니다.`
    );
  }
  return DEFAULT_JOHU_PRIORITY;
}

/** 표가 승인됐는가. 승인 전에는 어떤 정책값이 와도 사용자에게 나가지 않는다. */
export function johuApproved(): boolean {
  return POLICY.status === "approved";
}

export function johuEvidence(
  chart: SajuChart,
  strengthLabel: "신강" | "중화" | "신약"
): JohuEvidence {
  const monthBranch = chart.month.ji;
  const climate = ((POLICY.climateOfMonthBranch as Record<string, Climate>)[monthBranch] ??
    "balanced") as Climate;
  const dayElement = CHEONGAN_ELEMENT[chart.day.ganIdx];

  const present = new Set<Ohaeng>();
  for (const pillar of [chart.year, chart.month, chart.day, chart.hour]) {
    if (!pillar) continue;
    present.add(CHEONGAN_ELEMENT[pillar.ganIdx]);
    present.add(JIJI_OHAENG[pillar.jiIdx] as Ohaeng);
  }

  const needs = (POLICY.seasonalNeed as Record<string, { element: Ohaeng; role: string; sourceId: string }[]>)[
    climate
  ] ?? [];
  const seasonalNeed = needs.map((need) => ({
    ...need,
    sourceLocation: POLICY.sourceLocation,
    presentInChart: present.has(need.element),
  }));

  // 조후가 부르는 것이 억부가 밀어내는 것인가.
  const drains = (element: Ohaeng) =>
    GENERATES[dayElement] === element || CONTROLS[dayElement] === element || CONTROLS[element] === dayElement;
  const conflictsWithStrength =
    strengthLabel === "신약" && seasonalNeed.some((need) => drains(need.element));

  const policy = johuPriorityPolicy();
  const extreme = (POLICY.conflictWithStrength.extremeSeasonBranches as string[]).includes(monthBranch);

  let conflictResolution: string | undefined;
  if (conflictsWithStrength) {
    if (policy === "johu_first_in_extreme" && extreme) {
      conflictResolution =
        `조후 우선 — ${monthBranch}월은 한난이 극에 있는 자리라, ` +
        `일간을 빼내는 것이라도 계절이 먼저 필요로 하는 것으로 읽는다`;
    } else if (policy === "eokbu_first") {
      conflictResolution = "억부 우선 — 일간이 약하므로 빼내는 것을 부담으로 읽는다";
    } else {
      conflictResolution =
        "우선순위 미정 — 조후와 억부가 반대를 가리키는데 어느 쪽을 먼저 볼지 정해지지 않았다";
    }
  }

  return {
    monthBranch,
    climate,
    seasonalNeed,
    appliedPolicyVersion: POLICY.policyVersion,
    conflictsWithStrength,
    conflictResolution,
    // 표가 승인되고 우선순위가 정해져야 비로소 사용자에게 나갈 수 있다.
    exposable: johuApproved() && policy !== "off",
  };
}

export const JOHU_POLICY_STATUS = POLICY.status;
export const JOHU_POLICY_VERSION = POLICY.policyVersion;
export const JOHU_OPEN_QUESTIONS = POLICY.openQuestions;
