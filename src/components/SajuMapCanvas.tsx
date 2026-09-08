"use client";

// 사주지도의 지도 — 나를 가운데 두고 인연이 둘러앉는다.
//
// 배경에 깔린 별자리(GuinMapBackground)와는 다른 물건이다. 그쪽은 만지지 못하는
// 그림이고, 이쪽은 **누를 수 있는 사람들**이다. 그래서 노드가 button 이고,
// 이름과 역할이 낭독기에 그대로 읽힌다.
//
// 셋을 지킨다.
//   1. 사람이 먼저 보인다. 점수·축·간지는 눌러야 나온다.
//   2. 선은 기본적으로 아주 옅다. 고른 사람만 밝아진다.
//   3. 돌지 않는다. 등장할 때 한 번 뜨고 멈춘다 — 계속 도는 화면은 읽을 수 없다.

import { ROLE_DOT } from "@/components/GuinMapBackground";
import { layoutNodes, ROLE_HINT, sortForMap } from "@/lib/saju-map-view";
import type { GuinRole } from "@/lib/guin-map";

export interface MapPerson {
  id: string;
  nickname: string;
  role: GuinRole;
  roleLabel: string;
  score: number | null;
}

export default function SajuMapCanvas({
  meLabel,
  people,
  selectedId,
  dimmedIds,
  onSelect,
}: {
  meLabel: string;
  people: MapPerson[];
  selectedId: string | null;
  /** 필터에 걸러진 사람 — 지우지 않고 가라앉힌다. 지도에서 사라지면 몇 명인지가 흔들린다. */
  dimmedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const ordered = sortForMap(people);
  const spots = layoutNodes(ordered.map((p) => ({ id: p.id, role: p.role, score: p.score })));
  const at = new Map(spots.map((s) => [s.id, s]));

  return (
    <div className="sm-canvas">
      {/* 선 — 노드 아래에 깔린다. 장식이라 낭독기가 읽지 않는다. */}
      <svg className="sm-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {ordered.map((person, i) => {
          const spot = at.get(person.id);
          if (!spot) return null;
          const on = selectedId === person.id;
          const dim = dimmedIds.has(person.id);
          return (
            <line
              key={person.id}
              x1={50}
              y1={50}
              x2={spot.x}
              y2={spot.y}
              stroke={ROLE_DOT[person.role]}
              strokeOpacity={on ? 0.85 : dim ? 0.06 : 0.22}
              strokeWidth={on ? 0.7 : 0.35}
              className="sm-line"
              style={{ animationDelay: `${120 + i * 45}ms` }}
              pathLength={1}
            />
          );
        })}
      </svg>

      {/* 가운데 — 나 */}
      <div className="sm-me" style={{ left: "50%", top: "50%" }}>
        <span className="sm-me-face" aria-hidden>🐰</span>
        <b>{meLabel}</b>
      </div>

      {/* 사람 — 각각 버튼이다 */}
      {ordered.map((person, i) => {
        const spot = at.get(person.id);
        if (!spot) return null;
        const on = selectedId === person.id;
        const dim = dimmedIds.has(person.id);
        return (
          <button
            key={person.id}
            type="button"
            className={`sm-node${on ? " on" : ""}${dim ? " dim" : ""}`}
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              animationDelay: `${180 + i * 55}ms`,
            }}
            aria-pressed={on}
            onClick={() => onSelect(person.id)}
          >
            <span className="sm-node-dot" style={{ borderColor: ROLE_DOT[person.role] }}>
              <i aria-hidden>{ROLE_HINT[person.role]}</i>
            </span>
            <span className="sm-node-name">{person.nickname}</span>
            {/* 화면에는 이름만. 역할은 낭독기와 상세 시트가 말한다. */}
            <span className="sr-only">
              {person.roleLabel}
              {typeof person.score === "number" ? `, 궁합 ${person.score}점` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
