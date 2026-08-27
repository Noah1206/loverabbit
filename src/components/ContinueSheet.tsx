"use client";

import { previewFor } from "@/lib/reading-preview";

/**
 * "이어서 보기"를 누르면 뜨는 창.
 *
 * 예전 버튼은 "🔒 14,900원으로 끝까지 운명보기" 였다. 사는 사람에게 값을 먼저 들려주는
 * 꼴이라, 읽다가 궁금해진 사람이 값을 보고 멈췄다. 지금은 버튼이 "이어서 보기" 이고,
 * 누르면 **무엇을 못 보고 있는지**가 먼저 보인다 — 공개분이 남긴 물음 한 줄과, 지금까지
 * 본 것과 전체 풀이의 차이. 값은 그 다음이다.
 *
 * 여기 있는 말은 상품마다 다르다(reading-preview.ts). 리딩이 남긴 물음(openLoop)이
 * 있으면 그것을 쓰고, 옛 리딩처럼 없으면 상품의 숨은 변수로 대신한다.
 *
 * 광고로 들어온 4,900원 리딩도 같은 창을 쓴다 — 값만 다르다.
 */
export default function ContinueSheet({
  productId,
  label,
  price,
  openLoop,
  seenTitles,
  lockedTitles,
  scoreLabel,
  onContinue,
  onClose,
}: {
  productId: string;
  label: string;
  price: number;
  openLoop: string | null | undefined;
  seenTitles: string[];
  lockedTitles: string[];
  scoreLabel: string | null | undefined;
  onContinue: () => void;
  onClose: () => void;
}) {
  const preview = previewFor(productId);
  const question = openLoop?.trim() || preview?.hiddenVariable || null;
  const reveals = preview?.unlockReveals ?? lockedTitles.slice(0, 4).map(stripNumber);
  const seen = [
    ...(scoreLabel ? [`${scoreLabel} 지수와 그 구간`] : []),
    "한눈에 보기 — 나의 중심 · 관계의 결 · 지금의 흐름",
    ...seenTitles.map(stripNumber),
  ];

  return (
    <div
      className="app-modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="continue-sheet-title"
      onClick={onClose}
    >
      <div className="card continue-sheet" onClick={(event) => event.stopPropagation()}>
        <span className="badge">{label}</span>
        <h3 id="continue-sheet-title">여기서부터가 진짜 답이에요</h3>

        {question && (
          <p className="continue-sheet-question">
            <Marked text={question} />
          </p>
        )}

        <div className="continue-sheet-columns">
          <section>
            <h4>지금까지 본 것</h4>
            <ul>
              {seen.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="is-locked">
            <h4>전체 풀이에서 확인하는 것</h4>
            <ul>
              {reveals.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {lockedTitles.length > reveals.length && (
                <li className="continue-sheet-more">… 잠긴 {lockedTitles.length}개 절 전부</li>
              )}
            </ul>
          </section>
        </div>

        <button className="btn continue-sheet-cta" type="button" onClick={onContinue}>
          {price.toLocaleString()}원으로 전체 풀이 열기
        </button>
        <button className="btn btn-ghost continue-sheet-later" type="button" onClick={onClose}>
          조금 더 읽어 볼게요
        </button>
      </div>
    </div>
  );
}

/** "5장 01. 연락이 다시 올 확률" → "연락이 다시 올 확률" */
function stripNumber(title: string): string {
  const at = title.indexOf(". ");
  return at > 0 && at < 12 ? title.slice(at + 2) : title;
}

/** 물음 안의 **굵게** 만 살린다. 표기는 이미 걷어냈지만, 혹시 남은 별표를 그대로 보이지 않게. */
function Marked({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>))}
    </>
  );
}
