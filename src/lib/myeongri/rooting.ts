// 통근(通根)과 투간(透干) — 증거만 낸다. 점수는 내지 않는다.
//
// 지금 강약 판정(saju-facts.ts의 judgeStrength)은 지지를 본기 오행 하나로만 보고
// 득령·득지·득세로 점수를 낸다. 통근이 어느 지장간에 닿았는지, 그 지장간이 천간에
// 드러났는지는 보지 않는다.
//
// 여기서 그 증거를 낸다. **가중치는 붙이지 않는다** — 여기·중기·본기에 각각 몇 점을
// 줄지는 유파마다 다르고, 임의로 정하면 그 숫자가 사실처럼 굳는다.
// 점수가 필요하면 정책 프로필을 명시해 부르는 쪽에서 정한다.

import { CHEONGAN, type Pillar, type SajuChart } from "@/lib/saju";
import {
  hiddenStemsOf,
  stemElementOf,
  HIDDEN_STEM_TABLE_VERSION,
  type HiddenStemRole,
} from "@/lib/myeongri/hidden-stems";
import { CALCULATION_POLICY_VERSION } from "@/lib/myeongri/policy";

export type PillarPosition = "연주" | "월주" | "일주" | "시주";

/** 어떤 천간이 어느 지지의 어떤 지장간에 뿌리를 두는가 */
export interface RootingEvidence {
  targetStem: string;
  branch: string;
  hiddenStem: string;
  hiddenStemRole: HiddenStemRole;
  pillarPosition: PillarPosition;
  /** 본기에 닿았으면 direct, 중기면 middle, 여기면 residual */
  rootingLevel: "direct" | "middle" | "residual";
}

/** 지장간이 명식의 천간으로 드러났는가 */
export interface ExposedStemEvidence {
  hiddenStem: string;
  branchPosition: PillarPosition;
  exposedAtPillarPositions: PillarPosition[];
}

export interface StrengthEvidence {
  rooting: RootingEvidence[];
  exposed: ExposedStemEvidence[];
  hiddenStemTableVersion: string;
  calculationPolicyVersion: string;
}

const LEVEL: Record<HiddenStemRole, RootingEvidence["rootingLevel"]> = {
  main: "direct",
  middle: "middle",
  residual: "residual",
};

function pillarsOf(chart: SajuChart): { position: PillarPosition; pillar: Pillar }[] {
  const out: { position: PillarPosition; pillar: Pillar }[] = [
    { position: "연주", pillar: chart.year },
    { position: "월주", pillar: chart.month },
    { position: "일주", pillar: chart.day },
  ];
  if (chart.hour) out.push({ position: "시주", pillar: chart.hour });
  return out;
}

/**
 * 통근 — 명식의 각 천간이 어느 지지의 어떤 지장간에 뿌리내렸는가.
 *
 * 같은 오행이면 뿌리로 본다. 음양까지 맞아야 하는가는 유파가 갈리므로 여기서는
 * 오행 일치만 보고, 지장간의 음양은 그대로 실어 보내 부르는 쪽이 더 좁힐 수 있게 한다.
 */
export function findRooting(chart: SajuChart): RootingEvidence[] {
  const pillars = pillarsOf(chart);
  const evidence: RootingEvidence[] = [];

  for (const { pillar } of pillars) {
    const stem = CHEONGAN[pillar.ganIdx];
    const stemEl = stemElementOf(stem);
    for (const { position, pillar: host } of pillars) {
      for (const hidden of hiddenStemsOf(host.jiIdx)) {
        if (hidden.element !== stemEl) continue;
        evidence.push({
          targetStem: stem,
          branch: host.ji,
          hiddenStem: hidden.stem,
          hiddenStemRole: hidden.role,
          pillarPosition: position,
          rootingLevel: LEVEL[hidden.role],
        });
      }
    }
  }
  return evidence;
}

/** 투간 — 지지 속 글자가 명식의 천간으로 나와 있는가 */
export function findExposedStems(chart: SajuChart): ExposedStemEvidence[] {
  const pillars = pillarsOf(chart);
  const stemAt = new Map<string, PillarPosition[]>();
  for (const { position, pillar } of pillars) {
    const stem = CHEONGAN[pillar.ganIdx];
    stemAt.set(stem, [...(stemAt.get(stem) ?? []), position]);
  }

  const out: ExposedStemEvidence[] = [];
  for (const { position, pillar } of pillars) {
    for (const hidden of hiddenStemsOf(pillar.jiIdx)) {
      const at = stemAt.get(hidden.stem);
      if (!at) continue;
      out.push({ hiddenStem: hidden.stem, branchPosition: position, exposedAtPillarPositions: at });
    }
  }
  return out;
}

export function strengthEvidence(chart: SajuChart): StrengthEvidence {
  return {
    rooting: findRooting(chart),
    exposed: findExposedStems(chart),
    hiddenStemTableVersion: HIDDEN_STEM_TABLE_VERSION,
    calculationPolicyVersion: CALCULATION_POLICY_VERSION,
  };
}

/**
 * 통근 가중치 프로필 — 점수를 내려면 부르는 쪽이 골라야 한다.
 *
 * "none"         점수를 내지 않는다. 기본값.
 * "conservative" 본기만 뿌리로 세고 중기·여기는 절반 이하로 본다.
 *
 * 어떤 프로필도 지금의 강약 점수(judgeStrength)를 대체하지 않는다.
 * 새 모델을 운영 기본값으로 올리는 것은 명리 검수가 정할 일이다.
 */
export type RootingWeightProfile = "none" | "conservative";

export const DEFAULT_ROOTING_WEIGHT_PROFILE: RootingWeightProfile = "none";

export function rootingWeightProfile(): RootingWeightProfile {
  const raw = process.env.TONGGEUN_WEIGHT_PROFILE;
  if (!raw) return DEFAULT_ROOTING_WEIGHT_PROFILE;
  if (raw === "none" || raw === "conservative") return raw;
  console.warn(
    `TONGGEUN_WEIGHT_PROFILE="${raw}" 는 알 수 없는 값입니다. ` +
      `none | conservative 중 하나여야 합니다. 기본값 "${DEFAULT_ROOTING_WEIGHT_PROFILE}" 로 진행합니다.`
  );
  return DEFAULT_ROOTING_WEIGHT_PROFILE;
}
