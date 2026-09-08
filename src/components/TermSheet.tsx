"use client";

import { useEffect, useState } from "react";
import { useEscape } from "@/lib/use-escape";

/**
 * 용어 설명 시트 — 화면 오른쪽 위 (i) 를 누르면 열린다.
 *
 * 왜 필요한가. 만세력·명식 화면은 "십성", "지장간", "12운성" 같은 말을 표
 * 안에 그냥 적어 둔다. 아는 사람에게는 그게 가장 빠른 표기지만, 처음 온
 * 사람에게는 읽을 수 없는 표가 한 판 뜨는 것과 같다 — 만세력은 광고·검색으로
 * 들어오는 마케팅 진입점이라 그 쪽이 다수다.
 *
 * 화면 안에 설명을 풀어 쓰지 않고 시트로 뺀 이유는, 아는 사람에게는 그 설명이
 * 전부 소음이기 때문이다. 묻는 사람에게만 답한다.
 *
 * 열려 있는 동안 뒤 배경이 스크롤되지 않게 잠근다 — 시트 안에서 손가락을
 * 움직였는데 뒤가 밀리면 어느 것을 만지는지 알 수 없다.
 */
export interface TermPage {
  title: string;
  body: string;
}

export default function TermSheet({
  pages,
  label = "용어 설명",
}: {
  pages: TermPage[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEscape(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!pages.length) return null;
  const current = pages[Math.min(page, pages.length - 1)];

  return (
    <>
      <button
        type="button"
        className="term-open"
        onClick={() => {
          setPage(0);
          setOpen(true);
        }}
        aria-label={label}
        title={label}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className="term-backdrop" role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}>
          <div className="term-sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="term-close" onClick={() => setOpen(false)} aria-label="닫기">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>

            <h2 className="term-title">{current.title}</h2>
            <p className="term-body">{current.body}</p>

            {pages.length > 1 && (
              <>
                <div className="term-dots" role="tablist" aria-label="용어 목록">
                  {pages.map((p, i) => (
                    <button
                      key={p.title}
                      role="tab"
                      aria-selected={i === page}
                      aria-label={p.title}
                      className={`term-dot${i === page ? " on" : ""}`}
                      onClick={() => setPage(i)}
                    />
                  ))}
                </div>
                <div className="term-nav">
                  <button type="button" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
                    이전
                  </button>
                  <button
                    type="button"
                    disabled={page === pages.length - 1}
                    onClick={() => setPage((n) => n + 1)}
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
