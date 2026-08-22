"use client";

import { useEffect, useRef, useState } from "react";

import { hasCardMotion } from "@/lib/card-motion";

// 카드 그림 위에 그 장면의 짧은 영상을 얹는다. 정지 그림은 그대로 두고 그 위에
// 겹치는 방식이다 - 영상이 없는 카드도, 자동재생을 막은 브라우저도, 자바스크립트가
// 아직 안 온 첫 화면도 전부 지금까지와 똑같이 보인다.
//
// 영상 첫 프레임이 곧 원본 그림이라, 재생 준비가 끝나는 순간 겹쳐 띄우면
// 갈아끼우는 티가 나지 않는다.

type Props = {
  category: string;
  /** 아래 깔린 정지 그림과 같은 잘림 위치를 줘야 켜질 때 그림이 튀지 않는다 */
  objectPosition?: string;
  className?: string;
};

export default function CardMotion({ category, objectPosition = "center 18%", className }: Props) {
  const enabled = hasCardMotion(category);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const node = videoRef.current;
    if (!node) return;

    // 움직임을 줄여달라고 설정한 사람에게는 틀지 않는다. 데이터 절약 모드도 같다 -
    // 클립 한 편이 수백 KB인데, 아껴 쓰겠다고 켜둔 사람 몰래 태울 이유가 없다.
    const quiet = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (quiet || saveData) return;

    // 화면에 들어오기 전에는 내려받지 않는다. preload="none" 이라 src 를 붙여도
    // play() 하기 전까지는 한 바이트도 안 받는다.
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
  }, [enabled]);

  useEffect(() => {
    if (!armed) return;
    // 자동재생을 막는 브라우저면 조용히 실패시킨다. 그 경우 정지 그림 그대로다.
    videoRef.current?.play().catch(() => {});
  }, [armed]);

  if (!enabled) return null;

  return (
    <video
      ref={videoRef}
      className={`card-motion${ready ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      src={armed ? `/cards-motion/${category}.mp4` : undefined}
      style={{ objectPosition }}
      muted
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      onError={() => setReady(false)}
    />
  );
}
