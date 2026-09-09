"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import loveRabbitLogo from "../../../public/logo.png";
import { READING_SALE_CREDITS } from "@/lib/credits";
import { GENRES } from "@/lib/genres";
import { displayTitle, hasCardArt, PRODUCTS, TOPIC_LABEL, type Product } from "@/lib/products";
import { getUser } from "@/lib/user";

/**
 * 검색 — 이름을 아는 사람의 지름길.
 *
 * 종목 줄과 고민 고르기는 "무엇을 볼까" 를 모르는 사람의 길이다. 이 화면은
 * 반대다 — "속궁합" 이나 "재회" 처럼 찾는 말이 이미 있는 사람이 목록 두 번을
 * 지나지 않고 바로 가게 한다.
 *
 * 서버를 두지 않는다. 상품이 스무 종이라 전부 번들에 이미 들어와 있고,
 * 그 위에서 거르는 일은 브라우저가 한 프레임에 한다 — 검색 API 를 만들면
 * 같은 데이터를 두 곳에서 관리하게 되고, 그 둘은 반드시 어긋난다.
 *
 * 찾는 밭: 제목·설명·배지·주제 이름·종목 이름. 태그(popular/new)는 넣지
 * 않는다 — 사용자가 치는 말이 아니다.
 */

/** 검색 대상 문자열. 상품이 이미 들고 있는 값만 잇는다. */
function haystack(p: Product): string {
  return [
    p.title,
    p.desc,
    p.badge,
    p.shortLabel,
    TOPIC_LABEL[p.topic].title,
    p.needsPartner ? "궁합 상대" : "",
  ]
    .join(" ")
    .toLowerCase();
}

export default function SearchClient() {
  const [q, setQ] = useState("");
  const [cost, setCost] = useState(READING_SALE_CREDITS);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색하러 온 사람은 칠 준비가 돼 있다 — 열자마자 커서를 준다.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    let alive = true;
    fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { readingCost?: number } | null) => {
        if (alive && typeof d?.readingCost === "number") setCost(d.readingCost);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const term = q.trim().toLowerCase();

  const genreHits = useMemo(() => {
    if (!term) return [];
    return GENRES.filter((g) => `${g.label} ${g.desc}`.toLowerCase().includes(term));
  }, [term]);

  const hits = useMemo(() => {
    if (!term) return [];
    return PRODUCTS.filter((p) => haystack(p).includes(term));
  }, [term]);

  return (
    <main className="container search" style={{ paddingTop: 20, paddingBottom: 110 }}>
      <header className="genre-head">
        <Link href="/" className="genre-back" aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="genre-head-copy">
          <h1>검색</h1>
          <p>찾는 이름이 있으면 바로 가세요</p>
        </div>
      </header>

      <div className="search-box">
        <svg className="search-box-icon" aria-hidden viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.2 4.2" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="속궁합, 재회, 취업…"
          aria-label="사주·타로 검색"
        />
        {q && (
          <button type="button" className="search-box-clear" onClick={() => setQ("")} aria-label="지우기">
            ✕
          </button>
        )}
      </div>

      {/* 아직 아무것도 안 친 자리. 빈 화면 대신 자주 찾는 말을 눌러 볼 수 있게
          둔다 — 무엇을 칠 수 있는지 보여주는 것이 안내문보다 낫다. */}
      {!term && (
        <div className="search-seeds">
          <p className="search-seeds-label">이런 걸 찾아요</p>
          <div className="search-seed-row">
            {["속궁합", "재회", "궁합", "취업", "금전", "이별"].map((s) => (
              <button key={s} type="button" className="search-seed" onClick={() => setQ(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {term && genreHits.length > 0 && (
        <>
          <p className="genre-count">종목 {genreHits.length}</p>
          <ul className="search-genre-list">
            {genreHits.map((g) => (
              <li key={g.id}>
                <Link href={g.href}>
                  <strong>{g.label}</strong>
                  <small>{g.desc}</small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {term && (
        <>
          <p className="genre-count">
            {hits.length > 0 ? `${hits.length}가지` : "찾는 것이 없어요"}
          </p>
          {hits.length === 0 && genreHits.length === 0 && (
            <p className="search-empty">
              다른 말로 찾아보거나, <Link href="/">홈에서 종목을 골라</Link> 보세요.
            </p>
          )}
          <ul className="genre-list">
            {hits.map((p) => (
              <li key={p.id}>
                <Link href={`/product/${p.id}`}>
                  <span className="genre-item-copy">
                    <strong>{displayTitle(p)}</strong>
                    <span className="genre-tags">
                      <i>{TOPIC_LABEL[p.topic].title}</i>
                      <i>{p.badge}</i>
                      {p.needsPartner && <i>상대 정보 필요</i>}
                    </span>
                    <span className="genre-price">
                      <i className="rabbit-coin" aria-hidden>
                        <Image src={loveRabbitLogo} alt="" width={12} height={12} />
                      </i>
                      <b>{cost}</b>
                      <small>러빗</small>
                    </span>
                  </span>
                  <span className="genre-item-art" data-tone={p.tone}>
                    {hasCardArt(p.id) && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/cards-pastel/${p.id}.jpg?v=2`} alt="" loading="lazy" />
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
