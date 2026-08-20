// 형(刑) — 형충회합 중 유일하게 빠져 있던 것.
//
// 이 파일은 **관계가 성립하는가**까지만 책임진다. 형을 갈등·구설·집착으로 읽을지,
// 그것을 사용자에게 어떻게 보일지는 해석층의 일이고 여기서 정하지 않는다.
// 계산 사실과 관계 서술을 같은 자리에 두면 되돌릴 수 없게 섞인다.
//
// 삼형이 두 글자만 있을 때는 partial 로 표시한다. 이것을 실질 성립으로 볼지는
// XING_PARTIAL_POLICY 로 정한다 — 유파가 갈리는 자리라 코드가 혼자 정하지 않는다.
//
// 본명식만 보는 것과 대운·세운까지 보는 것도 나눠 둔다. 타고난 형(natal)과
// 운에서 들어오는 형(luck)은 무게가 다르다 — 하나는 늘 있는 것이고 하나는 지나간다.

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

/** 본명식 안에서 성립한 것인가, 운이 들어와 성립한 것인가 */
export type XingScope = "natal" | "luck";

export interface XingRelation {
  kind: XingKind;
  /** 실제로 명식에 있던 지지 (한글) */
  branches: string[];
  /** 그 지지들이 앉은 자리 — 연지·월지·일지·시지 */
  pillarPositions: string[];
  completeness: XingCompleteness;
  scope: XingScope;
  /** 운에서 온 경우, 어느 운의 글자가 끼었는지 */
  luckSources?: string[];
  calculationPolicyVersion: string;
}

/** 지지가 놓인 한 자리. 대운·세운·월운도 같은 모양으로 넣는다. */
export interface BranchSlot {
  position: "연지" | "월지" | "일지" | "시지" | "대운" | "세운" | "월운";
  jiIdx: number;
}

const LUCK_POSITIONS = new Set(["대운", "세운", "월운"]);

/**
 * 부분 삼형(두 글자)을 실질 성립으로 볼 것인가.
 *
 * "off" 감지는 하되 점수·서술에 쓰지 않는다.
 * "on"  완전 삼형과 같이 쓴다.
 *
 * 명리적으로 갈리는 자리다. 두 글자만으로도 형의 기운이 작동한다고 보는 쪽과,
 * 셋이 모여야 국(局)이 선다고 보는 쪽이 있다.
 *
 * **기본값은 2026-08-20 부터 "on" 이다.** 운영자의 지시로 정했다 — 두 글자 성립을
 * 인정하면 형 규칙이 켜지는 명식이 늘고, 그만큼 짚을 수 있는 자리가 늘어난다.
 * 어느 쪽이 명리적으로 옳은지에 대한 판정은 여전히 없다. 되돌리려면
 * XING_PARTIAL_POLICY=off 하나면 된다.
 */
export type XingPartialPolicy = "off" | "on";

export const DEFAULT_XING_PARTIAL_POLICY: XingPartialPolicy = "on";

export function xingPartialPolicy(): XingPartialPolicy {
  const raw = process.env.XING_PARTIAL_POLICY;
  if (!raw) return DEFAULT_XING_PARTIAL_POLICY;
  if (raw === "off" || raw === "on") return raw;
  console.warn(
    `XING_PARTIAL_POLICY="${raw}" 는 알 수 없는 값입니다. off | on 중 하나여야 합니다. ` +
      `기본값 "${DEFAULT_XING_PARTIAL_POLICY}" 로 진행합니다.`
  );
  return DEFAULT_XING_PARTIAL_POLICY;
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
function detect(slots: BranchSlot[]): XingRelation[] {
  const found: XingRelation[] = [];
  const stamp = CALCULATION_POLICY_VERSION;

  const finish = (
    kind: XingKind,
    hits: BranchSlot[],
    branches: string[],
    completeness: XingCompleteness
  ) => {
    const luck = hits.filter((h) => LUCK_POSITIONS.has(h.position));
    found.push({
      kind,
      branches,
      pillarPositions: hits.map((h) => h.position),
      completeness,
      // 운의 글자가 하나라도 끼었으면 그 형은 타고난 것이 아니라 지나가는 것이다
      scope: luck.length > 0 ? "luck" : "natal",
      ...(luck.length > 0 ? { luckSources: [...new Set(luck.map((h) => h.position))] } : {}),
      calculationPolicyVersion: stamp,
    });
  };

  // ── 삼형 ── 세 글자가 다 있으면 complete, 두 글자면 partial
  for (const { kind, members } of THREE_XING) {
    const hit = members
      .map((m) => ({ m, slots: slots.filter((s) => s.jiIdx === m) }))
      .filter((x) => x.slots.length > 0);
    if (hit.length < 2) continue;
    finish(
      kind,
      hit.flatMap((x) => x.slots),
      hit.map((x) => JIJI[x.m]),
      hit.length === members.length ? "complete" : "partial"
    );
  }

  // ── 상형 ── 자와 묘가 함께 있으면 성립. 부분이라는 개념이 없다.
  const [zi, mao] = MUTUAL_XING.members;
  const ziSlots = slots.filter((s) => s.jiIdx === zi);
  const maoSlots = slots.filter((s) => s.jiIdx === mao);
  if (ziSlots.length > 0 && maoSlots.length > 0) {
    finish(MUTUAL_XING.kind, [...ziSlots, ...maoSlots], [JIJI[zi], JIJI[mao]], "complete");
  }

  // ── 자형 ── 같은 글자가 둘 이상일 때만. 하나만으로는 성립하지 않는다.
  for (const { kind, branch } of SELF_XING) {
    const hits = slots.filter((s) => s.jiIdx === branch);
    if (hits.length < 2) continue;
    finish(kind, hits, hits.map((h) => JIJI[h.jiIdx]), "complete");
  }

  return found;
}

/**
 * 본명식의 형. 대운·세운을 섞지 않는다 — 타고난 것과 지나가는 것을 같은 무게로
 * 두면 구분이 사라진다.
 */
export function findXing(slots: BranchSlot[]): XingRelation[] {
  return detect(slots).filter((r) => r.scope === "natal");
}

/**
 * 운이 들어와 성립하는 형. 본명식에 이미 있던 것은 빼고, **운의 글자가 낀 것만**
 * 돌려준다. 시기를 짚는 데 쓴다 — "올해 이 자리가 흔들린다" 같은 말은 여기서만 나온다.
 */
export function findXingWithLuck(natal: BranchSlot[], luck: BranchSlot[]): XingRelation[] {
  return detect([...natal, ...luck]).filter((r) => r.scope === "luck");
}

/**
 * 점수·서술에 쓸 수 있는 것만.
 * partial 을 포함할지는 XING_PARTIAL_POLICY 가 정한다.
 */
export function completeXing(relations: XingRelation[]): XingRelation[] {
  if (xingPartialPolicy() === "on") return relations;
  return relations.filter((r) => r.completeness === "complete");
}
