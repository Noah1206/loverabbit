"use client";

import type { ReactNode } from "react";

import AdultToggle from "@/components/AdultToggle";
import CharacterMotion from "@/components/CharacterMotion";
import ShrineAudioToggle from "@/components/ShrineAudioToggle";
import { DEFAULT_EMOTION, type Emotion } from "@/lib/character-emotions";
import type { Dorang } from "@/lib/characters";

// 신당 무대 — 입장 화면과 대화 화면이 공유하는 배경·장막·상단 바.
// 두 페이지가 같은 무대를 쓰기 때문에, 페이지가 바뀌어도 도령은 그 자리에 그대로 서 있다.
export default function ShrineStage({
  character,
  onBack,
  dim,
  phase,
  emotion = DEFAULT_EMOTION,
  children,
}: {
  character: Dorang;
  onBack: () => void;
  dim: boolean; // 대화 중에는 배경을 낮춰 말풍선을 살린다
  phase: "departing" | "arriving" | null; // 전환 중 카메라 방향
  emotion?: Emotion; // 지금 짓고 있는 표정 — 대사가 바뀔 때마다 갈아탄다
  children: ReactNode;
}) {
  return (
    <div
      className={`shrine-immersive-shell${phase ? ` is-${phase}` : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "#0a0a0c",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 배경 — 도령 전신. 루프 영상이 있는 신당은 인물이 움직인다 */}
      <div
        aria-hidden
        className="shrine-stage-bg"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${character.img})`,
          backgroundSize: "cover",
          backgroundPosition: "center 10%",
          filter: dim ? "brightness(0.45)" : "brightness(0.85)",
          transition: "filter 0.8s",
        }}
      >
        {character.video && (
          <video
            src={character.video}
            poster={character.img}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%" }}
          />
        )}
        {/* 표정 클립은 배경 루프보다 위에 얹는다. 표정이 있는 신당은 대사에 따라
            얼굴이 바뀌고, 없는 신당은 기존 배경 루프(또는 정지 이미지) 그대로다. */}
        <CharacterMotion characterId={character.id} emotion={emotion} objectPosition="center 10%" />
      </div>

      <div
        aria-hidden
        className="shrine-stage-veil"
        style={{
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(circle at 50% 30%, ${character.theme.glow}, transparent 55%)`,
            "linear-gradient(180deg, rgba(10,7,16,0.75) 0%, transparent 25%, transparent 55%, rgba(10,7,16,0.92) 85%)",
          ].join(", "),
        }}
      />

      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
        }}
      >
        <button
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "none",
            color: "#fff",
            fontSize: "1.1rem",
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <strong style={{ color: "#fff", letterSpacing: "0.14em" }}>LOVERABBIT</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AdultToggle compact />
          <ShrineAudioToggle src={character.bgm} shrineName={character.title} />
        </div>
      </header>

      {children}
    </div>
  );
}
