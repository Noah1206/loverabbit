import { notFound } from "next/navigation";
import { AdLandingCta, AdLandingTracker } from "@/components/AdLandingActions";
import ProductSalesPage from "@/components/ProductSalesPage";
import { getAdOffer, type AdOfferId } from "@/lib/ad-offers";
import { PRODUCT_MAP } from "@/lib/products";
import { AD_PARTICIPANT_COUNTS } from "@/lib/participant-counts";

/*
  광고가 데려오는 문 — /saju/<랜딩>.

  화면은 상품 상세와 같은 ProductSalesPage 하나다. 예전에는 이 랜딩이 화면을
  따로 들고 있었고, 그래서 상품 상세만 카드 모션을 받고 광고 랜딩은 정지 그림에
  멈춰 있었다. 광고비를 태워 데려온 사람이 오히려 옛 화면을 봤다.

  이 문에서만 다른 것은 셋이다.
    - 히어로 문구: 같은 상품이라도 광고가 파는 각도가 다르다
      (속궁합 / 19금 / 일반 궁합은 전부 sokgunghap 한 상품이다)
    - 하단 CTA: 참여 배지 · 불꽃 여섯 · 픽셀 이벤트가 붙는다
    - 랜딩 표식: 픽셀이 이 값으로 랜딩을 가른다

  1,900원은 광고 링크로 들어왔을 때만 붙는다.

  예전에는 이 랜딩이 주소를 보지 않고 늘 1,900원을 말했다. /saju/dohwasal 을 그냥
  열기만 해도 CTA 에 offer 가 실려 나갔고, 서버는 그 offer 를 그대로 받아 리딩
  값을 1,900원으로 박았다 - 광고를 한 번도 안 거친 사람이 정가 9,900원짜리를
  1,900원에 사고 있었다.

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

  const formHref = active
    ? `/reading?c=${encodeURIComponent(product.id)}&offer=${encodeURIComponent(offer.id)}`
    : `/reading?c=${encodeURIComponent(product.id)}`;

  return (
    <ProductSalesPage
      product={product}
      activeOffer={active ? offer : null}
      landingType={offer.landingType}
      hero={{
        badge: offer.badge,
        headline: offer.headline,
        sub: offer.sub,
        adultOnly: offer.adultOnly,
      }}
      sticky={
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
            className="product-sticky-cta"
          >
            <span className="product-sticky-copy">
              <strong>내 사주 세우기</strong>
              <small>
                {active
                  ? `첫 리딩 ${offer.price.toLocaleString("ko-KR")}원 · 명식은 결제 전에 확인`
                  : "첫 리딩 1,900원 · 명식은 결제 전에 확인"}
              </small>
            </span>
            <span className="product-sticky-arrow" aria-hidden>→</span>
          </AdLandingCta>
        </div>
      }
    >
      <AdLandingTracker landingType={offer.landingType} />
    </ProductSalesPage>
  );
}
