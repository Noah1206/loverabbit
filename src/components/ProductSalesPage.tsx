import Image from "next/image";
import type { ReactNode } from "react";
import ProductRevealObserver from "@/components/ProductRevealObserver";
import HomeReviews from "@/components/HomeReviews";
import type { AdOffer } from "@/lib/ad-offers";
import type { Product } from "@/lib/products";

// 상품 상세 판매 페이지 — "돈을 낼만한 이유"를 만드는 설득 구조:
// 후킹 질문 -> ??% 게이지 -> 박도사 비법서 서사 -> 리포트 구성 표 -> 대상 -> 목차 -> 후기 -> CTA
//
// 이 화면으로 들어오는 문은 둘이다. /product/[id] 로 직접 들어오는 길과, 광고가
// 데려오는 /saju/<랜딩> 길.
//
// 예전에는 이 화면이 두 벌로 따로 있었고, 그래서 갈렸다 - 상품 쪽만 카드 모션과
// 秘傳 서사를 새로 받고 광고 랜딩은 정지 그림에 멈춰 있었다. 광고비를 태워
// 데려온 사람이 오히려 옛 화면을 봤다는 뜻이다.
//
// 그래서 화면은 여기 하나뿐이다. 문마다 다른 것 - 히어로 문구, 값을 말하는 방식,
// 하단 CTA 연출 - 만 인자로 받는다.
/** "3장 01. 속궁합 지수 — 두 사람의 진짜 상성 판정" -> "속궁합 지수" */
function tocTopic(title: string | undefined): string {
  if (!title) return "";
  return title
    .replace(/^\d+장\s*\d+\.\s*/, "")
    .split(/\s[—–-]\s|,|\?/)[0]
    .trim();
}

/** 절당 약 800자 (실측 최소치) 를 "약 12,000자" 꼴로 */
function approxChars(sections: number): string {
  return `${(sections * 800).toLocaleString("ko-KR")}자`;
}

