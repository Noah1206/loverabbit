"use client";

// 지도에서 사람을 누르면 아래에서 올라오는 시트.
//
// 지도 아래 관계 카드 목록에도 같은 내용이 있다. 그런데 지도에서 누른 사람이
// 목록 어딘가에서 열리면, 누른 사람은 무엇이 바뀌었는지 모른 채 스크롤을
// 내려야 한다. 누른 자리에서 답이 나와야 한다.
//
// 리딩 뷰어의 서랍(rv-drawer)과 같은 재질·같은 애니메이션을 쓴다 — 이 서비스에
// 이미 있는 시트가 그것 하나이고, 두 번째 모양을 만들면 두 벌이 된다.

import { ROLE_DOT } from "@/components/GuinMapBackground";
import { statusLine } from "@/lib/saju-map-view";
import type { GuinNodeView } from "@/lib/guin-map";

export default function SajuPersonSheet({
  node,
  onClose,
  onShare,
  onDeepDive,
}: {
  node: GuinNodeView | null;
  onClose: () => void;
  /** 이 사람에게 결과를 보낸다. 주인에게만 넘어온다 — 남의 결과를 남이 뿌리지 않게. */
  onShare?: (node: GuinNodeView) => void;
  /** 유료 상세로 넘어간다. 주인에게만 넘어온다 — 두 사람의 값을 들고 가야 해서. */
  onDeepDive?: (node: GuinNodeView) => void;
}) {
  if (!node) return null;
  const relation = statusLine(node.contextStatus);

  return (
    <div className="rv-drawer" role="dialog" aria-label={`${node.nickname}님과의 인연`} onClick={onClose}>
      <div className="rv-drawer-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `2px solid ${ROLE_DOT[node.role]}`,
              display: "grid",
              placeItems: "center",
              fontSize: "0.9rem",
            }}
          >
            🐰
          </span>
          <strong style={{ flex: 1 }}>{node.nickname}</strong>
          <button type="button" className="rv-icon" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {relation && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: 8 }}>
            {node.nickname}님이 알려준 지금 관계 · {relation}
          </p>
        )}

        <span className="badge">{node.roleLabel} 인연</span>
        <p style={{ margin: "10px 0 0", fontSize: "0.94rem", lineHeight: 1.6 }}>{node.roleTagline}</p>

        {/* 점수 — 지도 설정에서 가려 두었으면 아예 그리지 않는다 */}
        {typeof node.score === "number" && (
          <div className="sm-sheet-score">
            <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>나와의 궁합</span>
            <b>{node.score}점</b>
            <div className="sm-sheet-meter" role="img" aria-label={`궁합 ${node.score}점`}>
              <span style={{ width: `${Math.min(100, Math.max(4, node.score))}%` }} />
            </div>
            {node.scoreBand && (
              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{node.scoreBand}</span>
            )}
          </div>
        )}

        {node.strengths.length > 0 && (
          <>
            <p style={{ fontWeight: 700, fontSize: "0.86rem", marginTop: 14 }}>이 인연의 좋은 점</p>
            <ul style={{ margin: "6px 0 0 18px", fontSize: "0.86rem", lineHeight: 1.6 }}>
              {node.strengths.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </>
        )}

        {node.cautions.length > 0 && (
          <>
            <p style={{ fontWeight: 700, fontSize: "0.86rem", marginTop: 12 }}>살펴볼 점</p>
            <ul style={{ margin: "6px 0 0 18px", fontSize: "0.86rem", lineHeight: 1.6 }}>
              {node.cautions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </>
        )}

        {/* 거꾸로 — 이 사람에게 나는 무엇인가. 정방향을 뒤집은 문구가 아니라 따로 계산한 값이다. */}
        {node.reverse && (
          <div className="card" style={{ padding: 14, marginTop: 14, background: "var(--bg-card2)" }}>
            <strong style={{ fontSize: "0.88rem" }}>
              {node.nickname}님에게 나는 {node.reverse.roleLabel} 인연
            </strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginTop: 4 }}>
              {node.reverse.roleTagline}
            </p>
          </div>
        )}

        {/*
          결과를 그 사람에게 보낸다 (2026-09-08).

          "공유하기" 가 아니라 **누구에게** 보내는지를 적는다 — 받는 사람이
          정해져 있으면 누르는 손이 달라진다. 링크에는 이 사람의 id 가 실려,
          받은 사람은 폼 대신 자기 결과를 먼저 본다.
        */}
        {/*
          유료 상세 — 무료는 WHAT, 유료는 WHY (2026-09-08).

          무료 결과를 일부러 흐리게 만들지 않는다. 위에서 "이 사람은 이런 인연,
          궁합 몇 점" 까지 분명히 말했다. 여기서 파는 것은 **왜 그런가** 다.
          두 사람의 생년월일은 이미 있으니 다시 묻지 않는다.
        */}
        {onDeepDive && (
          <div className="sm-deepdive">
            <strong>왜 {node.nickname}님이 나에게 {node.roleLabel} 인연일까?</strong>
            <ul>
              <li>서로에게 끌리는 이유</li>
              <li>누가 관계의 주도권을 가지는지</li>
              <li>가까워질수록 생기는 변화</li>
              <li>가장 조심해야 하는 시기</li>
            </ul>
            <button className="btn" onClick={() => onDeepDive(node)}>
              두 사람의 상세 궁합 보기
            </button>
          </div>
        )}

        {onShare && (
          <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={() => onShare(node)}>
            {node.nickname}님에게 이 결과 보내기
          </button>
        )}

        {node.conversationPrompt && (
          <p
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: "var(--r-lg)",
              background: "var(--tint-1)",
              fontSize: "0.86rem",
              lineHeight: 1.6,
            }}
          >
            <b>다음에 만나면 </b>
            {node.conversationPrompt}
          </p>
        )}
      </div>
    </div>
  );
}
