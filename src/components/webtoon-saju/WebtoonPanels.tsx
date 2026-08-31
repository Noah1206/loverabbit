"use client";

import { useEffect, useRef, useState } from "react";

import type { TextOverlay, WebtoonPanelData } from "@/lib/webtoon-saju";
import { FREE_PANEL_COUNT } from "@/lib/webtoon-saju";

// 웹툰 패널 — 그림과 글이 별도 레이어다.
// 그림에는 캐릭터·배경만 있고, 문장은 전부 여기 오버레이가 % 좌표로 그린다.
// 그래서 카피를 바꿔도 이미지 재생성이 없고, 390px 모바일에서도 위치가 유지된다.

export function WebtoonTextOverlay({ overlay }: { overlay: TextOverlay }) {
  const style: React.CSSProperties = {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    textAlign: overlay.align ?? "left",
  };
  return (
    <div className={`webtoon-text-overlay overlay-${overlay.type} tone-${overlay.tone ?? "system"}`} style={style}>
      {overlay.type === "speech" ? <div className="webtoon-speech-bubble">{overlay.text}</div> : overlay.text}
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
