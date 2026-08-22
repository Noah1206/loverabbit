"use client";

import { Fragment, type ReactNode } from "react";
import type { ReadingChapter } from "@/lib/reading-chapters";
import type { ReadingConcept } from "@/lib/reading-concepts";
import { COLOR_MARKS, MARK_MEANING, parseMarks, stripMarks } from "@/lib/reading-marks";
import { toFactChip } from "@/lib/reading-fact-label";
import { artSlotOf } from "@/components/reading-art-slot";
import type { SectionExtra } from "@/lib/reading-extra";
import type { ReadingImage } from "@/lib/reading-image-shape";

// 리딩 뷰어의 화면 조각들 — 장(章)마다 한 페이지씩 넘겨 읽는다.
// 데이터·결제 상태는 전부 /reading/[id]가 들고 있고, 여기는 그리기만 한다.
//
// 이 화면이 하는 일은 하나다: **긴 글을 끝까지 읽게 하는 것.**
// 그래서 화자 그림도, 말풍선도, 분야별 색도 없다. 셋 다 본문 앞을 막고
// 시선을 가져갔지 읽는 데는 보태지 않았다. 남은 것은 제목·본문·근거뿐이다.

/**
 * 강조가 들어간 본문 한 덩어리.
 *
 * 표기를 조각으로 나눠 그린다. 문자열을 HTML로 밀어 넣지 않으므로,
 * 모델이 무엇을 써 보내든 태그로 해석될 일이 없다.
 * data-mark 는 CSS 가 색을 고르는 데 쓰고, title 은 마우스를 올렸을 때 뜻을 보여준다.
 */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {parseMarks(text).map((token, index) =>
        token.kind === "plain" ? (
          <span key={index}>{token.text}</span>
        ) : (
          <mark key={index} className="rv-mark" data-mark={token.kind} title={MARK_MEANING[token.kind]}>
            {token.text}
          </mark>
        )
      )}
    </>
  );
}

/**
 * 색이 무슨 뜻인지 알려주는 범례.
 *
 * 뜻을 모르는 색은 장식이다. 표지에 한 번 보여주고, 본문에서는 반복하지 않는다 —
 * 절마다 범례를 달면 그게 더 시끄럽다.
 */
