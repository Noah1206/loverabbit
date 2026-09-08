"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import loveRabbitLogo from "../../../../public/logo.png";
import { READING_SALE_CREDITS } from "@/lib/credits";
import { TOPIC_LABEL, type Product } from "@/lib/products";
import type { Genre } from "@/lib/genres";
import { getUser } from "@/lib/user";

/**
 * 종목 안의 사주 목록.
 *
 * 한 줄에 제목·태그·값이 다 보이는 세로 리스트다. 홈의 카드 줄과 일부러
 * 다르게 두었다 — 홈은 무엇을 파는지 분위기로 말하는 자리고, 여기는 이미
 * 종목을 고른 사람이 **그중 어느 것인지** 고르는 자리다. 그때는 그림보다
 * 제목이 먼저 읽혀야 한다.
 *
 * 태그는 새로 만들지 않는다. 주제 이름(TOPIC_LABEL)과 상품이 이미 들고 있는
 * badge, 그리고 상대가 필요한지 여부 — 셋 다 있는 값이다.
 */
export default function GenreList({ genre, items }: { genre: Genre; items: Product[] }) {
  /* 이 사람이 다음 한 장에 낼 값. 못 가져오면 첫 장 값 그대로 둔다 —
     결제창이 정본이라 여기서 틀려도 깎이는 값은 서버가 정한다. */
  const [cost, setCost] = useState(READING_SALE_CREDITS);

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

  return (
    <main className="container genre" style={{ paddingTop: 20, paddingBottom: 110 }}>
      <header className="genre-head">
        <Link href="/" className="genre-back" aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="genre-head-copy">
          <h1>{genre.label}</h1>
          <p>{genre.desc}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="genre-head-art" src={genre.art} alt="" loading="lazy" />
      </header>

      <p className="genre-count">{items.length}가지</p>

      <ul className="genre-list">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/product/${p.id}`}>
              <span className="genre-item-copy">
                <strong>{p.title}</strong>
                <span className="genre-tags">
                  <i>{TOPIC_LABEL[p.topic].title}</i>
                  <i>{p.badge}</i>
                  {p.needsPartner && <i>상대 정보 필요</i>}
                </span>
                <span className="genre-price">
                  {/* 러빗 코인 — 동그라미 안의 토끼 로고가 화폐 기호다 */}
                  <i className="rabbit-coin" aria-hidden>
                    <Image src={loveRabbitLogo} alt="" width={12} height={12} />
                  </i>
                  <b>{cost}</b>
                  <small>러빗</small>
                </span>
              </span>
              <span className="genre-item-art" data-tone={p.tone}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/cards-pastel/${p.id}.jpg?v=2`} alt="" loading="lazy" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
