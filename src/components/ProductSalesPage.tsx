import Image from "next/image";
import type { ReactNode } from "react";
import ProductMonthNote from "@/components/ProductMonthNote";
import ProductCtaGate from "@/components/ProductCtaGate";
import ProductRevealObserver from "@/components/ProductRevealObserver";
import type { AdOffer } from "@/lib/ad-offers";
import { KRW_PER_CREDIT, READING_PRICE_TIERS } from "@/lib/credits";
import { hasCardArt, displayToc, type Product } from "@/lib/products";

// 상품 상세 판매 페이지 — "돈을 낼만한 이유"를 만드는 설득 구조:
// 후킹 질문 -> 이번 달이 무슨 달인가 -> ??% 게이지 -> 리포트 구성 표 -> 목차 -> CTA
//
// 2026-09-09 에 둘을 걷었다. 박도사 비법서 서사는 한 화면을 통째로 먹으면서
// 검증할 수 없는 주장을 하고 있었고(승인된 사실 밖이다), "누가 보면 좋을까요"
// 는 바로 아래 목차가 같은 말을 더 구체적으로 한다. 대신 이번 달이 사주로
// 무슨 달인지를 계산해 적는다 — 그건 지어낸 말이 아니라 엔진이 내는 값이다.
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
  ctaHref,
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
  /** 히어로 아래 버튼이 갈 곳. 없으면 그 버튼을 안 그린다 */
  ctaHref?: string;
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
          그림이 맨 위, 화면 끝까지 (2026-09-09 운영자). 전에는 이모지 하나가
          둥둥 떠 있고 그 아래 글, 다시 그 아래 그림이었다 — 첫 화면에서 무엇을
          파는지는 안 보이고 움직이는 이모지만 보였다. 이모지는 아예 걷었다.
          지금은 그림 → 물음 → 상품명 → 설명 순서고, 움직이는 것은 없다. */}
      <section className="product-hero-stack">
        <div
          className="product-hero-photo"
          style={{ background: `linear-gradient(160deg, ${product.grad[0]}, ${product.grad[1]})` }}
        >
          {/* 그림이 있는 상품만 건다 — 없으면 밑색(grad)만 남는다 (2026-09-09).
              서버 컴포넌트라 onError 로 접을 수 없어 표(CARD_ART)로 가른다. */}
          {hasCardArt(product.id) && (
            <Image
              src={`/cards-pastel/${product.id}.jpg?v=2`}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 640px"
              style={{ objectFit: "cover", objectPosition: "center 18%" }}
            />
          )}
        </div>
        <div className="product-hero-copy">
          <p className="product-hero-question">{headline}</p>
          <h1 className="product-hero-title">{product.title}</h1>
          <p className="product-hero-sub">{sub}</p>
          {activeOffer && (
            /* 단위는 러빗 하나다 (2026-08-31 결정) — 위에서 "9,900원"을 보고
               아래 버튼에서 "19러빗"을 만나면 같은 값인지 알 수 없다. 정가는
               러빗으로 접어 긋고, 원화는 환율 안내로만 한 번 적는다. */
            <p className="product-hero-offer">
              <s>{Math.round(product.price / KRW_PER_CREDIT)}러빗</s>
              {/* 값은 열어본 장수를 탄다 (2·4·10러빗). 여기는 서버 컴포넌트라
                  그 사람이 몇 장 열었는지 모르므로 "첫 장" 이라고 밝혀 적는다. */}
              <strong>첫 장 {READING_PRICE_TIERS[0]}러빗</strong>
              <span>
                {KRW_PER_CREDIT.toLocaleString("ko-KR")}원이 1러빗 · 두 번째 장부터는{" "}
                {READING_PRICE_TIERS[1]}러빗 · 명식은 결제 전에 확인
              </span>
            </p>
          )}
          {hero?.adultOnly && (
            <p className="product-hero-adult">성인 대상 · 노골적 묘사가 아닌 관계 친밀도 해석입니다.</p>
          )}
          {/* 그림 바로 아래 한 번 더 (2026-09-10 운영자). 아래 고정 버튼은
              스크롤 중에는 손에 닿지만, 첫 화면에서 "그래서 어디로 가면
              되는데" 를 묻는 사람에게는 늦다. 같은 곳으로 가는 같은 문구다 —
              두 버튼이 다른 말을 하면 어느 쪽이 진짜인지 재게 된다. */}
          {ctaHref && (
            <ProductCtaGate href={ctaHref} className="product-hero-cta">
              <strong>{product.ctaLabel}</strong>
              <i aria-hidden>→</i>
            </ProductCtaGate>
          )}
        </div>
      </section>

      <div className="product-body">
        <ProductMonthNote product={product} />

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

        {/* ── 리포트 구성 표 (2026-08-25) ──
            줄의 내용은 products.ts 의 reportFacets 로, 목차에 실제로 있는 장만
            요약한 것이다. 분량의 글자 수는 실제 발급본(재회 15절 11,197자,
            속궁합 12절 10,965자, 이별 10절 8,619자)에서 잰 절당 약 800자를
            보수적으로 곱한 값이다 - 부풀리지 않는다. */}
        {/* 카드와 표를 걷고 글로 (2026-09-10 운영자). 네 줄짜리 표는 값이
            나란히 놓일 때 쓰는 것인데 여기 있는 것은 서로 견줄 값이 아니라
            "무엇을 받는가" 를 잇달아 말하는 문장이다. 밑색과 테두리를 걷으니
            읽는 것이 된다. */}
        <section className="product-plain product-reveal">
          <h2>전체 리포트에서 확인하는 것</h2>
          <p>
            {tocTopic(product.toc[0])}부터 {tocTopic(product.toc[product.toc.length - 2])}까지{" "}
            {product.toc.length}개 섹션, 약 {approxChars(product.toc.length)}를 드려요.
          </p>
          <p>
            {product.reportFacets.judgement}을 짚고, {product.reportFacets.risk}를 미리 보고,{" "}
            {product.reportFacets.action}까지 함께 담겨요.
          </p>
          <p className="product-plain-close">{product.ctaHook}</p>
        </section>

        {/* ── 목차 ── 세로로 긴 카드를 옆으로 민다 (2026-09-10 운영자).
            열다섯 줄을 세로로 세우면 그 자체가 한 화면을 먹으면서 "많다" 는
            것만 남고 무엇이 있는지는 안 읽힌다. 옆으로 밀면 한 장씩 읽게 되고,
            반쯤 보이는 다음 장이 더 있다는 것을 말한다. */}
        <section className="product-reveal">
          <h2 className="product-toc-title">이런 결과를 받아요</h2>
          <p className="product-toc-sub">풀 리딩 리포트 목차</p>
          <div className="product-toc-rail">
            {displayToc(product).map((item, index) => (
              <article key={item} className="product-toc-card">
                <span className="product-toc-no">{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </article>
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
              사주 여덟 글자와 목차를 먼저 확인하고, 결제하면 전문이 열립니다.
            </p>
          </section>
        ) : null}

      </div>

      {sticky}
    </main>
  );
}
