// 강약 판정의 증거 — 확장판.
//
// 지금 운영되는 판정(saju-facts.ts judgeStrength)은 그대로 둔다. **이 파일은 라벨을
// 바꾸지 않는다.** 기본값은 꺼짐이고, 켜도 바뀌는 것은 evidence 뿐이다.
//
// 왜 이렇게 나누는가. 강약은 기능이 아니라 해석 정책이다. 축월 을목을 "중립"으로
// 볼지 "수(囚)"로 볼지, 일지 상관을 0점으로 볼지 -4로 볼지는 유파가 갈리는 자리고,
// 여기서 숫자를 바꾸면 이미 리딩을 받은 사람들의 결론이 소급해서 달라진다.
// 그래서 새 점수는 proposed 로만 낸다 — 나란히 놓고 비교할 수 있게.
//
// 가중치는 이 파일에 없다. myeongri-policy/strength-v1.json 에 출처와 함께 있다.

import { CHEONGAN, JIJI, JIJI_OHAENG, type Ohaeng, type SajuChart } from "@/lib/saju";
import { strengthEvidence as rootingEvidence } from "@/lib/myeongri/rooting";
import { hiddenStemsOf } from "@/lib/myeongri/hidden-stems";
import POLICY from "@/lib/myeongri-policy/strength-v1.json";

const GENERATES: Record<Ohaeng, Ohaeng> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };
const CHEONGAN_ELEMENT: Ohaeng[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];

export type SeasonalPhase = "왕" | "상" | "휴" | "수" | "사";

export interface ScoredEvidence {
  source: string;
  tenGod: string;
  scoreDelta: number;
  reason: string;
}

export interface StrengthPolicyEvidence {
  monthCommand: {
    branch: string;
    tenGodOfDayMaster: string;
    seasonalPhase: SeasonalPhase;
    scoreDelta: number;
    reason: string;
  };
  draining: ScoredEvidence[];
  controlling: ScoredEvidence[];
  rooting: Array<{
    branch: string;
    hiddenStemTier: "main" | "middle" | "residual";
    scoreDelta: number;
    /** 이 점수가 실제 판정에 들어갔는가 */
    applied: "applied" | "not_applied";
  }>;
  exposure: Array<{ stem: string; relation: string; scoreDelta: number }>;
  supportExcess: Array<{ type: string; threshold: number; triggered: boolean; reason: string }>;
  policyVersion: string;
  /** 이 표대로 매겼다면 나왔을 점수. 지금 판정을 대체하지 않는다. */
  proposedScore: number;
  proposedLabel: "신강" | "중화" | "신약";
  /** 지금 운영되는 라벨을 이 표가 바꿨는가. off 면 언제나 false */
  appliedToLabel: boolean;
}

/**
 * 확장된 강약 정책을 쓸 것인가.
 *
 * "off"      증거만 낸다. 라벨은 지금 판정 그대로. **기본값.**
 * "evidence" 같음. 다만 proposed 값을 프롬프트·리포트 도구에 노출한다.
 *
 * 라벨을 실제로 갈아 끼우는 값은 아직 없다. 그것은 명리 검수가 승인한 뒤에
 * strength-v1.json 의 status 를 approved 로 바꾸면서 여는 문이다.
 */
export type StrengthPolicyMode = "off" | "evidence";

export const DEFAULT_STRENGTH_POLICY: StrengthPolicyMode = "off";

export function strengthPolicyMode(): StrengthPolicyMode {
  const raw = process.env.STRENGTH_POLICY;
  if (raw === "off" || raw === "evidence") return raw;
  if (raw) {
    console.warn(
      `STRENGTH_POLICY="${raw}" 는 알 수 없는 값입니다. off | evidence 중 하나여야 합니다. ` +
        `기본값 "${DEFAULT_STRENGTH_POLICY}" 로 진행합니다.`
    );
  }
  return DEFAULT_STRENGTH_POLICY;
}

