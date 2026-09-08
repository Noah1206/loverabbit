// 사주지도 — 화면이 쓰는 파생값만. 계산은 하지 않는다.
//
// 관계 계산은 전부 guin-calc.ts 가 이미 한다. 여기서 하는 일은 그 결과를
// 지도 화면이 바로 쓸 수 있는 모양으로 옮기는 것뿐이다: 어느 갈래로 묶을지,
// 어디에 앉힐지, 무엇을 먼저 보여줄지.
//
// 순수 함수만 둔다 — DOM 도 fetch 도 없다. 테스트가 이 파일을 직접 부른다.

import {
  STATUS_LABEL,
  type GuinNodeView,
  type GuinRelStatus,
  type GuinRole,
} from "@/lib/guin-map";

/* ── 관계 갈래 ───────────────────────────────────────────────────────────
   필터 칩이 쓰는 네 갈래. 참여자가 고른 관계 상태(GuinRelStatus)를 접는다.
   상태는 아홉인데 칩을 아홉 개 세우면 그건 필터가 아니라 목록이다. */

export const RELATION_GROUPS = ["all", "love", "friend", "family", "work"] as const;
export type RelationGroup = (typeof RELATION_GROUPS)[number];

export const GROUP_LABEL: Record<RelationGroup, string> = {
  all: "전체",
  love: "💗 연애",
  friend: "친구",
  family: "가족",
  work: "지인",
};

/** 관계 상태 → 갈래. 상태를 안 고른 사람은 '친구' 로 둔다 — 가장 넓은 자리다. */
const STATUS_GROUP: Record<GuinRelStatus, RelationGroup> = {
  crush: "love",
  dating: "love",
  reunion: "love",
  conflict: "friend",
  no_contact: "friend",
  friend: "friend",
  family: "family",
  coworker: "work",
  unclear: "friend",
};

export function groupOf(status: GuinRelStatus | null | undefined): RelationGroup {
  return status ? STATUS_GROUP[status] : "friend";
}

/** 상세 시트에 적는 관계 한 줄. 상태를 안 골랐으면 빈 문자열 — 지어내지 않는다. */
export function statusLine(status: GuinRelStatus | null | undefined): string {
  return status ? STATUS_LABEL[status] : "";
}

/* ── 노드가 앉는 자리 ────────────────────────────────────────────────────
   방사형이되 격자로 보이면 안 된다. 규칙은 셋이다.

   1. 역할이 방위를 정한다 — 같은 역할끼리 한쪽에 모인다.
   2. 궁합이 거리를 정한다 — 점수가 높을수록 가운데(나) 가까이 앉는다.
   3. 사람이 늘면 고리를 겹으로 쌓는다 — 5명까지 한 겹, 10명까지 두 겹, 그 위 세 겹.

   난수를 쓰지 않는다. 같은 지도는 언제나 같은 그림이어야 캡처해서 보낸 화면과
   다시 열었을 때의 화면이 같다. 흔들림은 id 해시에서 만든다. */

export interface MapNodePos {
  id: string;
  /** 0~100 (%) — 지도 상자 안에서의 자리 */
  x: number;
  y: number;
  /** 몇 번째 고리인가. 0 이 가장 안쪽 */
  ring: number;
}

const ROLE_ANGLE: Record<GuinRole, number> = {
  comforter: 210,
  right_hand: 150,
  communicator: 330,
  growth_teacher: 30,
  // 옛(guin-1) 역할 — 저장된 지도를 그대로 그리기 위해 남긴다
  benefactor: 270,
  mirror: 90,
  stimulator: 350,
  neutral: 190,
};

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 100003;
  return h;
}

/** 몇 겹으로 쌓을지 — 사람 수만 보고 정한다 */
export function ringCount(people: number): number {
  if (people <= 5) return 1;
  if (people <= 10) return 2;
  return 3;
}

/**
 * 노드 자리를 한 번에 계산한다.
 *
 * 입력 순서가 곧 고리 순서다. 궁합이 높은 사람을 먼저 넘기면 안쪽 고리에
 * 앉는다 — 호출부(sortForMap)가 그 순서를 만든다.
 */