export function MarkLegend() {
  return (
    <dl className="rv-legend" aria-label="본문 강조가 뜻하는 것">
      <div>
        <dt>
          <b>굵게</b>
        </dt>
        <dd>{MARK_MEANING["핵심"]}</dd>
      </div>
      {COLOR_MARKS.map((kind) => (
        <div key={kind}>
          <dt>
            <span className="rv-mark" data-mark={kind}>
              {kind}
            </span>
          </dt>
          <dd>{MARK_MEANING[kind]}</dd>
        </div>
      ))}
    </dl>
  );
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

/** 상단 바 — 지금 몇 장을 읽고 있는지가 늘 보여야 한다 */
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

/**
 * 장 머리 — 몇 장이고 무슨 장인지만 적는다.
 *
 * 예전에는 여기에 화자 그림 한 컷과 말풍선이 있었다. 본문에 닿기까지 한 화면을
 * 더 넘겨야 했고, 정작 그 말풍선은 아래 본문이 할 말을 미리 김빠지게 했다.
 */
export function ChapterPanel({ chapter }: { chapter: ReadingChapter }) {
  return (
    <section className="rv-panel">
      <small>{chapter.label}</small>
      <h1>{chapter.title}</h1>
    </section>
  );
}

/**
 * 장의 그림 한 장.
 *
 * 한 장에 60초가 걸려서 글보다 늦게 도착한다. 그동안 자리를 비워 두면 글이 위아래로
 * 뛰므로, 같은 크기의 틀을 먼저 깔고 그 안에서 바뀐다.
 * 실패했으면 **아무것도 그리지 않는다** — 빈 액자나 오류 표시를 남기면 읽는 흐름만 끊긴다.
 */
function ChapterArt({ image }: { image?: ReadingImage | null }) {
  if (!image || image.status === "failed") return null;
  if (image.status === "pending") {
    // 그림 크기(정사각형)로 자리를 비워 두지 않는다. 그림은 분 단위로 늦게 오고
    // 영영 안 올 수도 있는데, 화면 하나를 통째로 비워 두면 깨진 페이지로 읽힌다.
    // 작은 띠 하나가 "오는 중"만 말하고, 도착하면 그때 제 크기로 선다.
    return (
      <div className="rv-art-wait" role="status">
        삽화를 그리는 중이에요
      </div>
    );
  }
  return (
    <figure className="rv-art">
      {/* 생성 이미지라 next/image 의 최적화 대상이 아니다 — 주소가 매번 다르다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.alt ?? ""} loading="lazy" />
    </figure>
  );
}

/**
 * 절이 이미 말한 것을 다른 꼴로 다시 세운 덩어리.
 *
 * 새 내용이 아니다. 같은 모양이 열다섯 번 반복되면 내용과 무관하게 눈이 미끄러지는데,
 * 그걸 막으려고 절반쯤의 절에만 하나씩 얹는다. 무엇을 얹을지는 그 절을 쓴 모델이 고른다.
 */
function SectionExtraBlock({ extra }: { extra?: SectionExtra }) {
  if (!extra) return null;

  if (extra.kind === "quote") {
    return (
      <blockquote className="rv-quote">
        <Marked text={extra.text} />
      </blockquote>
    );
  }

  if (extra.kind === "contrast") {
    return (
      <dl className="rv-contrast">
        <div>
          <dt>나</dt>
          <dd>{extra.mine}</dd>
        </div>
        <div>
          <dt>상대</dt>
          <dd>{extra.theirs}</dd>
        </div>
      </dl>
    );
  }

  if (extra.kind === "timeline") {
    return (
      <ol className="rv-timeline">
        {extra.points.map((point, index) => (
          <li key={index}>
            <b>{point.when}</b>
            <span>{point.what}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="rv-checklist">
      {extra.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * 읽기 시작하는 자리에 놓는 목차.
 *
 * 결과가 나오면 표지가 아니라 **1장으로 바로 들어간다.** 목차를 먼저 보여주고
 * 고르게 하면, 아직 무슨 내용인지 모르는 사람에게 선택을 시키는 셈이라 첫 화면에서
 * 멈춘다. 대신 읽을 글 바로 위에 목차를 펼쳐 둔다 — 다른 장으로 가고 싶으면
 * 여기서 누르면 되고, 그냥 읽고 싶으면 아래로 내리면 된다.
 *
 * 1장에서만 보인다. 장마다 반복하면 그게 더 시끄럽고, 다른 장에서는 상단 바의
 * 목차 버튼(≡)이 같은 일을 한다.
 */
export function ChapterOutline({
  title,
  items,
  current,
  onJump,
}: {
  title: string;
  items: IndexItem[];
  current: number;
  onJump: (page: number) => void;
}) {
  return (
    <nav className="rv-outline" aria-label="목차">
      <h2>{title}</h2>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <button
              type="button"
              className={index + 1 === current ? "on" : ""}
              onClick={() => onJump(index + 1)}
              aria-current={index + 1 === current ? "true" : undefined}
            >
              {item.label}. {item.title}
              {item.locked && <i aria-label="잠김"> 🔒</i>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** 장 본문 — "1) 소제목" 한 줄 + 본문 카드가 반복된다 */
export function ChapterBody({ chapter, image }: { chapter: ReadingChapter; image?: ReadingImage | null }) {
  const artSlot = artSlotOf(chapter);
  return (
    <div className="rv-body">
      {chapter.sections.map((section, index) => (
        <Fragment key={`${section.title}-${index}`}>
        <section className="rv-sec">
          {/*
            번호와 제목은 한 덩어리다. 예전에는 번호만 다른 색으로 떼어놨는데,
            그러면 번호가 먼저 눈에 들어오고 제목이 뒤로 밀렸다.
          */}
          {section.title && <h2>{section.order ? `${section.order}) ${section.title}` : section.title}</h2>}
          {section.locked ? (
            <div className="rv-locked" aria-label="결제 후 공개되는 내용">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="rv-prose">
              {/*
                이 절의 답 한 줄. 소제목 다음, 본문보다 먼저 온다.
                1,200자를 다 읽어야 답이 나오면 그건 답을 미룬 것이다.
              */}
              {section.verdict && <p className="rv-verdict">{section.verdict}</p>}

              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex}>
                  <Marked text={paragraph} />
                </p>
              ))}

              <SectionExtraBlock extra={section.extra} />

              {section.watchOut && (
                // 이 칸은 통째로 '살펴볼 점'이라 안쪽에 색을 또 칠하지 않는다.
                // 강조 위에 강조를 얹으면 둘 다 강조가 아니게 된다.
                <p className="rv-watch">
                  <b>살펴볼 점</b>
                  {stripMarks(section.watchOut)}
                </p>
              )}

              {section.factsUsed.length > 0 && (
                // 이 절이 명식의 어느 값에 기대고 있는지. 지어낸 문장과 구분되는 자리다.
                // 오래 `strength.label=신약` 같은 내부 경로를 그대로 내보냈는데,
                // 본문에서는 구조 용어를 다 걷어내 놓고 그 아래에 원본을 남긴 셈이었다.
                <ul className="rv-facts" aria-label="이 절이 쓴 명식 근거">
                  {section.factsUsed.map((fact, fIndex) => {
                    const chip = toFactChip(fact);
                    return (
                      <li key={fIndex}>
                        <b>{chip.label}</b>
                        {chip.value && <span>{chip.value}</span>}
                        {chip.gloss && <i>{chip.gloss}</i>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
        {/* 여기쯤에서 눈이 쉰다. 다음 절로 넘어가기 전에 한 장. */}
        {index === artSlot && <ChapterArt image={image} />}
        </Fragment>
      ))}
    </div>
  );
}

export interface ScoreFactorView {
  label: string;
  delta: number;
  basis: string;
  /** 운에서 온 인자 — 발급 이후 해가 바뀌면 달라졌을 자리 */
  timeVarying?: boolean;
}

export interface ScoreAsOfView {
  majorLuck: { pillar: string; range: string; tenGod: string } | null;
  yearly: { year: number; pillar: string; tenGod: string };
  issuedAt: string;
}

/** 명식 카드 — 스크린샷의 "약한 부위 / 주의 시기" 판때기에 해당하는 자리 */
/**
 * 표지의 지수 한 줄.
 *
 * 원래 여기에 명식(사주 네 글자)이 함께 있었다. 한 줄로 쓰면 글자 뭉치라 아무것도
 * 전해지지 않았고, 네 기둥 표로 그렸더니 여덟 글자짜리 자리에 배경과 테두리가
 * 너무 많았다. 두 번 고치고 나서 뺐다 — 표지는 "이게 내 얘기구나"를 알려 주는
 * 자리이고 그 일은 요약 카드가 이미 한다. 명식은 그 위에 얹힌 장식이었다.
 *
 * 이름은 그대로 둔다. 부르는 자리가 둘이고, 이름을 바꾸는 것이 이 변경의 요지가
 * 아니다. chart 는 계속 받되 쓰지 않는다 — 되돌릴 때 호출부를 다시 안 고치려고.
 */
export function ChartPanel({
  scoreLabel,
  score,
  scoreBand,
}: {
  chart?: { me: string; partner: string | null };
  scoreLabel?: string | null;
  score?: number | null;
  scoreBand?: string | null;
}) {
  if (!scoreLabel) return null;
  // 지수는 결제 전에도 숫자까지 보여준다 (운영자 결정, 2026-08-22). 상세
  // 페이지의 게이지와 같은 문법(큰 퍼센트 + 그라데이션 바)을 쓰되 똑같이
  // 만들지는 않는다 - 저쪽은 "??%" 로 궁금하게 하는 판이고, 여기는 실제
  // 숫자를 주는 판이다. 숫자는 무료, 그 숫자의 근거(ScoreBreakdown)는 해금 뒤.
  // score 가 없는 옛 리딩은 예전처럼 잠금 표기로 남는다.
  return (
    <section className="rv-gauge" aria-label={scoreLabel}>
      <span className="rv-gauge-label">{scoreLabel}</span>
      <p className="rv-gauge-value">
        {typeof score === "number" ? (
          <>
            상위 <b>{100 - score}</b>
            <small>%</small>
          </>
        ) : (
          "상위 ??% 🔒"
        )}
      </p>
      {typeof score === "number" && (
        <>
          <div className="rv-gauge-meter" aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(4, score))}%` }} />
          </div>
          {scoreBand && <p className="rv-gauge-band">{scoreBand}</p>}
        </>
      )}
    </section>
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
  asOf,
}: {
  scoreLabel?: string | null;
  score?: number | null;
  factors: ScoreFactorView[];
  asOf?: ScoreAsOfView | null;
}) {
  if (typeof score !== "number" || factors.length === 0) return null;
  // 운에서 온 인자가 섞여 있으면 이 숫자는 "그때의" 값이다. 봉인돼 있으니 지금도
  // 같은 숫자지만, 왜 고정인지는 밝혀둔다.
  const timeBound = factors.some((factor) => factor.timeVarying);
  const issued = asOf?.issuedAt ? new Date(asOf.issuedAt) : null;
  const issuedText =
    issued && !Number.isNaN(issued.getTime())
      ? `${issued.getFullYear()}년 ${issued.getMonth() + 1}월 ${issued.getDate()}일`
      : null;
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
              <strong>
                {factor.label}
                {factor.timeVarying ? <em className="rv-score-luck">운</em> : null}
              </strong>
              <small>{factor.basis}</small>
            </span>
          </li>
        ))}
      </ul>
      {timeBound && asOf ? (
        <p className="rv-score-asof">
          <b>운</b> 표시가 붙은 자리는 그때 열려 있던 운이에요.{" "}
          {asOf.majorLuck ? `대운 ${asOf.majorLuck.pillar}(${asOf.majorLuck.range}), ` : ""}
          {asOf.yearly.year}년 {asOf.yearly.pillar} 세운을 보고 낸 값이라, 해가 바뀌면 다시 계산했을 때
          숫자가 달라져요. 이 리딩의 {scoreLabel ?? "지수"}는 {issuedText ? `${issuedText} ` : ""}발급 시점에
          봉인돼서 앞으로도 {score}점 그대로예요.
        </p>
      ) : null}
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

/** 뷰어 껍데기. 예전에는 분야별 색을 CSS 변수로 심었는데, 이제 색은 하나다. */
export function ChapterShell({ children }: { children: ReactNode }) {
  return <div className="rv">{children}</div>;
}