function tenGodAxis(dayElement: Ohaeng, target: Ohaeng): string {
  if (target === dayElement) return "비겁";
  if (GENERATES[dayElement] === target) return "식상";
  if (CONTROLS[dayElement] === target) return "재성";
  if (CONTROLS[target] === dayElement) return "관살";
  return "인성";
}

/** 왕상휴수사 — 계절과 일간의 관계 */
export function seasonalPhaseOf(dayElement: Ohaeng, monthBranch: string): SeasonalPhase {
  const table = POLICY.seasonalPhase.seasonElementOfBranch as Record<string, Ohaeng>;
  const season = table[monthBranch];
  if (!season) return "휴";
  if (season === dayElement) return "왕";
  if (GENERATES[season] === dayElement) return "상";
  if (GENERATES[dayElement] === season) return "휴";
  if (CONTROLS[dayElement] === season) return "수";
  return "사";
}

export function strengthPolicyEvidence(chart: SajuChart): StrengthPolicyEvidence {
  const dayElement = CHEONGAN_ELEMENT[chart.day.ganIdx];
  const monthBranch = chart.month.ji;

  // ── 득령: 계절이 나를 어떻게 대하는가 ──
  const phase = seasonalPhaseOf(dayElement, monthBranch);
  const phaseDelta = (POLICY.seasonalPhase.scoreDelta as Record<string, number>)[phase] ?? 0;
  const monthElement = JIJI_OHAENG[chart.month.jiIdx] as Ohaeng;
  const monthCommand = {
    branch: monthBranch,
    tenGodOfDayMaster: tenGodAxis(dayElement, monthElement),
    seasonalPhase: phase,
    scoreDelta: phaseDelta,
    reason:
      phase === "왕" || phase === "상"
        ? `득령: ${monthBranch}월은 ${dayElement}에게 ${phase}(旺相) 자리다`
        : `실령: ${monthBranch}월은 ${dayElement}에게 ${phase} 자리다 — 계절이 일간을 돕지 않는다`,
  };

  // ── 설기·극: 지금 판정이 0점으로 두는 자리들 ──
  const draining: ScoredEvidence[] = [];
  const controlling: ScoredEvidence[] = [];
  const slots: { where: string; element: Ohaeng }[] = [];
  const pillars = [
    { name: "연", pillar: chart.year },
    { name: "월", pillar: chart.month },
    { name: "일", pillar: chart.day },
    ...(chart.hour ? [{ name: "시", pillar: chart.hour }] : []),
  ];
  for (const { name, pillar } of pillars) {
    // 일간 자신은 세지 않는다 — 자기가 자기를 빼내지 않는다.
    if (name !== "일") slots.push({ where: `${name}간`, element: CHEONGAN_ELEMENT[pillar.ganIdx] });
    slots.push({ where: `${name}지`, element: JIJI_OHAENG[pillar.jiIdx] as Ohaeng });
  }

  const drainTable = POLICY.draining.scoreDeltaPerOccurrence as Record<string, number>;
  const controlTable = POLICY.controlling.scoreDeltaPerOccurrence as Record<string, number>;
  const axisCount: Record<string, number> = {};
  for (const slot of slots) {
    const axis = tenGodAxis(dayElement, slot.element);
    axisCount[axis] = (axisCount[axis] ?? 0) + 1;
    if (axis === "식상" || axis === "재성") {
      draining.push({
        source: slot.where,
        tenGod: axis,
        scoreDelta: drainTable[axis] ?? 0,
        reason: `${slot.where}의 ${slot.element}이 일간을 빼낸다`,
      });
    }
    if (axis === "관살") {
      controlling.push({
        source: slot.where,
        tenGod: axis,
        scoreDelta: controlTable["관살"] ?? 0,
        reason: `${slot.where}의 ${slot.element}이 일간을 누른다`,
      });
    }
  }

  // ── 통근: 이미 계산돼 있던 것을 처음으로 점수 자리에 놓는다 ──
  const rootTable = POLICY.rooting.scoreDeltaByLevel as Record<string, number>;
  const evidence = rootingEvidence(chart);
  const dayStem = CHEONGAN[chart.day.ganIdx];
  const rooting = evidence.rooting
    .filter((r) => r.targetStem === dayStem)
    .map((r) => ({
      branch: r.branch,
      hiddenStemTier: (r.rootingLevel === "direct"
        ? "main"
        : r.rootingLevel === "middle"
          ? "middle"
          : "residual") as "main" | "middle" | "residual",
      scoreDelta: rootTable[r.rootingLevel] ?? 0,
      // 지금 판정은 지장간을 보지 않는다. 이 점수는 어디에도 들어가지 않는다.
      applied: "not_applied" as const,
    }));
  const rootTotal = Math.min(
    POLICY.rooting.maxTotal,
    rooting.reduce((sum, r) => sum + r.scoreDelta, 0)
  );

  // ── 투간 ──
  const exposureDelta = POLICY.exposure.scoreDeltaPerOccurrence;
  const dayBranchHidden = new Set(
    [chart.year, chart.month, chart.day, chart.hour]
      .filter(Boolean)
      .flatMap((p) => hiddenStemsOf(p!.jiIdx).map((h) => h.stem))
  );
  const exposure = evidence.exposed
    .filter((e) => dayBranchHidden.has(e.hiddenStem))
    .filter((e) => CHEONGAN_ELEMENT[CHEONGAN.indexOf(e.hiddenStem as (typeof CHEONGAN)[number])] === dayElement)
    .map((e) => ({
      stem: e.hiddenStem,
      relation: `${e.branchPosition}의 지장간이 ${e.exposedAtPillarPositions.join(",")}에 드러남`,
      scoreDelta: exposureDelta,
    }));

  // ── 인성과다 ──
  const supportExcess = POLICY.supportExcess.rules.map((rule) => {
    const count = axisCount["인성"] ?? 0;
    const siblings = axisCount["비겁"] ?? 0;
    const triggered = count >= rule.threshold && (!rule.requiresNoSibling || siblings === 0);
    return {
      type: rule.type,
      threshold: rule.threshold,
      triggered,
      reason: triggered
        ? `${rule.note} (인성 ${count}개, 비겁 ${siblings}개)`
        : `인성 ${count}개, 비겁 ${siblings}개 — 임계 미만`,
    };
  });

  const proposedScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          phaseDelta +
          draining.reduce((sum, d) => sum + d.scoreDelta, 0) +
          controlling.reduce((sum, c) => sum + c.scoreDelta, 0) +
          rootTotal +
          exposure.reduce((sum, e) => sum + e.scoreDelta, 0) +
          supportExcess
            .filter((s) => s.triggered)
            .reduce((sum, s) => {
              const rule = POLICY.supportExcess.rules.find((r) => r.type === s.type);
              return sum + (rule?.scoreDelta ?? 0);
            }, 0)
      )
    )
  );

  return {
    monthCommand,
    draining,
    controlling,
    rooting,
    exposure,
    supportExcess,
    policyVersion: POLICY.policyVersion,
    proposedScore,
    proposedLabel: proposedScore >= 62 ? "신강" : proposedScore <= 42 ? "신약" : "중화",
    // 승인 전이다. 어떤 모드에서도 라벨은 지금 판정이 낸다.
    appliedToLabel: false,
  };
}

/** 이 표가 아직 승인 전인가 — 보고서·감사 도구가 그대로 인용한다 */
export const STRENGTH_POLICY_STATUS = POLICY.status;
export const STRENGTH_POLICY_VERSION = POLICY.policyVersion;
export const STRENGTH_OPEN_QUESTIONS = POLICY.openQuestions;
