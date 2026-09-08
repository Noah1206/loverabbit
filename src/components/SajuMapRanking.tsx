"use client";

// 귀인 TOP 3 — 사람이 셋 모이면 열린다.
//
// 이 카드가 하는 일은 둘이다.
//   1. 지금까지 넣은 사람들 사이에 순위를 매겨 "그래서 누가 1등인데" 에 답한다.
//   2. 셋이 안 되면 몇 명 남았는지 말해서 한 명 더 넣게 만든다.
//
// 점수는 이미 계산돼 있다(guin-calc). 여기서는 세우고 그리기만 한다.
// 점수가 가려진 지도에서는 순위 자체가 만들어지지 않는다 — 감춘 점수로
// 세운 순위를 보여주면 설정이 거짓말이 된다.

import {
  axisHighlights,
  RANK_UNLOCK_AT,
  topThree,
  untilRank,
  type AxisHighlight,
  type RankedPerson,
} from "@/lib/saju-map-view";
import type { GuinNodeView } from "@/lib/guin-map";

export default function SajuMapRanking({
  nodes,
  onOpen,
  onAdd,
}: {
  nodes: GuinNodeView[];
  onOpen: (nodeId: string) => void;
  /** 아직 셋이 안 될 때 눌러서 사람을 더 넣는다. 주인이 아니면 넘기지 않는다. */
  onAdd?: () => void;
}) {
  const ranked: RankedPerson[] = topThree(nodes);

  // 아직 순위가 안 열렸다 — 몇 명 남았는지만 말한다.
  if (ranked.length === 0) {
    const left = untilRank(nodes.filter((n) => typeof n.score === "number").length);
    // 점수가 통째로 가려진 지도에서는 순위 이야기를 꺼내지 않는다.
    if (left === 0) return null;
    return (
      <section className="card sm-rank-locked">
        <span aria-hidden>🔒</span>
        <b>{left}명만 더 추가하면 내 귀인 순위가 열려요</b>
        {onAdd && (
          <button type="button" className="btn" onClick={onAdd}>
            인연 추가하기
          </button>
        )}
      </section>
    );
  }

  const highlights: AxisHighlight[] = axisHighlights(nodes);

  return (
    <section className="card sm-rank">
      <span className="badge">내 귀인 TOP {ranked.length}</span>
      <ol className="sm-rank-list">
        {ranked.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => onOpen(person.id)}>
              <i aria-hidden>{person.medal}</i>
              <span className="sm-rank-body">
                <b>
                  {person.nickname}
                  <em>{person.score}</em>
                </b>
                <small>{person.tagline}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* 순위 밖의 다른 이야기 — 축이 다르면 1등도 다르다 */}
      {highlights.length > 0 && (
        <div className="sm-rank-extra">
          {highlights.map((item) => (
            <button key={item.title} type="button" onClick={() => onOpen(item.nodeId)}>
              <i aria-hidden>{item.emoji}</i>
              <span>
                <small>{item.title}</small>
                <b>{item.nickname}</b>
              </span>
            </button>
          ))}
        </div>
      )}

      {nodes.length < 5 && onAdd && (
        <p className="sm-rank-more">
          {5 - nodes.length}명을 더 추가하면 내 인간관계 유형이 열려요
        </p>
      )}
    </section>
  );
}

export { RANK_UNLOCK_AT };