export default function ProductSalesPage({
  product,
  activeOffer,
  hero,
  sticky,
  landingType,
  children,
}: {
  product: Product;
  /** 값이 붙은 오퍼. 없으면 정가를 말하고 특별가 줄도 안 띄운다 */
  activeOffer?: AdOffer | null;
  /** 광고는 같은 상품을 다른 각도로 판다. 히어로 문구만 갈아 끼운다 */
  hero?: { badge: string; headline: string; sub: string; adultOnly?: boolean };
  /** 하단 고정 CTA - 상품 상세와 광고 랜딩이 서로 다른 연출을 쓴다 */
  sticky: ReactNode;
  /** 광고 랜딩 표식. 픽셀이 이 값으로 랜딩을 가른다 */
  landingType?: string;
  /** 픽셀 트래커처럼 문 쪽에서만 붙이는 것 */
  children?: ReactNode;
}) {
  const badge = hero?.badge ?? product.badge;
  const headline = hero?.headline ?? product.headline;
  const sub = hero?.sub ?? product.sub;

  return (
    <main
      className="product-page"
      data-product={product.id}
      data-landing={landingType}
      data-offer={activeOffer?.id}
    >
      {children}
      <ProductRevealObserver />

      {/* ── 히어로 ──
          글이 위, 그림이 아래 (2026-08-27). 전에는 그림 위에 글을 얹고 그림이
          떠오르며 숨쉬고 그 위에 영상까지 겹쳤다. 지금은 아이콘 → 물음 → 상품명
          → 설명 → 값 → 그림 순서로 그냥 세운다. 움직이는 것은 없다 — 그림은
          정지 사진 한 장이고 첫 화면에서 바로 뜬다. */}
      <section className="product-hero-stack">
        <span className="product-hero-icon" aria-hidden>{product.emoji}</span>
        <p className="product-hero-question">{headline}</p>
        <h1 className="product-hero-title">{product.title}</h1>
        <p className="product-hero-sub">{sub}</p>
        {activeOffer && (
          <p className="product-hero-offer">
            <s>{product.price.toLocaleString("ko-KR")}원</s>
            <strong>{activeOffer.price.toLocaleString("ko-KR")}원</strong>
            <span>첫 사주 1,900원 · 명식은 결제 전에 확인</span>
          </p>
        )}
        {hero?.adultOnly && (
          <p className="product-hero-adult">성인 대상 · 노골적 묘사가 아닌 관계 친밀도 해석입니다.</p>
        )}
        <div
          className="product-hero-photo"
          style={{ background: `linear-gradient(160deg, ${product.grad[0]}, ${product.grad[1]})` }}
        >
          <Image
            src={`/cards-pastel/${product.id}.jpg`}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            style={{ objectFit: "cover", objectPosition: "center 18%" }}
          />
        </div>
      </section>

      <div style={{ padding: "20px 10px 0", display: "grid", gap: 26 }}>
        {/* ── ??% 게이지 ──
            "우리의 {이름}은?" 으로 묻지 않는다. 조사가 이름 끝소리를 안 따라가
            "속궁합 지수은?" 이 나오고, 혼자 보는 상품에서는 "우리의" 도 틀린다. */}
        <section className="card product-score-card product-reveal">
          <p className="product-score-question">{product.scoreLabel}, 어느 정도일까요?</p>
          <div className="product-score-result">
            <p>상위 <span>??</span>%</p>
            <span className="product-score-orb" aria-hidden>{product.emoji}</span>
          </div>
          <p className="product-score-caption">{product.gaugeCaption}</p>
          <div className="product-score-meter" aria-hidden><span /></div>
          <div className="product-score-labels">
            {product.meterLabels.map((label) => <span key={label}>{label}</span>)}
            <strong aria-label="결과 미공개">?</strong>
          </div>
        </section>

        {/* ── 박도사 비법서 서사 (2026-08-25, 「연담비결」을 대체) ──
            사진은 public/lore/parkdosa-manuscript.jpg (운영자 제공, 2026-08-25).
            파일만 갈아 끼우면 된다 - 비율이 바뀌면 아래 width/height 도 맞춘다. */}
        <section className="card product-story-card product-lore product-reveal">
          <p className="product-lore-kicker">본 사주 분석의 뿌리</p>
          <h2 className="product-lore-title">정재계가 줄 서서 찾던 전설, 박도사</h2>
          <p className="product-lore-name">제산 박재현(박도사)</p>
          <figure className="product-lore-figure product-reveal-item">
            <Image
              src="/lore/parkdosa-manuscript.jpg"
              alt="제산 박재현(박도사)이 손으로 적은 비법서 필사본"
              width={795}
              height={373}
              sizes="(max-width: 640px) 100vw, 600px"
            />
            <span className="product-lore-seal" aria-hidden>秘傳</span>
            <figcaption>제산 박재현(박도사)가 직접 짚어 내린 비법서</figcaption>
          </figure>
          <ul className="product-lore-points">
            <li className="product-reveal-item">제산 박재현, 부산·함양을 무대로 한 시대를 풍미한 전설급 사주가</li>
            <li className="product-reveal-item">당대 정·재계 인사들이 운명을 묻고자 줄을 섰던 인물</li>
            <li className="product-reveal-item">책 한 권 남기지 않고, 오직 손으로 적은 비법서만 남겼다</li>
          </ul>
          <p className="product-lore-close product-reveal-item">
            세상에 거의 남지 않은 그의 비법서, 그 풀이 원리를 현대 명리로 복원해, 당신의 사주에 그대로 적용합니다.
          </p>
        </section>

        {/* ── 리포트 구성 표 (2026-08-25) ──
            줄의 내용은 products.ts 의 reportFacets 로, 목차에 실제로 있는 장만
            요약한 것이다. 분량의 글자 수는 실제 발급본(재회 15절 11,197자,
            속궁합 12절 10,965자, 이별 10절 8,619자)에서 잰 절당 약 800자를
            보수적으로 곱한 값이다 - 부풀리지 않는다. */}
        <section className="card product-report product-reveal">
          <p className="product-lore-kicker">전체 리포트 구성</p>
          <h2 className="product-report-title">전체 리포트에서 확인하는 것</h2>
          <p className="product-report-sub">
            {tocTopic(product.toc[0])}부터 {tocTopic(product.toc[product.toc.length - 2])}까지{" "}
            {product.toc.length}개 섹션으로 정리해드려요
          </p>
          <dl className="product-report-rows">
            <div className="product-reveal-item"><dt>분량</dt><dd>{product.toc.length}개 섹션 · 약 {approxChars(product.toc.length)} 제공</dd></div>
            <div className="product-reveal-item"><dt>핵심 판단</dt><dd>{product.reportFacets.judgement}</dd></div>
            <div className="product-reveal-item"><dt>관계 리스크</dt><dd>{product.reportFacets.risk}</dd></div>
            <div className="product-reveal-item"><dt>실행 가이드</dt><dd>{product.reportFacets.action}</dd></div>
          </dl>
          <p className="product-report-close product-reveal-item">{product.ctaHook}</p>
        </section>

        {/* ── 대상 ── */}
        <section className="product-reveal">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>이 사주는 누가 보면 좋을까요?</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {product.audience.map((item) => (
              <div key={item} className="card product-reveal-item" style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--accent)", fontWeight: 900 }}>✓</span>
                <span style={{ fontSize: "0.9rem" }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 목차 ── */}
        <section className="product-reveal">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>이런 결과를 받아요</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12 }}>풀 리딩 리포트 목차</p>
          <div className="card" style={{ padding: "6px 0" }}>
            {product.toc.map((item, index) => (
              <div key={item} className="product-reveal-item" style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "9px 18px", borderTop: index === 0 ? "none" : "1px solid var(--line)" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "var(--accent)", fontSize: "0.8rem", minWidth: 22 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: "0.88rem" }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 이 사주를 본 사람들의 후기 (2026-08-25) ──
            홈의 전체 후기를 상품별로 가른 것. /api/reviews?product= 가 걸러 준다.
            후기가 없으면 컴포넌트가 스스로 빠진다. */}
        <HomeReviews productId={product.id} heading={`💬 ${product.title} 먼저 본 사람들`} />

        {/* ── 광고 특별가 — 오퍼가 살아 있을 때만 ── */}
        {activeOffer ? (
          <section className="card product-reveal" style={{ padding: 18, textAlign: "center" }}>
            <span className="badge">광고 특별가</span>
            <h2 style={{ fontSize: "1.3rem", margin: "12px 0 7px" }}>
              <s style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginRight: 8 }}>
                {product.price.toLocaleString("ko-KR")}원
              </s>
              <strong>{activeOffer.price.toLocaleString("ko-KR")}원</strong>
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              사주 여덟 글자와 목차를 먼저 확인하고, 결제하면 전문이 열립니다.
            </p>
          </section>
        ) : null}

      </div>

      {sticky}
    </main>
  );
}
