"use client";

// 지도 오프닝 — 초대 링크로 들어온 사람이 폼을 만나기 전에 보는 한 장면.
//
// 왜 있나: 카카오에서 넘어온 사람은 "여기가 뭐 하는 곳인지" 모르는 채로
// 생년월일을 요구받는다. 그 전에 지도가 펼쳐지는 것을 한 번 보여주면
// 무엇에 참여하는지가 말없이 전해진다.
//
// 규칙 셋 (지시문 6항):
//   1. 4~6초를 넘기지 않는다. 이미 참여자가 있는 지도는 1초로 줄인다.
//   2. 건너뛸 수 있어야 한다 — 버튼과 Escape 둘 다.
//   3. 계산을 기다리는 화면으로 쓰지 않는다. 장식이고, 끝나면 폼이 온다.
//
// 애니메이션은 CSS 로만 한다. 이 저장소에는 framer-motion 이 없고,
// 이 정도 장면에 라이브러리를 하나 들이는 것은 값이 맞지 않는다.

import { useEffect, useRef, useState } from "react";

export type GuinIntroMode = "full" | "compact";

/** 각 장면이 시작하는 시각(ms). 마지막 값이 오프닝 전체 길이다.
 *  지시문 6항: full 은 4~6초, compact 은 1초 안. 테스트가 이 표를 잰다. */
export const INTRO_BEATS: Record<GuinIntroMode, readonly [number, number, number, number]> = {
  // 영상 박자에 맞춘다: ~2.5s까지 토끼가 마개를 밀고, ~4.5s에 지도가 평평해진다.
  // 이름·노드는 지도가 다 펼쳐진 뒤(phase 3)에만 얹는다 — 토끼 위에 얹으면 가린다.
  full: [600, 2000, 4600, 5800],
  compact: [80, 220, 380, 900],
};

/** 노드가 앉는 자리. 지도 컴포넌트와 같은 원형 배치를 쓴다 —
 *  마지막 프레임이 실제 지도와 어긋나면 두 화면으로 읽힌다. */
function nodeSpots(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(count, 1) - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * 32, y: 50 + Math.sin(angle) * 32 };
  });
}

export default function GuinMapIntro({
  ownerNickname,
  existingNodeCount,
  mode,
  onDone,
}: {
  ownerNickname: string;
  existingNodeCount: number;
  mode: GuinIntroMode;
  onDone: (how: "completed" | "skipped") => void;
}) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  // Higgsfield 배경 영상. 404·자동재생 차단·인앱 브라우저에서 실패하면
  // 아래 CSS 장면만 남는다 — 그게 폴백이고, 이미 그 자체로 완결된 오프닝이다.
  const [videoOk, setVideoOk] = useState(true);
  // onDone 이 매 렌더 새 함수여도 타이머가 다시 깔리지 않게 붙잡아 둔다.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // 모션을 줄여 달라고 한 기기에서는 장면을 건너뛴다. 여기서 굳이
    // 짧게 보여줄 이유가 없다 — 폼이 목적지다.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      doneRef.current("skipped");
      return;
    }

    const beat = INTRO_BEATS[mode];
    const timers = beat.map((ms, i) =>
      window.setTimeout(() => {
        if (i < 3) setPhase((i + 1) as 1 | 2 | 3);
        else doneRef.current("completed");
      }, ms)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [mode]);

  // 떠 있는 동안 탭바를 감춘다 — 위 CSS 가 이 표시를 본다. 언마운트 때
  // 반드시 지운다. 남으면 지도로 돌아와도 탭바가 사라진 채가 된다.
  useEffect(() => {
    document.body.dataset.guinIntro = "1";
    return () => {
      delete document.body.dataset.guinIntro;
    };
  }, []);

  // Escape 로도 건너뛴다 — 키보드만 쓰는 사람에게 버튼만 두면 갇힌다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") doneRef.current("skipped");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const spots = nodeSpots(Math.min(existingNodeCount, 5));

  return (
    <div className="guin-intro" role="dialog" aria-label="귀인 지도가 펼쳐지는 중">
      {/* 위아래 검은 띠 — 가운데 지도만 남기고 시야를 좁힌다 */}
      <div className="guin-intro-bar" aria-hidden />

      <div className="guin-intro-stage">
        {/* 배경 영상 — Higgsfield 로 한 번 뽑아 둔 고정 에셋. 사용자별 텍스트는
            영상에 없고, 이름·노드는 그 위에서 웹앱이 그린다. */}
        {videoOk && (
          <video
            className={`guin-intro-video${phase >= 1 ? " is-open" : ""}`}
            src="/assets/guin-map/opening.mp4"
            poster="/assets/guin-map/opening-poster.webp"
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden
            onError={() => setVideoOk(false)}
            onLoadedMetadata={(e) => {
              if (mode !== "full") e.currentTarget.currentTime = 5.2;
            }}
          />
        )}
        <div className={`guin-intro-field${phase >= 1 ? " is-open" : ""}`} aria-hidden>
          {/* 가운데 — 지도 주인 */}
          <span className={`guin-intro-owner${phase >= 3 ? " is-in" : ""}`}>
            {ownerNickname}
          </span>

          {/* 이미 들어와 있는 사람들 */}
          {spots.map((spot, i) => (
            <span
              key={i}
              className={`guin-intro-node${phase >= 3 ? " is-in" : ""}`}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                transitionDelay: `${i * 110}ms`,
              }}
            />
          ))}
        </div>

        <p className={`guin-intro-copy${phase >= 2 ? " is-in" : ""}`}>
          {phase >= 2
            ? `${ownerNickname}님의 귀인 지도`
            : "인연 지도를 펼치는 중…"}
        </p>
      </div>

      <div className="guin-intro-bar" aria-hidden />

      <button type="button" className="guin-intro-skip" onClick={() => doneRef.current("skipped")}>
        건너뛰기
      </button>
    </div>
  );
}
