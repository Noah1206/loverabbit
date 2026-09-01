"use client";

import { useEffect, useRef, useState } from "react";

import type { TextOverlay, WebtoonPanelData } from "@/lib/webtoon-saju";
import { FREE_PANEL_COUNT } from "@/lib/webtoon-saju";

// 웹툰 패널 — 그림과 글이 별도 레이어다.
// 그림에는 캐릭터·배경만 있고, 문장은 전부 여기 오버레이가 % 좌표로 그린다.
// 그래서 카피를 바꿔도 이미지 재생성이 없고, 390px 모바일에서도 위치가 유지된다.

/**
 * 말풍선 모양. CSS 라운드 사각형이 아니라 SVG 타원이다.
 *
 * 꼬리가 몸통에서 이어져 나온 하나의 도형이어야 웹툰처럼 보인다 — 사각형에
 * 삼각형을 붙이면 붙인 티가 난다. 연속 대사의 앞 풍선은 꼬리 없는 순수 타원을
 * 쓴다(앞 풍선 꼬리가 뒤 풍선을 뚫는다).
 */
function BubbleShape({ tail }: { tail?: TextOverlay["tail"] }) {
  if (!tail) {
    return (
      <svg viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="100" cy="60" rx="96" ry="56" fill="#fff" stroke="#3a3a3a" strokeWidth="2.5" />
      </svg>
    );
  }
  const d =
    tail === "bottom-left"
      ? "M100,4 C155,4 196,26 196,60 C196,94 155,116 100,116 L74,116 L54,148 L58,114 C22,107 4,94 4,60 C4,26 45,4 100,4 Z"
      : "M100,4 C155,4 196,26 196,60 C196,94 155,116 100,116 L126,116 L146,148 L142,114 C110,110 4,94 4,60 C4,26 45,4 100,4 Z";
  return (
    <svg viewBox="0 0 200 150" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="#fff" stroke="#3a3a3a" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function WebtoonTextOverlay({ overlay }: { overlay: TextOverlay }) {
  const style: React.CSSProperties = {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    textAlign: overlay.align ?? "left",
  };

  if (overlay.type === "speech") {
    // 글자는 몸통 안에만 앉힌다. 꼬리가 있으면 그 높이만큼 빼야 글이 꼬리로 흘러내리지 않는다.
    const textHeight = overlay.tail ? `${(130 / 150) * 100}%` : "100%";
    return (
      <div className="webtoon-bubble" style={style}>
        <BubbleShape tail={overlay.tail} />
        <div className="webtoon-bubble-text" style={{ height: textHeight }}>
          {overlay.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`webtoon-text-overlay overlay-${overlay.type} tone-${overlay.tone ?? "system"}`} style={style}>
      {overlay.text}
    </div>
  );
}

export function WebtoonPanel({
  panel,
  index,
  locked = false,
}: {
  panel: WebtoonPanelData;
  index: number;
  locked?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      className={`webtoon-panel${locked ? " is-locked" : ""}${inView ? " is-inview" : ""}`}
      aria-label={`${index + 1}번째 웹툰 패널`}
    >
      {/* 사주 그림은 외부 최적화 대상이 아니라 정적 자산 — next/image 대신 img (기존 리딩 화면과 같은 방식) */}
      <img
        className="webtoon-panel-image"
        src={panel.imageUrl}
        alt={panel.alt}
        loading={index < 2 ? "eager" : "lazy"}
      />
      <div className="webtoon-panel-overlay" aria-live={index === 0 ? "polite" : undefined}>
        {panel.overlays.map((overlay) => (
          <WebtoonTextOverlay key={overlay.id} overlay={overlay} />
        ))}
      </div>
      {locked && (
        <div className="webtoon-panel-lock">
          <span aria-hidden="true">🔒</span>
          <span>상세 분석 후 공개</span>
        </div>
      )}
    </article>
  );
}

export function WebtoonPanelViewer({
  panels,
  unlocked,
}: {
  panels: WebtoonPanelData[];
  unlocked: boolean;
}) {
  return (
    <section className="webtoon-panel-viewer" aria-label="웹툰 사주 패널">
      {panels.map((panel, index) => (
        <WebtoonPanel key={panel.id} panel={panel} index={index} locked={!unlocked && index >= FREE_PANEL_COUNT} />
      ))}
    </section>
  );
}
