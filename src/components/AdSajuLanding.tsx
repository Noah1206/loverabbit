import Image from "next/image";
import { notFound } from "next/navigation";
import { AdLandingCta, AdLandingTracker } from "@/components/AdLandingActions";
import ProductRevealObserver from "@/components/ProductRevealObserver";
import { getAdOffer, type AdOfferId } from "@/lib/ad-offers";
import { PRODUCT_MAP } from "@/lib/products";
import { AD_PARTICIPANT_COUNTS } from "@/lib/participant-counts";

/*
  990원은 광고 링크로 들어왔을 때만 붙는다.

  예전에는 이 랜딩이 주소를 보지 않고 늘 990원을 말했다. /saju/dohwasal 을 그냥
  열기만 해도 CTA 에 offer 가 실려 나갔고, 서버는 그 offer 를 그대로 받아 리딩
  값을 990원으로 박았다 - 광고를 한 번도 안 거친 사람이 정가 9,900원짜리를
  990원에 사고 있었다.

  이제 주소에 그 랜딩의 offer 가 실려 있을 때만 오퍼가 산다. 광고 링크에는
  실려 있고(?offer=...), 검색이나 직접 입력으로 들어온 주소에는 없다.

  offer id 자체는 광고 주소에 드러나는 공개값이라, 그걸 본 사람이 주소를 그대로
  퍼뜨리는 것까지는 막지 못한다. 그 뒤는 서버가 막는다 - 한 사람이 이미 유료로
  산 적이 있으면 오퍼를 죽인다(api/reading 의 hasPaidReadingOrder).
*/
export default async function AdSajuLanding({
  offerId,
  searchParams,
}: {
  offerId: AdOfferId;
  searchParams?: Promise<{ offer?: string | string[] }>;
}) {
  const offer = getAdOffer(offerId);
  if (!offer) notFound();
  const product = PRODUCT_MAP[offer.category];
  if (!product) notFound();
  const participantCount = AD_PARTICIPANT_COUNTS[offer.id as keyof typeof AD_PARTICIPANT_COUNTS];

  const query = searchParams ? await searchParams : {};
  const requested = Array.isArray(query.offer) ? query.offer[0] : query.offer;
  const active = requested === offer.id;
  const price = active ? offer.price : product.price;

  const formHref = active
    ? `/reading?c=${encodeURIComponent(product.id)}&offer=${encodeURIComponent(offer.id)}`
    : `/reading?c=${encodeURIComponent(product.id)}`;

  return (
    <main
      className="product-page"
      data-product={product.id}
      data-landing={offer.landingType}
      data-offer={active ? offer.id : undefined}
    >
      <AdLandingTracker landingType={offer.landingType} />
      <ProductRevealObserver />

      <section className="product-hero">
        <div aria-hidden className="product-hero-art">
          <Image
            src={offer.heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            style={{ objectFit: "cover", objectPosition: "center 24%" }}
          />
        </div>
        <div aria-hidden className="product-hero-shade" />
        <div className="product-hero-copy">
          <span className="badge">{offer.badge}</span>
          <h1 style={{ color: "#fff", fontSize: "1.85rem", lineHeight: 1.25, margin: "8px 0 7px" }}>
            {offer.headline}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.86)", fontSize: "0.92rem", lineHeight: 1.55 }}>
            {offer.sub}
          </p>
          {offer.adultOnly && (
            <p style={{ marginTop: 8, color: "rgba(255,255,255,0.68)", fontSize: "0.74rem" }}>
              성인 대상 · 노골적 묘사가 아닌 관계 친밀도 해석입니다.
            </p>
          )}
        </div>
      </section>

      <div style={{ padding: "20px 20px 0", display: "grid", gap: 26 }}>
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

        <section className="card product-story-card product-reveal" style={{ position: "relative", overflow: "hidden" }}>
          <span aria-hidden style={{ position: "absolute", right: -6, top: -18, fontSize: "5.5rem", fontFamily: "serif", fontWeight: 900, color: "var(--accent)", opacity: 0.08 }}>秘傳</span>
          <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.1em", marginBottom: 6 }}>본 사주 분석의 뿌리</p>
          <strong style={{ fontSize: "1.05rem" }}>필사본으로만 전해진 연애 명리 비전, 「연담비결(戀談秘訣)」</strong>
          <ul style={{ margin: "10px 0 0 18px", display: "grid", gap: 6, fontSize: "0.88rem", color: "var(--text)" }}>
            <li className="product-reveal-item">관계의 끌림과 멀어지는 순간을 함께 읽는 명리 해석</li>
            <li className="product-reveal-item">두 사람의 일주와 오행 흐름을 맞대어 보는 방식</li>
            <li className="product-reveal-item">현대적인 관계 질문에 맞춰 개인화한 리포트</li>
          </ul>
        </section>

        <section className="product-reveal">
          <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>전체 리포트 구성</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12 }}>
            무료 미리보기 이후, {product.toc.length}개 섹션의 심층 리포트로 이어집니다
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {product.keywords.map((keyword) => <span key={keyword} className="badge product-reveal-item">{keyword}</span>)}
          </div>
        </section>

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

        <section className="card product-reveal" style={{ padding: "18px", textAlign: "center" }}>
          <span className="badge">먼저 무료로 확인</span>
          <h2 style={{ fontSize: "1.12rem", margin: "12px 0 7px" }}>사주 입력과 운명 미리보기는 무료예요</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
            결과의 첫 부분을 확인한 뒤, 결론과 행동 가이드까지 끝까지 보고 싶을 때만{" "}
            {price.toLocaleString("ko-KR")}원을 결제합니다.
          </p>
        </section>

        <p className="product-reveal" style={{ fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "center" }}>
          본 리딩은 오락 및 자기성찰 목적의 콘텐츠입니다.
        </p>
      </div>

      <div className="product-sticky-shell ad-saju-sticky-shell">
        <span className="ad-saju-participant-badge" aria-label={`${participantCount}명이 참여함`}>
          {participantCount}명이 참여함
        </span>
        <div className="ad-saju-cta-flames" aria-hidden="true">
          <span>🔥</span>
          <span>🔥</span>
          <span>🔥</span>
          <span>🔥</span>
          <span>🔥</span>
          <span>🔥</span>
        </div>
        <AdLandingCta
          href={formHref}
          landingType={offer.landingType}
          signupTitle={offer.loginTitle}
          signupReason={offer.loginReason}
          className="product-sticky-cta"
        >
          <span className="product-sticky-copy">
            <strong>무료로 운명보기</strong>
            <small>결제 없이 무료 미리보기부터</small>
          </span>
          <span className="product-sticky-arrow" aria-hidden>→</span>
        </AdLandingCta>
      </div>
    </main>
  );
}
