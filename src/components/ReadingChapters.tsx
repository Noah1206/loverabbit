"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ReadingChapter } from "@/lib/reading-chapters";
import type { ReadingConcept } from "@/lib/reading-concepts";

// 웹툰형 리딩 뷰어의 화면 조각들.
// 데이터·결제 상태는 전부 /reading/[id]가 들고 있고, 여기는 그리기만 한다.
// 분야마다 달라지는 것은 concept 하나뿐 — 구조는 모든 리딩이 같다.

export function conceptStyle(concept: ReadingConcept): CSSProperties {
  return {
    "--rv-ink": concept.ink,
    "--rv-ink2": concept.ink2,
  } as CSSProperties;
}

/** 인장 — 화면 곳곳에 찍히는 분야 표식 */
export function Seal({ concept, size = 34 }: { concept: ReadingConcept; size?: number }) {
  return (
    <span className="rv-seal" style={{ width: size, height: size }} aria-hidden>
      {concept.seal.slice(0, 1)}
      {concept.seal.slice(1, 2)}
    </span>
  );
}

export function ChapterTopBar({
  concept,
  kicker,
  title,
  onOpenIndex,
  onShare,
}: {
  concept: ReadingConcept;
  kicker: string;
  title: string;
  onOpenIndex: () => void;
  onShare: () => void;
}) {
  return (
    <header className="rv-top">
      <Seal concept={concept} />
      <span className="rv-top-copy">
        <strong>{title}</strong>
        <small>{kicker}</small>
      </span>
      <button type="button" className="rv-icon" onClick={onShare} aria-label="공유하기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.4 10.8 15.6 6.4M8.4 13.2l7.2 4.4" />
        </svg>
      </button>
      <button type="button" className="rv-icon" onClick={onOpenIndex} aria-label="목차 열기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </header>
  );
}

/** 장 표지 — 화자의 그림 위에 말풍선 하나. 웹툰 컷 자리다. */
export function ChapterPanel({
  concept,
  chapter,
  hook,
}: {
  concept: ReadingConcept;
  chapter: ReadingChapter;
  hook: string;
}) {
  return (
    <section className="rv-panel">
      <div className="rv-panel-art" style={{ backgroundImage: `url(${concept.portrait})` }} aria-hidden />
      <p className="rv-bubble">{hook}</p>
      <div className="rv-panel-title">
        <small>
          {chapter.label} · {concept.narrator}
        </small>
        <h1>{chapter.title}</h1>
      </div>
    </section>
  );
}

/** 장 본문 — "1) 소제목 + 본문 카드"가 반복된다 */
export function ChapterBody({ chapter }: { chapter: ReadingChapter }) {
  return (
    <div className="rv-body">
      {chapter.sections.map((section, index) => (
        <section key={`${section.title}-${index}`} className="rv-sec">
          {section.title && (
            <h2>
              <i aria-hidden>{section.order})</i>
              {section.title}
            </h2>
          )}
          {section.locked ? (
            <div className="rv-locked" aria-label="결제 후 공개되는 내용">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="rv-prose">
              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export interface ScoreFactorView {
  label: string;
  delta: number;
  basis: string;
}

/** 명식 카드 — 스크린샷의 "약한 부위 / 주의 시기" 판때기에 해당하는 자리 */
export function ChartPanel({
  chart,
  scoreLabel,
  score,
  scoreBand,
}: {
  chart: { me: string; partner: string | null };
  scoreLabel?: string | null;
  score?: number | null;
  scoreBand?: string | null;
}) {
  return (
    <dl className="rv-chart">
      <div>
        <dt>내 명식</dt>
        <dd>{chart.me}</dd>
      </div>
      {chart.partner && (
        <div>
          <dt>그 사람</dt>
          <dd>{chart.partner}</dd>
        </div>
      )}
      {scoreLabel && (
        <div>
          <dt>{scoreLabel}</dt>
          <dd>
            {typeof score === "number" ? (
              <>
                상위 {100 - score}%{scoreBand ? ` · ${scoreBand}` : ""}
              </>
            ) : (
              "상위 ??% 🔒"
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * 지수가 어디서 나왔는지. 숫자만 던지고 끝내면 근거 없는 점괘와 다르지 않으므로,
 * 해금한 사람에게는 명식의 어느 글자가 그 점수를 만들었는지 그대로 보여준다.
 */
export function ScoreBreakdown({
  scoreLabel,
  score,
  factors,
}: {
  scoreLabel?: string | null;
  score?: number | null;
  factors: ScoreFactorView[];
}) {
  if (typeof score !== "number" || factors.length === 0) return null;
  return (
    <section className="rv-score">
      <h2>
        {scoreLabel ?? "지수"} {score}점은 어디서 나왔나
      </h2>
      <ul>
        {factors.map((factor, index) => (
          <li key={`${factor.label}-${index}`} data-sign={factor.delta > 0 ? "up" : "down"}>
            <b>
              {factor.delta > 0 ? "+" : ""}
              {factor.delta}
            </b>
            <span>
              <strong>{factor.label}</strong>
              <small>{factor.basis}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface IndexItem {
  label: string;
  title: string;
  locked: boolean;
}

/** 목차 — 표지에 그대로 깔리고, 읽는 중에는 서랍으로 다시 열린다 */
export function ChapterIndex({
  items,
  current,
  onJump,
}: {
  items: IndexItem[];
  current: number;
  onJump: (page: number) => void;
}) {
  return (
    <ol className="rv-index">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          <button
            type="button"
            className={index + 1 === current ? "on" : ""}
            onClick={() => onJump(index + 1)}
          >
            <span>
              {item.label}. {item.title}
            </span>
            {item.locked && <i aria-label="잠김">🔒</i>}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function IndexDrawer({
  open,
  onClose,
  concept,
  productLabel,
  items,
  current,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  concept: ReadingConcept;
  productLabel: string;
  items: IndexItem[];
  current: number;
  onJump: (page: number) => void;
}) {
  if (!open) return null;
  return (
    <div className="rv-drawer" role="dialog" aria-label="목차" onClick={onClose}>
      <div className="rv-drawer-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <Seal concept={concept} size={30} />
          <strong>{productLabel}</strong>
          <button type="button" className="rv-icon" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <button type="button" className="rv-drawer-cover" onClick={() => onJump(0)}>
          표지로 돌아가기
        </button>
        <ChapterIndex
          items={items}
          current={current}
          onJump={(page) => {
            onJump(page);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

export function ChapterNavBar({
  page,
  total,
  onPrev,
  onNext,
  nextHint,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  nextHint?: string;
}) {
  return (
    <nav className="rv-bottom" aria-label="장 이동">
      <button type="button" className="rv-page-btn" onClick={onPrev} disabled={page <= 0} aria-label="이전 장">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <span className="rv-page-count">
        {page === 0 ? "표지" : `${page} / ${total}`}
      </span>
      <button type="button" className="rv-page-next" onClick={onNext} disabled={page >= total}>
        {nextHint ?? "다음 장"}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}

export function ChapterShell({
  concept,
  children,
}: {
  concept: ReadingConcept;
  children: ReactNode;
}) {
  return (
    <div className="rv" style={conceptStyle(concept)}>
      {children}
    </div>
  );
}
