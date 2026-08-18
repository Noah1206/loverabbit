"use client";

import type { CSSProperties } from "react";

import {
  scatter,
  shrineEntrance,
  shrineGateVars,
  type ShrineMotif,
} from "@/lib/shrine-entrance";

// 신당 관문 — 입장 화면(/shrine/[id])과 대화 화면(/shrine/[id]/chat) 사이를 잇는 전환 연출.
//
// phase="depart"  입장 버튼을 누른 순간. 소품이 화면을 덮고 카메라가 신당 안으로 밀고 들어간다.
// phase="arrive"  대화 화면이 열린 직후. 같은 소품이 같은 방향으로 더 커지며 흩어져 사라진다.
//
// 두 화면이 하나의 카메라 이동처럼 이어지도록, 방향(커짐)과 문양 위치를 양쪽에서 맞춘다.

type Phase = "depart" | "arrive";

// 소품별로 필요한 조각 수 — 하나의 연출 언어를 쓰되 밀도만 다르다.
const PIECES: Record<ShrineMotif, number> = {
  ember: 18,
  lotus: 10,
  ink: 7,
  mirror: 12,
  gilt: 9,
  petal: 16,
  bell: 5,
  seal: 7,
  tide: 7,
  thread: 6,
  candle: 8,
};

function pieceStyle(motif: ShrineMotif, i: number): CSSProperties {
  const a = scatter(i);
  const b = scatter(i + 47);
  const c = scatter(i + 91);

  // --d 시작 지연 / --x 가로 흐름 / --s 크기 / --r 회전 — 소품마다 뜻이 조금씩 다르다.
  switch (motif) {
    case "ember":
      return {
        left: `${6 + a * 88}%`,
        ["--d" as string]: `${b * 260}ms`,
        ["--x" as string]: `${(c - 0.5) * 90}px`,
        ["--s" as string]: `${0.55 + b * 1.15}`,
      };
    case "petal":
      return {
        left: `${4 + a * 92}%`,
        ["--d" as string]: `${b * 340}ms`,
        ["--x" as string]: `${(c - 0.5) * 120}px`,
        ["--s" as string]: `${0.6 + b * 0.9}`,
        ["--r" as string]: `${(c - 0.5) * 420}deg`,
      };
    case "ink":
      return {
        left: `${12 + a * 76}%`,
        top: `${16 + b * 62}%`,
        ["--d" as string]: `${c * 300}ms`,
        ["--s" as string]: `${1 + a * 1.6}`,
      };
    case "mirror":
      return {
        ["--d" as string]: `${a * 180}ms`,
        ["--r" as string]: `${(i / PIECES.mirror) * 360}deg`,
        ["--x" as string]: `${140 + b * 220}px`,
        ["--s" as string]: `${0.5 + c * 1.1}`,
      };
    case "gilt":
      return {
        ["--d" as string]: `${a * 220}ms`,
        ["--r" as string]: `${(i / PIECES.gilt) * 360 + b * 22}deg`,
        ["--s" as string]: `${0.6 + c * 0.8}`,
      };
    case "bell":
    case "lotus":
      return {
        ["--d" as string]: `${i * 110}ms`,
        ["--s" as string]: `${0.8 + a * 0.6}`,
        ["--r" as string]: `${(i / PIECES.lotus) * 360}deg`,
      };
    case "seal":
      return {
        ["--d" as string]: `${380 + a * 160}ms`,
        ["--r" as string]: `${(i / PIECES.seal) * 360}deg`,
        ["--s" as string]: `${0.7 + b * 0.7}`,
      };
    case "tide":
      return {
        top: `${18 + (i / PIECES.tide) * 66}%`,
        ["--d" as string]: `${i * 90}ms`,
        ["--s" as string]: `${0.7 + a * 0.7}`,
      };
    case "thread":
      return {
        top: `${14 + (i / PIECES.thread) * 70}%`,
        ["--d" as string]: `${i * 80}ms`,
        ["--r" as string]: `${(a - 0.5) * 26}deg`,
      };
    case "candle":
      return {
        left: `${34 + a * 32}%`,
        ["--d" as string]: `${b * 320}ms`,
        ["--x" as string]: `${(c - 0.5) * 70}px`,
        ["--s" as string]: `${0.7 + b * 0.9}`,
      };
    default:
      return {};
  }
}

// 소품 조각에 붙는 클래스 — CSS가 소품별 움직임을 갖는다.
const PIECE_CLASS: Record<ShrineMotif, string> = {
  ember: "gate-spark",
  lotus: "gate-petalring",
  ink: "gate-blot",
  mirror: "gate-shard",
  gilt: "gate-crack",
  petal: "gate-petal",
  bell: "gate-ring",
  seal: "gate-sealcrack",
  tide: "gate-band",
  thread: "gate-thread",
  candle: "gate-smoke",
};

export default function ShrineTransition({
  characterId,
  shrineName,
  phase,
}: {
  characterId: string;
  shrineName: string;
  phase: Phase;
}) {
  const { motif, sigil, incantation } = shrineEntrance(characterId);
  const pieces = Array.from({ length: PIECES[motif] }, (_, i) => i);

  return (
    <div
      className="shrine-gate"
      data-phase={phase}
      data-motif={motif}
      style={shrineGateVars(characterId)}
      aria-hidden={phase === "arrive"}
      role={phase === "depart" ? "status" : undefined}
    >
      {/* 장막 — 신당 색의 어둠이 닫혔다가(depart) 열린다(arrive) */}
      <div className="shrine-gate-veil" />

      {/* 소품 — 신당마다 다른 것이 화면을 덮는다 */}
      <div className="shrine-gate-motif">
        {/* 촛불·연꽃·봉인은 중심에 놓이는 본체가 하나씩 있다 */}
        {motif === "candle" && <span className="gate-flame" />}
        {motif === "seal" && <span className="gate-stamp" />}
        {motif === "thread" && <span className="gate-knot" />}
        {motif === "lotus" && <span className="gate-water" />}
        {motif === "mirror" && <span className="gate-crescent" />}
        {pieces.map((i) => (
          <span key={i} className={PIECE_CLASS[motif]} style={pieceStyle(motif, i)} />
        ))}
      </div>

      {/* 문양과 한마디 — 두 화면을 잇는 매개. 관문에서 자리를 잡고 대화 화면에서 흩어진다 */}
      <div className="shrine-gate-seal">
        <span className="shrine-gate-sigil">{sigil}</span>
        {phase === "depart" && (
          <>
            <strong className="shrine-gate-name">{shrineName}</strong>
            <p className="shrine-gate-line">{incantation}</p>
            <span className="visually-hidden">{shrineName}으로 들어가는 중</span>
          </>
        )}
      </div>
    </div>
  );
}
