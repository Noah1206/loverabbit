"use client";

// 귀인 지도의 "지도" — 페이지 배경 전체가 지도다.
//
// 카드 UI 는 이 위에 뜬다. 그래서 이 레이어는 만지지 못하고(pointer-events
// none) 읽히지도 않는다(aria-hidden) — 상호작용과 낭독은 전부 앞의 카드가
// 맡는다. 여기가 하는 일은 하나다: 계산값이 자리를 정한 별자리를 그려서,
// 사람이 들어올 때마다 지도가 채워지는 것을 보이게 하는 것.
//
// 자리는 전부 relate() 결과에서 나온다 — 역할이 방위를, 케미 점수가 중심과의
// 거리를 정한다(점수가 높을수록 가깝다). 난수가 없어서 같은 지도는 언제나
// 같은 그림이다. 별명만 싣는다 — 생년월일은 이 레이어에도 절대 없다.

import type { GuinRole } from "@/lib/guin-map";

/** 역할 구분 점 색. 색만으로 가르지 않는다 — 라벨이 항상 같이 붙는다. */
export const ROLE_DOT: Record<GuinRole, string> = {
  comforter: "#8fbfd8",
  right_hand: "#7dc4a5",
  communicator: "#9aa7d8",
  growth_teacher: "#c78d5a",
  // guin-1 시절 역할 — 저장된 지도를 그대로 그리기 위해 남긴다
  benefactor: "#e8b84b",
  mirror: "#b8a7d8",
  stimulator: "#d88da0",
  neutral: "#a5a3ac",
};

/** 역할 → 방위(도). v3 네 역할이 네 방향을 하나씩 가진다. */
const ROLE_ANGLE: Partial<Record<GuinRole, number>> = {
  comforter: 225,
  right_hand: 135,
  communicator: 315,
  growth_teacher: 45,
};

export interface GuinBgNode {
  id: string;
  nickname: string;
  role: GuinRole;
  score: number | null;
}

const CX = 50;
const CY = 56;

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 100000;
  return h;
}

function positionOf(node: GuinBgNode, indexInRole: number): { x: number; y: number } {
  // 방위는 역할이, 거리는 케미가 정한다. 점수가 가려져 있으면(null) 중간 거리.
  const base = ROLE_ANGLE[node.role] ?? hashOf(node.role) % 360;
  // 같은 역할이 여럿이면 좌우로 갈라 앉힌다 — 겹치지 않게, 그러나 결정적으로.
  const spread = (indexInRole % 2 === 0 ? 1 : -1) * Math.ceil(indexInRole / 2) * 22;
  const jitter = (hashOf(node.id) % 11) - 5;
  const angle = ((base + spread + jitter) * Math.PI) / 180;
  const radius = node.score === null ? 31 : 42 - (node.score / 100) * 22;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

export default function GuinMapBackground({
  ownerLabel,
  nodes,
}: {
  ownerLabel: string;
  nodes: GuinBgNode[];
}) {
  const perRole: Record<string, number> = {};
  const placed = nodes.map((node) => {
    const indexInRole = perRole[node.role] ?? 0;
    perRole[node.role] = indexInRole + 1;
    return { node, ...positionOf(node, indexInRole) };
  });
  // 빈 방위에 점선 자리를 남긴다 — 다음 인연이 앉을 곳. 3명까지만 힌트를 준다.
  const emptySlots =
    nodes.length >= 3
      ? []
      : Object.entries(ROLE_ANGLE)
          .filter(([role]) => !nodes.some((n) => n.role === role))
          .slice(0, 3 - nodes.length)
          .map(([, deg]) => {
            const angle = (deg * Math.PI) / 180;
            return { x: CX + 32 * Math.cos(angle), y: CY + 32 * Math.sin(angle) };
          });
  const showLabels = placed.length <= 16;

  return (
    <div aria-hidden className="guin-bg">
      <svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMin slice">
        <defs>
          <radialGradient id="guin-bg-glow">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.13" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={46} fill="url(#guin-bg-glow)" />
        {[16, 28, 40].map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} className="guin-bg-ring" />
        ))}

        {placed.map(({ node, x, y }, i) => (
          <g key={node.id} className="guin-bg-node" style={{ animationDelay: `${(i % 7) * 0.9}s` }}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke={ROLE_DOT[node.role]} strokeOpacity="0.22" strokeWidth="0.3" />
            <circle cx={x} cy={y} r={1.9} fill={ROLE_DOT[node.role]} fillOpacity="0.9" />
            <circle cx={x} cy={y} r={3.4} fill="none" stroke={ROLE_DOT[node.role]} strokeOpacity="0.35" strokeWidth="0.3" />
            {showLabels && (
              <text x={x} y={y + 6.4} textAnchor="middle" className="guin-bg-name">
                {node.nickname.slice(0, 6)}
              </text>
            )}
          </g>
        ))}

        {emptySlots.map((slot, i) => (
          <g key={`empty-${i}`} className="guin-bg-node" style={{ animationDelay: `${i * 1.3}s` }}>
            <circle cx={slot.x} cy={slot.y} r={3} className="guin-bg-empty" />
          </g>
        ))}

        {/* 중앙 — 지도의 주인 */}
        <circle cx={CX} cy={CY} r={3} fill="var(--accent)" fillOpacity="0.9" />
        <circle cx={CX} cy={CY} r={5.4} fill="none" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="0.35" />
        <text x={CX} y={CY + 9.2} textAnchor="middle" className="guin-bg-name guin-bg-owner">
          {ownerLabel.slice(0, 8)}
        </text>
      </svg>
    </div>
  );
}
