import type { Metadata } from "next";
import { READING_SALE_CREDITS } from "@/lib/credits";
import { notFound } from "next/navigation";
import ProductCtaGate from "@/components/ProductCtaGate";
import ProductSalesPage from "@/components/ProductSalesPage";
import { resolveAdOffer } from "@/lib/ad-offers";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/products";
import { PRODUCT_PARTICIPANT_COUNTS } from "@/lib/participant-counts";

// 상품 상세로 들어오는 문. 화면 자체는 ProductSalesPage 하나를 광고 랜딩과 같이 쓴다.

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = PRODUCT_MAP[id];
  return p ? { title: `${p.title} — ${p.headline}`, description: p.sub } : {};
}

type ProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offer?: string | string[] }>;
};

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const p = PRODUCT_MAP[id];
  if (!p) notFound();

  const requestedOffer = Array.isArray(query.offer) ? query.offer[0] : query.offer;
  // 공개 URL의 offer 값은 신뢰하지 않는다. 이 상품에 등록된 오퍼일 때만 CTA와 가격에 반영한다.
  const activeOffer = resolveAdOffer(p.id, requestedOffer);
  const ctaParams = new URLSearchParams({ c: p.id });
  if (activeOffer) ctaParams.set("offer", activeOffer.id);
  const cta = `/reading?${ctaParams.toString()}`;
  const participantCount = PRODUCT_PARTICIPANT_COUNTS[p.id] ?? 354;

  return (
    <ProductSalesPage
      product={p}
      activeOffer={activeOffer}
      sticky={
        <div className="product-sticky-shell">
          <span className="product-participant-badge" aria-label={`${participantCount}명이 참여함`}>
            {participantCount}명이 참여함
          </span>
          <ProductCtaGate href={cta} className="product-sticky-cta">
            <span className="product-cta-flames" aria-hidden="true">
              <span>🔥</span>
              <span>🔥</span>
              <span>🔥</span>
              <span>🔥</span>
              <span>🔥</span>
              <span>🔥</span>
            </span>
            <span className="product-sticky-copy">
              {/* 값을 버튼에 바로 적는다 — 사람은 버튼에서 "얼마인지"를 먼저 찾고,
                  그 답이 없으면 누르기 전에 스크롤을 올린다. 단위는 크레딧 하나다
                  (2026-08-31) — 원화 오퍼 병기는 단위 혼란만 만든다. */}
              {activeOffer ? (
                <>
                  <strong>{READING_SALE_CREDITS}크레딧으로 확인하기</strong>
                  <small>{p.ctaHook}</small>
                </>
              ) : (
                <strong>{p.ctaLabel}</strong>
              )}
            </span>
            <span className="product-sticky-arrow" aria-hidden>→</span>
          </ProductCtaGate>
        </div>
      }
    />
  );
}
