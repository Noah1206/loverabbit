// 같은 지지 쌍을 여러 번 세지 않기 위한 정규화 층.
//
// 감사에서 나온 문제: 명식에 실재하는 지지 쌍은 사·신과 축·미 둘뿐인데,
// 리포트는 사신합 / 사신형 / 축미충 / 축미형을 **네 개의 독립된 구조**로 설명했다.
// notableRelations 와 xing 이 서로를 모른 채 각자 모델에게 갔기 때문이다.
// 같은 두 글자가 두 번 세어지면 그 자리의 무게가 실제의 두 배로 읽힌다.
//
// 여기서는 글자 묶음이 같은 관계를 하나로 모은다. 합과 형이 한 자리에 겹치면
// 그것은 두 개의 구조가 아니라 **하나의 자리가 가진 두 얼굴**이다.
// 명리에서 巳申은 형과 합이 함께 걸린 합중유형(合中有刑)으로, 갈등이 합으로
// 눅는 자리로 본다. 나눠 보내면 그 조정이 일어날 자리가 아예 없다.
//
// 천간합은 여기 넣지 않는다. 지지의 합·충·형과 글자 축이 달라 겹칠 일이 없고,
// branches 라는 이름의 칸에 갑·기를 담으면 그 칸이 거짓말을 하게 된다.

import { xingLabel } from "./xing-name";
import type { XingCompleteness, XingRelation } from "./xing";

/** 번들에 들어가기 위해 필요한 최소한 — saju-facts 를 import 하지 않으려고 구조로 받는다 */
export interface BranchRelationInput {
  kind: string;
  members: string[];
  label: string;
  pillarPositions: string[];
}

export interface BundledRelation {
  /** "지지육합" | "지지충" | "삼합" | "형" */
  kind: string;
  /** 화면·근거에 나가는 이름. 형이면 정명을 거친 이름이 온다 ("사신형") */
  label: string;
  /** 형에만 있다. 부분 성립을 완성 삼형과 같은 무게로 읽지 않기 위한 표시 */
  completeness?: XingCompleteness;
}

export type PillarKey = "year" | "month" | "day" | "hour";

export interface RelationBundle {
  /** 근거 경로로 쓰는 열쇠 — 글자를 명식 순서대로 이어 붙인 것 ("사신") */
  id: string;
  branches: string[];
  positions: Array<{ pillar: PillarKey; role: string }>;
  relations: BundledRelation[];
  /**
   * single_bundle — 한 자리의 여러 얼굴이므로 묶어서 한 번만 말한다
   * separate      — 관계가 하나뿐이라 묶을 것이 없다
   */
  combinedInterpretationPolicy: "single_bundle" | "separate";
  note?: string;
}

const PILLAR_OF: Record<string, PillarKey> = {
  연지: "year",
  월지: "month",
  일지: "day",
  시지: "hour",
};

/** 지지 관계만. 천간합은 호출하는 쪽에서 걸러 넣는다. */
const BRANCH_KINDS = new Set(["지지충", "지지육합", "삼합"]);

function keyOf(members: string[]): string {
  return [...new Set(members)].sort().join("");
}

/**
 * 같은 글자 묶음에 걸린 관계를 하나로 모은다.
 *
 * xing 은 이미 정책(XING_PARTIAL_POLICY)을 통과한 것만 넘겨받는다 —
 * 부분 성립을 실질로 볼지 여기서 정하지 않는다.
 */
export function buildRelationBundles(
  relations: BranchRelationInput[],
  xing: XingRelation[]
): RelationBundle[] {
  const byKey = new Map<string, RelationBundle>();

  const touch = (members: string[], positions: string[]): RelationBundle => {
    const key = keyOf(members);
    let bundle = byKey.get(key);
    if (!bundle) {
      bundle = {
        id: members.join(""),
        branches: [...members],
        positions: [],
        relations: [],
        combinedInterpretationPolicy: "separate",
      };
      byKey.set(key, bundle);
    }
    for (const role of positions) {
      const pillar = PILLAR_OF[role];
      // 대운·세운·월운은 기둥이 아니다. 운에서 온 형은 애초에 여기 오지 않는다.
      if (!pillar) continue;
      if (bundle.positions.some((p) => p.role === role)) continue;
      bundle.positions.push({ pillar, role });
    }
    return bundle;
  };

  for (const relation of relations) {
    if (!BRANCH_KINDS.has(relation.kind)) continue;
    const bundle = touch(relation.members, relation.pillarPositions);
    bundle.relations.push({ kind: relation.kind, label: relation.label });
  }

  for (const x of xing) {
    if (x.scope !== "natal") continue;
    const bundle = touch([...new Set(x.branches)], x.pillarPositions);
    bundle.relations.push({ kind: "형", label: xingLabel(x), completeness: x.completeness });
  }

  const ORDER: PillarKey[] = ["year", "month", "day", "hour"];
  for (const bundle of byKey.values()) {
    // 같은 글자가 두 자리에 앉으면 관계마다 순서가 뒤섞여 들어온다. 읽는 쪽이
    // 명식을 훑는 순서와 같게 둔다 — 연 → 월 → 일 → 시.
    bundle.positions.sort((a, b) => ORDER.indexOf(a.pillar) - ORDER.indexOf(b.pillar));
    if (bundle.relations.length < 2) continue;
    bundle.combinedInterpretationPolicy = "single_bundle";
    bundle.note = bundleNote(bundle);
  }

  return [...byKey.values()].sort(
    (a, b) => rank(a, ORDER) - rank(b, ORDER) || a.id.localeCompare(b.id)
  );
}

function rank(bundle: RelationBundle, order: PillarKey[]): number {
  const hits = bundle.positions.map((p) => order.indexOf(p.pillar)).filter((i) => i >= 0);
  return hits.length ? Math.min(...hits) : order.length;
}

function bundleNote(bundle: RelationBundle): string {
  const kinds = new Set(bundle.relations.map((r) => r.kind));
  const has = (k: string) => kinds.has(k);
  if (has("형") && (has("지지육합") || has("삼합"))) {
    return "합과 형이 같은 자리에 겹친다 — 붙드는 힘과 걸리는 힘이 한 자리에서 나온다";
  }
  if (has("형") && has("지지충")) {
    return "충과 형이 같은 자리에 겹친다 — 한 번에 깨지는 결과 안에서 긁는 결이 같은 자리다";
  }
  if (has("지지충") && (has("지지육합") || has("삼합"))) {
    return "합과 충이 같은 자리에 겹친다 — 붙들면서 밀어내는 자리다";
  }
  return "같은 글자에 관계가 둘 이상 걸려 있다";
}

/** 한 자리를 여러 구조로 나눠 세면 안 되는 번들 — 가드가 이것만 검사한다 */
export function bundledLabels(bundles: RelationBundle[]): string[][] {
  return bundles
    .filter((b) => b.combinedInterpretationPolicy === "single_bundle")
    .map((b) => b.relations.map((r) => r.label));
}

/** 모델 입력에 실을 한 줄 — "사신(일지,연지)=사신합+사신형(부분)" */
export function bundleLine(bundle: RelationBundle): string {
  const where = bundle.positions.map((p) => p.role).join(",");
  const parts = bundle.relations.map((r) =>
    r.completeness === "partial" ? `${r.label}(부분)` : r.label
  );
  return `${bundle.id}(${where})=${parts.join("+")}`;
}
