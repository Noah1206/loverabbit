import Link from "next/link";

import { displayTitle, hasCardArt, PRODUCTS, TOPIC_LABEL, type Product } from "@/lib/products";

/*
  이런 것도 추천드려요 — 상품 화면 맨 아래 (2026-09-10 운영자).

  목록 화면(.genre-list)의 줄을 그대로 쓴다. 같은 것을 고르는 자리에 다른
  모양을 두면 두 화면이 서로 다른 앱처럼 읽힌다 — 검색 결과가 종목 목록과
  같은 줄을 쓰는 것과 같은 이유다.

  **무엇을 세우는가.** 같은 주제(topic)를 먼저, 모자라면 다른 주제에서 채운다.
  재회를 보러 온 사람에게 연애 쪽을 먼저 보이는 것이 맞고, 그것만으로 줄이
  모자랄 때 억지로 비우지는 않는다.

  지금 보고 있는 상품과 궁합 상대가 필요한지 여부는 가리지 않는다 — 자기
  자신만 뺀다. 상대 정보가 필요한 상품도 그 화면에서 다시 안내하므로 여기서
  미리 걸러 낼 이유가 없다.
*/

const HOW_MANY = 5;

export default function ProductRecommend({ product }: { product: Product }) {
  const others = PRODUCTS.filter((p) => p.id !== product.id);
  const sameTopic = others.filter((p) => p.topic === product.topic);
  const rest = others.filter((p) => p.topic !== product.topic);
  const items = [...sameTopic, ...rest].slice(0, HOW_MANY);
  if (items.length === 0) return null;

  return (
    <section className="product-recommend product-reveal">
      <h2>이런 것도 추천드려요!</h2>
      <ul className="genre-list">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/product/${p.id}`} className="genre-item">
              <span className="genre-item-copy">
                <strong>{displayTitle(p)}</strong>
                <span className="genre-tags">
                  <i>#{TOPIC_LABEL[p.topic].title.replace(/[·\s]/g, "")}</i>
                  <i>#{p.badge.replace(/[·\s]/g, "")}</i>
                  {p.needsPartner && <i>#상대정보필요</i>}
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
    </section>
  );
}
