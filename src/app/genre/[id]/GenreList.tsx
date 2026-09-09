"use client";

import Link from "next/link";

import { displayTitle, hasCardArt, TOPIC_LABEL, type Product } from "@/lib/products";
import type { Genre } from "@/lib/genres";

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
 *
 * **값은 여기서 안 적는다** (2026-09-09 운영자). 스물세 줄에 같은 숫자가
 * 스물세 번 찍히는데, 상품마다 다르지 않으므로 고르는 데 쓸 정보가 아니다.
 * 대신 목록을 훑는 내내 값을 먼저 읽게 만든다. 값은 상품 화면과 결제창이
 * 말하고, 깎이는 값은 어차피 서버가 정한다.
 */
export default function GenreList({ genre, items }: { genre: Genre; items: Product[] }) {

  return (
    <main className="container genre" style={{ paddingTop: 20, paddingBottom: 110 }}>
      <header className="genre-head">
        <Link href="/" className="genre-back" aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="genre-head-copy">
          {/* 설명 줄을 걷었다 (2026-09-09 운영자) — "내 명식으로 읽는 나의 결" 은
              종목을 고르기 전에 하는 말이고, 여기 온 사람은 이미 골랐다. */}
          <h1>{genre.label}</h1>
        </div>
      </header>

      {/* 배너를 걷었다 (2026-09-09 운영자). 종목을 이미 고르고 들어온 사람에게
          그 종목을 다시 그림으로 설명하는 자리다 — 한 화면을 먹으면서 정작
          고를 목록을 아래로 민다. 배너 그림(genre.banner)은 홈 종목 줄이 계속
          쓰므로 파일은 그대로 둔다. */}

      <p className="genre-count">{items.length}가지</p>

      <ul className="genre-list">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/product/${p.id}`}>
              <span className="genre-item-copy">
                <strong>{displayTitle(p)}</strong>
                {/* 네모 칩에서 해시태그로 (2026-09-09 운영자). 칩은 누를 수
                    있어 보이는데 여기서는 못 누른다 — 글자 그대로 꼬리표다.
                    바탕색을 걷고 # 를 붙이면 읽는 것이 된다. */}
                <span className="genre-tags">
                  {/* 해시태그에는 사이 글자를 넣지 않는다 — "#일·공부" 는 태그로
                      안 읽힌다. 표에 있는 이름을 화면에서만 붙여 쓴다. */}
                  <i>#{TOPIC_LABEL[p.topic].title.replace(/[·\s]/g, "")}</i>
                  <i>#{p.badge.replace(/[·\s]/g, "")}</i>
                  {p.needsPartner && <i>#상대정보필요</i>}
                </span>
              </span>
              <span className="genre-item-art" data-tone={p.tone}>
                {/* 그림이 있는 상품만 건다 (2026-09-09) — 없으면 밑색만 남는다.
                    깨진 그림 표식은 밑색보다 나쁘다: 화면이 고장난 것처럼 보인다. */}
                {hasCardArt(p.id) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/cards-pastel/${p.id}.jpg?v=2`} alt="" loading="lazy" />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
