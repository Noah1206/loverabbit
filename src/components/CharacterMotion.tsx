"use client";

import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";
import { DEFAULT_EMOTION, type Emotion } from "@/lib/character-emotions";
import { characterMotionSrc } from "@/lib/character-motion";

// 신당 캐릭터를 움직이게 한다. 표정이 바뀌면 그 표정의 클립으로 갈아탄다.
//
// 카드 모션(CardMotion)과 같은 원칙: 정지 이미지 위에 겹치고, 준비가 끝나야 뜬다.
// 클립이 없으면 아무 일도 일어나지 않고 지금까지의 정지 화면 그대로다.
//
// 표정 클립이 아직 없는 감정은 평온(idle)으로 내려온다. 여덟 표정을 다 만들지
// 않아도 시스템이 먼저 돌아가야, 한 표정씩 채워 넣을 수 있다.

type Props = {
  characterId: string;
  emotion?: Emotion;
  objectPosition?: string;
  className?: string;
  /** 대화 화면처럼 계속 떠 있는 곳은 반복 재생, 홈 카드는 한 번만 */
  loop?: boolean;
};

export default function CharacterMotion({
  characterId,
  emotion = DEFAULT_EMOTION,
  objectPosition = "center 10%",
  className,
  loop = true,
}: Props) {
  const { adultMode } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);

  const src =
    characterMotionSrc(characterId, emotion, adultMode) ??
    characterMotionSrc(characterId, DEFAULT_EMOTION, adultMode);

  useEffect(() => {
    if (!src) return;
    const node = videoRef.current;
    if (!node) return;

    const quiet = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (quiet || saveData) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  // 표정이 바뀌면 새 클립을 처음부터 다시 튼다. 준비될 때까지 잠깐 걷어내
  // 아래 깔린 정지 이미지를 지나가게 한다 - 그게 자연스러운 표정 전환이 된다.
  useEffect(() => {
    if (!armed) return;
    const node = videoRef.current;
    if (!node) return;
    setReady(false);
    node.load();
    node.play().catch(() => {});
  }, [armed, src]);

  if (!src) return null;

  return (
    <video
      ref={videoRef}
      className={`character-motion${ready ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      src={armed ? src : undefined}
      style={{ objectPosition }}
      muted
      playsInline
      loop={loop}
      preload="none"
      aria-hidden
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      onError={() => setReady(false)}
    />
  );
}
