import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BUNDLES, BUNDLE_MAP, bundleListPrice } from "@/lib/bundles";
import { PRODUCT_MAP } from "@/lib/products";

/*
  세트 판매 페이지.

  단품 페이지(ProductSalesPage)를 안 쓴다 — 그 페이지는 목차·게이지·약속 검사가
  한 상품에 묶여 있고, 세트는 상품이 아니라 묶음이다. 여기서는 세 장이 무엇인지,
  합치면 얼마가 빠지는지, 어디서 시작하는지만 말한다.

  시작은 세트의 첫 리딩 폼(?bundle=)이다. 첫 리딩을 세트 값으로 결제하면 나머지
  두 장의 0원 쿠폰이 나가고, 각 장은 리딩 끝 "다음 질문"에서 한 칸으로 이어진다.
*/

export function generateStaticParams() {
  return BUNDLES.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const bundle = BUNDLE_MAP[id];
  if (!bundle) return { title: "러브레빗" };
  return {
    title: `${bundle.title} — 러브레빗`,
    description: bundle.copy,
  };
}

export default async function BundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = BUNDLE_MAP[id];
  if (!bundle) notFound();

  const items = bundle.items.map((pid) => PRODUCT_MAP[pid]).filter(Boolean);
  const listPrice = bundleListPrice(bundle);
  const first = PRODUCT_MAP[bundle.first];
  const off = Math.round((1 - bundle.price / listPrice) * 100);

  return (
    <main className="container set-page">
      <section className="set-hero">
        <span className="set-hero-emoji" aria-hidden>{bundle.emoji}</span>
        <span className="badge">세트 · {off}% 할인</span>
        <h1>{bundle.title}</h1>
        <p>{bundle.copy}</p>
        <p className="set-price">
          <s>{listPrice.toLocaleString("ko-KR")}원</s>
          <b>{bundle.price.toLocaleString("ko-KR")}원</b>
        </p>
      </section>

      <section className="set-items" aria-label="세트 구성">
        {items.map((p, index) => (
          <article key={p.id} className="card set-item" data-product={p.id}>
            <span className="set-item-index">{index + 1}</span>
            <span className="set-item-emoji" aria-hidden>{p.emoji}</span>
            <div className="set-item-copy">
              <strong>{p.title}</strong>
              <small>{p.headline}</small>
              <em>{p.needsPartner ? "상대 생년월일 필요" : "내 생년월일만"} · 단품 {p.price.toLocaleString("ko-KR")}원</em>
            </div>
          </article>
        ))}
      </section>

      <section className="card set-how">
        <h2>이렇게 열려요</h2>
        <ol>
          <li><b>{first.title}</b>부터 시작해요. 이 한 장을 세트 값 {bundle.price.toLocaleString("ko-KR")}원에 결제해요.</li>
          <li>입금이 확인되면 나머지 {items.length - 1}장을 여는 <b>0원 쿠폰</b>이 바로 들어와요.</li>
          <li>각 리딩은 읽은 리딩 끝의 “다음 질문”에서 한 칸만 넣으면 이어져요. 내 생년월일은 저장돼 있어요.</li>
        </ol>
        <small>쿠폰은 30일 안에 쓰면 돼요. 어떤 순서로 열어도 괜찮아요.</small>
      </section>

      <div className="product-sticky-shell set-sticky">
        <Link href={`/reading?c=${bundle.first}&bundle=${bundle.id}`} className="btn product-sticky-cta">
          <span className="product-sticky-copy">
            <strong><s>{listPrice.toLocaleString("ko-KR")}원</s> {bundle.price.toLocaleString("ko-KR")}원에 세 장 열기</strong>
            <small>{first.title}부터 · 나머지는 쿠폰으로</small>
          </span>
        </Link>
      </div>
    </main>
  );
}
