// 형(刑)의 이름.
//
// xing.ts 는 관계가 성립하는가까지만 본다. 이름을 여기에 따로 두는 이유는
// **이름이 사실 주장이기 때문**이다. 사·신 두 글자만 선 자리를 "인사신 삼형"이라
// 부르면, 그 문장을 읽는 사람은 자기 명식에 인(寅)이 있다고 읽는다. 실제 감사에서
// 부분 성립 18건 중 15건이 완성 삼형의 이름으로 나갔다.
//
// 그래서 규칙은 하나다. **이름에 들어가는 글자는 명식에 실제로 있는 글자뿐이다.**
// 세 글자가 다 서야 그룹 이름(인사신 삼형)을 쓴다. 둘만 서면 그 둘로 이름을 짓는다
// — 사신형, 축미형, 술미형. 고전에서도 巳刑申·戌刑未처럼 선 글자로 부른다.

import type { XingKind, XingRelation } from "./xing";

/**
 * 세 글자가 다 선 삼형·상형·자형에만 붙는 이름.
 * 부분 성립에는 절대 쓰지 않는다 — xingLabel()을 거쳐야 하는 이유다.
 */
export const XING_GROUP_LABEL: Record<XingKind, string> = {
  yin_si_shen_three_xing: "인사신 삼형",
  chou_xu_wei_three_xing: "축술미 삼형",
  zi_mao_mutual_xing: "자묘 상형",
  chen_chen_self_xing: "진진 자형",
  wu_wu_self_xing: "오오 자형",
  you_you_self_xing: "유유 자형",
  hai_hai_self_xing: "해해 자형",
};

/** 부분 성립이 있을 수 있는 것 — 삼형 둘뿐이다. 나머지는 성립하거나 아니거나다. */
export const PARTIALLY_COMPLETABLE: XingKind[] = [
  "yin_si_shen_three_xing",
  "chou_xu_wei_three_xing",
];

/** 부분 성립을 넓혀 부른 것인지 가드가 잡을 때 쓰는 표 */
export const THREE_XING_GROUP_LABELS = PARTIALLY_COMPLETABLE.map((k) => XING_GROUP_LABEL[k]);

/**
 * 이 형을 뭐라고 부를 것인가.
 *
 * complete -> 그룹 이름.
 * partial  -> 실제로 선 글자만으로 지은 이름. ("사신형")
 */
export function xingLabel(relation: Pick<XingRelation, "kind" | "branches" | "completeness">): string {
  if (relation.completeness === "complete") return XING_GROUP_LABEL[relation.kind];
  return `${[...new Set(relation.branches)].join("")}형`;
}

/** 신살과 같은 모양 — 이름=자리. 부분이라는 사실은 이름이 이미 말하고 있다. */
export function xingLine(relation: XingRelation): string {
  return `${xingLabel(relation)}=${relation.pillarPositions.join(",")}`;
}