export function layoutNodes(
  nodes: { id: string; role: GuinRole; score: number | null }[]
): MapNodePos[] {
  const rings = ringCount(nodes.length);
  const perRing = Math.ceil(nodes.length / rings) || 1;
  // 고리 반지름(%). 가장 바깥이 38 을 넘으면 이름이 상자 밖으로 나간다.
  const RADIUS = [23, 32, 40];

  const seen: Record<string, number> = {};
  return nodes.map((node, index) => {
    const ring = Math.min(Math.floor(index / perRing), rings - 1);
    const base = ROLE_ANGLE[node.role] ?? 0;
    // 같은 역할이 여럿이면 좌우로 갈라 앉힌다 — 겹치지 않게, 그러나 결정적으로.
    const nth = seen[node.role] ?? 0;
    seen[node.role] = nth + 1;
    const spread = (nth % 2 === 0 ? 1 : -1) * Math.ceil(nth / 2) * 26;
    // 흔들림은 ±6도. 이게 없으면 네 방위에 정확히 박혀 그래프처럼 보인다.
    const jitter = (hashOf(node.id) % 13) - 6;
    const angle = ((base + spread + jitter) * Math.PI) / 180;
    // 궁합이 높을수록 제 고리 안에서 조금 더 안쪽에 앉는다.
    const pull = node.score === null ? 0 : (node.score / 100) * 4;
    const r = RADIUS[ring] - pull;
    return {
      id: node.id,
      x: 50 + r * Math.cos(angle),
      // 세로는 조금 눌러 담는다 — 상자가 정사각형이 아니라서 그대로 두면 위아래로 샌다.
      y: 50 + r * 0.86 * Math.sin(angle),
      ring,
    };
  });
}

/** 궁합이 높은 사람이 안쪽 고리에 앉게 세운다. 점수가 없으면 뒤로. */
export function sortForMap<T extends { score: number | null; nickname: string }>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    if (a.score === b.score) return a.nickname.localeCompare(b.nickname);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });
}

/* ── 발견 ───────────────────────────────────────────────────────────────
   지도를 처음 열었을 때 "그래서 뭘 봐야 하는데" 에 답하는 한 줄.
   없는 사실을 만들지 않는다 — 이미 계산된 역할과 점수에서만 뽑는다. */

export interface Discovery {
  emoji: string;
  text: string;
  /** 눌렀을 때 펼칠 사람 */
  nodeId: string;
}

/**
 * 지금 지도에서 가장 말할 값이 있는 것 하나.
 *
 * 우선순위: 궁합 1위 → 귀인(오른팔형) 수 → 성장형. 점수가 가려진 지도
 * (showScores 꺼짐)에서는 점수를 말하지 않는다.
 */
export function discoveryOf(nodes: GuinNodeView[]): Discovery | null {
  if (nodes.length === 0) return null;

  const scored = nodes.filter((n) => typeof n.score === "number");
  if (scored.length >= 2) {
    const top = sortForMap(scored)[0];
    return {
      emoji: "💗",
      text: `${top.nickname}님과 궁합이 가장 잘 맞아요`,
      nodeId: top.id,
    };
  }

  const helpers = nodes.filter((n) => n.role === "right_hand");
  if (helpers.length > 0) {
    return {
      emoji: "✨",
      text:
        helpers.length === 1
          ? `${helpers[0].nickname}님은 나에게 힘이 되어주는 인연이에요`
          : `내 주변에 힘이 되어주는 인연이 ${helpers.length}명 있어요`,
      nodeId: helpers[0].id,
    };
  }

  const growth = nodes.find((n) => n.role === "growth_teacher");
  if (growth) {
    return {
      emoji: "🌱",
      text: `${growth.nickname}님은 나를 넓혀주는 인연이에요`,
      nodeId: growth.id,
    };
  }

  return { emoji: "🌿", text: `${nodes[0].nickname}님과의 인연을 확인해보세요`, nodeId: nodes[0].id };
}

/** 노드 위에 얹는 아주 작은 힌트 하나. 역할이 정한다. */
export const ROLE_HINT: Record<GuinRole, string> = {
  comforter: "🌿",
  right_hand: "✨",
  communicator: "💬",
  growth_teacher: "🌱",
  benefactor: "✨",
  mirror: "🪞",
  stimulator: "🔥",
  neutral: "🌙",
};

/** 공유 카드에 쓰는 가린 이름 — "민지" → "민*" */
export function maskName(nickname: string): string {
  const clean = nickname.trim();
  if (clean.length <= 1) return clean;
  return clean[0] + "*".repeat(Math.min(clean.length - 1, 3));
}
