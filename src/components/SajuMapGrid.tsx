"use client";

import RoleFace from "@/components/RoleFace";
import { ROLE_DOT } from "@/components/GuinMapBackground";
import type { GuinNodeView } from "@/lib/guin-map";

/*
  사주지도의 사람들 — 사전처럼 펴 놓은 격자 (2026-09-09 운영자).

  전에는 별자리 그림이었다. 방위와 거리로 관계를 말하는 방식은 예뻤지만 두
  가지를 못 했다: 사람이 늘수록 이름이 겹쳐 읽을 수 없었고, "내가 누구를
  등록했더라" 를 한눈에 못 봤다. 지도는 관계를 **느끼게** 하는 그림이고,
  이 화면이 먼저 해야 하는 일은 등록한 사람을 **세는** 것이다.

  격자를 릴스처럼 세 칸으로 두는 이유: 세 칸이면 얼굴이 알아볼 만큼 크면서
  한 화면에 아홉이 들어온다. 두 칸은 앨범처럼 느긋해지고 네 칸은 얼굴이
  뭉갠다.

  **점수 순으로 세운다.** 가장 가까운 사람이 왼쪽 위, 그 다음이 오른쪽으로.
  사전이라면 가나다순이 맞겠지만 여기서 사람이 찾는 것은 이름이 아니라
  "누가 나와 가까운가" 다. 점수가 가려진 지도(showScores 꺼짐)에서는 들어온
  순서를 그대로 둔다 — 없는 값으로 순위를 지어내지 않는다.
*/

/** 첫 칸에만 다는 표식. 점수가 있을 때만 — 없으면 1등을 말할 근거가 없다. */
function topBadgeOf(node: GuinNodeView, index: number): string | null {
  if (index !== 0 || node.score === null) return null;
  return "가장 가까움";
}

export default function SajuMapGrid({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: GuinNodeView[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) return null;

  // 점수가 있는 지도만 정렬한다. null 이 섞이면 순위가 거짓이 된다.
  const sortable = nodes.every((n) => n.score !== null);
  const ordered = sortable
    ? [...nodes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : nodes;

  return (
    <section className="smg" aria-label="지도에 등록한 사람">
      <div className="smg-grid">
        {ordered.map((node, index) => {
          const badge = topBadgeOf(node, index);
          return (
            <button
              key={node.id}
              type="button"
              className={`smg-cell${selectedId === node.id ? " on" : ""}`}
              onClick={() => onSelect(node.id)}
            >
              {/* 얼굴은 역할에 붙은 그림이다 — 상대의 띠가 아니다.
                  상대 생년월일은 봉인 저장이라 화면에 온 적이 없다. */}
              <span className="smg-face" style={{ background: `${ROLE_DOT[node.role]}22` }}>
                <RoleFace role={node.role} size={46} />
                {node.score !== null && <b className="smg-score">{node.score}</b>}
              </span>
              <span className="smg-name">{node.nickname}</span>
              <span className="smg-role">
                <i aria-hidden style={{ background: ROLE_DOT[node.role] }} />
                {node.roleLabel}
              </span>
              {badge && <span className="smg-top">{badge}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
