import type { Metadata } from "next";
import Link from "next/link";

import { GRID_HIDDEN, PRODUCTS, TOPIC_LABEL, TOPIC_ORDER } from "@/lib/products";

/*
  사주 목록 — 주제별로 묶은 상세 페이지 링크 한 장.

  홈 그리드는 "지금 미는 것"(인기·신규)으로 줄을 세운다. 여기는 다른 축이다 —
  무엇에 대한 사주인지로 묶어, 연애를 보러 온 사람이 재물 카드를 지나치지
  않게 한다. 20종이 한 줄로 늘어서면 그 구분이 안 보인다.

  그리드에서 내린 상품(GRID_HIDDEN: 건강·가족·이사)도 여기에는 낸다. 상품은
  살아 있고 Threads 착지도 걸려 있다 — 홈에서 내렸다고 갈 길까지 막을 이유는
  없다. 그것이 이 페이지가 있는 이유이기도 하다.
*/

export const metadata: Metadata = {
  title: "사주 전체 목록 — 러브레빗",
  description: "연애·재물·일·삶까지, 러브레빗의 사주 20종을 주제별로 모았어요.",
};

export default function SajuListPage() {
  return (
    <main className="container saju-list-page">
      <header className="saju-list-head">
        <h1>어떤 사주를 볼까요</h1>
        <p>{PRODUCTS.length}종을 주제별로 모았어요. 궁금한 쪽부터 열어보세요.</p>
      </header>

      {TOPIC_ORDER.map((topic) => {
        const items = PRODUCTS.filter((p) => p.topic === topic);
        if (!items.length) return null;
        const label = TOPIC_LABEL[topic];
        return (
          <section key={topic} className="saju-list-group" aria-label={label.title}>
            <h2 className="saju-list-group-head">
              <span aria-hidden>{label.emoji}</span>
              {label.title}
              <small>{label.desc}</small>
            </h2>

            <ul className="saju-list-items">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.id}`} className="card saju-list-item" data-product={p.id}>
                    <span className="saju-list-item-emoji" aria-hidden>{p.emoji}</span>
                    <span className="saju-list-item-copy">
                      <strong>{p.title}</strong>
                      <small>{p.headline}</small>
                      {/* 무엇을 준비해야 하는지를 미리 알린다 — 상대 생년월일이
                          필요한 줄 모르고 폼까지 갔다가 돌아 나오는 일이 없게. */}
                      <em>
                        {p.needsPartner ? "상대 생년월일 필요" : "내 생년월일만"}
                        {GRID_HIDDEN.has(p.id) ? " · 홈에 없는 사주" : ""}
                      </em>
                    </span>
                    <span className="saju-list-item-go" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
