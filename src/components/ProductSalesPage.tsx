import Image from "next/image";
import type { ReactNode } from "react";
import CardMotion from "@/components/CardMotion";
import ProductRevealObserver from "@/components/ProductRevealObserver";
import type { AdOffer } from "@/lib/ad-offers";
import type { Product } from "@/lib/products";

// 상품 상세 판매 페이지 — "돈을 낼만한 이유"를 만드는 설득 구조:
// 후킹 질문 -> ??% 게이지 -> 비전(秘傳) 서사 -> 리포트 구성 -> 대상 -> 원리 -> 목차 -> CTA
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

      {/* ── 히어로 ── */}
      <section className="product-hero">
        <div
          aria-hidden
          className="product-hero-art"
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
          {/* 그림이 파는 장면을 실제로 일어나게 한다 - 클립이 있는 카드만.
              정지 그림은 위 <Image> 그대로 남아 LCP 와 무영상 환경을 책임진다. */}
          <CardMotion category={product.id} objectPosition="center 18%" />
        </div>
        <div aria-hidden className="product-hero-shade" />
        <div className="product-hero-copy">
          <span className="badge">{badge}</span>
          <h1 style={{ color: "#fff", fontSize: "1.7rem", lineHeight: 1.3, margin: "8px 0 6px" }}>{headline}</h1>
          <p style={{ color: "rgba(255,255,255,0.82)", fontSize: "0.9rem", lineHeight: 1.55 }}>{sub}</p>
          {hero?.adultOnly && (
            <p style={{ marginTop: 8, color: "rgba(255,255,255,0.68)", fontSize: "0.74rem" }}>
              성인 대상 · 노골적 묘사가 아닌 관계 친밀도 해석입니다.
            </p>
          )}
        </div>
      </section>

      <div style={{ padding: "20px 20px 0", display: "grid", gap: 26 }}>
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

        {/* ── 비전(秘傳) 서사 ── */}
        <section className="card product-story-card product-reveal" style={{ position: "relative", overflow: "hidden" }}>
          <span aria-hidden style={{ position: "absolute", right: -6, top: -18, fontSize: "5.5rem", fontFamily: "serif", fontWeight: 900, color: "var(--accent)", opacity: 0.08 }}>秘傳</span>
          <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.1em", marginBottom: 6 }}>본 사주 분석의 뿌리</p>
          <strong style={{ fontSize: "1.05rem" }}>필사본으로만 전해진 연애 명리 비전, 「연담비결(戀談秘訣)」</strong>
          <ul style={{ margin: "10px 0 0 18px", display: "grid", gap: 6, fontSize: "0.88rem", color: "var(--text)" }}>
            <li className="product-reveal-item">이름을 남기지 않은 한 명리가가 평생 연애 사주만 파고들어 남긴 필사본</li>
            <li className="product-reveal-item">책으로 출간된 적 없이 필사로만 이어져 온 관계 풀이 원리</li>
            <li className="product-reveal-item">그 풀이 체계를 현대 명리로 복원해, 당신의 명식에 그대로 적용합니다</li>
          </ul>
        </section>

        {/* ── 리포트 구성 ── */}
        <section className="product-reveal">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>전체 리포트 구성</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12 }}>
            무료 미리보기 이후, {product.toc.length}개 섹션의 심층 리포트로 정리해드립니다
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {product.keywords.map((keyword) => <span key={keyword} className="badge product-reveal-item">{keyword}</span>)}
          </div>
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

        {/* ── 풀이 원리 ── */}
        <section className="product-reveal">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>이런 원리로 풀이해요</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {product.principles.map(([title, description]) => (
              <div key={title} className="card product-reveal-item" style={{ padding: "14px 16px" }}>
                <strong style={{ fontSize: "0.95rem" }}>{title}</strong>
                <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginTop: 4 }}>{description}</p>
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
              무료 미리보기를 확인한 뒤, 전체 리포트가 필요할 때만 결제합니다.
            </p>
          </section>
        ) : null}

        <p className="product-reveal" style={{ fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "center" }}>
          본 리딩은 오락 목적의 콘텐츠이며, 무료 미리보기 후 결제 여부를 결정할 수 있습니다.
        </p>
      </div>

      {sticky}
    </main>
  );
}
