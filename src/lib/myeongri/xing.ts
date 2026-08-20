// 형(刑) — 형충회합 중 유일하게 빠져 있던 것.
//
// 이 파일은 **관계가 성립하는가**까지만 책임진다. 형을 갈등·구설·집착으로 읽을지,
// 그것을 사용자에게 어떻게 보일지는 해석층의 일이고 여기서 정하지 않는다.
// 계산 사실과 관계 서술을 같은 자리에 두면 되돌릴 수 없게 섞인다.
//
// 삼형이 두 글자만 있을 때는 partial 로 표시하되, **점수나 서술에 쓰지 않는다.**
// 부분 성립을 실질 성립으로 볼지는 아직 정해진 바가 없다(미결정 정책).

import { JIJI } from "@/lib/saju";
import { CALCULATION_POLICY_VERSION } from "@/lib/myeongri/policy";

export type XingKind =
  | "yin_si_shen_three_xing"
  | "chou_xu_wei_three_xing"
  | "zi_mao_mutual_xing"
  | "chen_chen_self_xing"
  | "wu_wu_self_xing"
  | "you_you_self_xing"
  | "hai_hai_self_xing";

export type XingCompleteness = "complete" | "partial";

export interface XingRelation {
  kind: XingKind;
  /** 실제로 명식에 있던 지지 (한글) */
  branches: string[];
  /** 그 지지들이 앉은 자리 — 연지·월지·일지·시지 */
  pillarPositions: string[];
  completeness: XingCompleteness;
  calculationPolicyVersion: string;
}

/** 지지가 놓인 한 자리 */
export interface BranchSlot {
  position: "연지" | "월지" | "일지" | "시지";
  jiIdx: number;
}

const IDX = (name: string) => JIJI.indexOf(name as (typeof JIJI)[number]);

const THREE_XING: { kind: XingKind; members: number[] }[] = [
  { kind: "yin_si_shen_three_xing", members: [IDX("인"), IDX("사"), IDX("신")] },
  { kind: "chou_xu_wei_three_xing", members: [IDX("축"), IDX("술"), IDX("미")] },
];

const MUTUAL_XING: { kind: XingKind; members: [number, number] } = {
  kind: "zi_mao_mutual_xing",
  members: [IDX("자"), IDX("묘")],
};

const SELF_XING: { kind: XingKind; branch: number }[] = [
  { kind: "chen_chen_self_xing", branch: IDX("진") },
  { kind: "wu_wu_self_xing", branch: IDX("오") },
  { kind: "you_you_self_xing", branch: IDX("유") },
  { kind: "hai_hai_self_xing", branch: IDX("해") },
];

/**
 * 본명식의 형을 찾는다.
 *
 * 대운·세운을 섞은 교차 형은 여기서 보지 않는다 — 본명식의 구조와 운에서 온 것을
 * 같은 무게로 두면 "타고난 것"과 "지나가는 것"이 구분되지 않는다.
 * 필요해지면 별도 함수로 분리한다.
 */
export function findXing(slots: BranchSlot[]): XingRelation[] {
  const found: XingRelation[] = [];
  const stamp = CALCULATION_POLICY_VERSION;

  // ── 삼형 ── 세 글자가 다 있으면 complete, 두 글자면 partial
  for (const { kind, members } of THREE_XING) {
    const hit = members
      .map((m) => ({ m, slots: slots.filter((s) => s.jiIdx === m) }))
      .filter((x) => x.slots.length > 0);
    if (hit.length < 2) continue;
    found.push({
      kind,
      branches: hit.map((x) => JIJI[x.m]),
      pillarPositions: hit.flatMap((x) => x.slots.map((s) => s.position)),
      completeness: hit.length === members.length ? "complete" : "partial",
      calculationPolicyVersion: stamp,
    });
  }

  // ── 상형 ── 자와 묘가 함께 있으면 성립. 부분이라는 개념이 없다.
  const [zi, mao] = MUTUAL_XING.members;
  const ziSlots = slots.filter((s) => s.jiIdx === zi);
  const maoSlots = slots.filter((s) => s.jiIdx === mao);
  if (ziSlots.length > 0 && maoSlots.length > 0) {
    found.push({
      kind: MUTUAL_XING.kind,
      branches: [JIJI[zi], JIJI[mao]],
      pillarPositions: [...ziSlots, ...maoSlots].map((s) => s.position),
      completeness: "complete",
      calculationPolicyVersion: stamp,
    });
  }

  // ── 자형 ── 같은 글자가 둘 이상일 때만. 하나만으로는 성립하지 않는다.
  for (const { kind, branch } of SELF_XING) {
    const hits = slots.filter((s) => s.jiIdx === branch);
    if (hits.length < 2) continue;
    found.push({
      kind,
      branches: hits.map((h) => JIJI[h.jiIdx]),
      pillarPositions: hits.map((h) => h.position),
      completeness: "complete",
      calculationPolicyVersion: stamp,
    });
  }

  return found;
}

/** 점수나 서술에 쓸 수 있는 것만 — partial 은 아직 정책이 없어 제외한다 */
export function completeXing(relations: XingRelation[]): XingRelation[] {
  return relations.filter((r) => r.completeness === "complete");
}
