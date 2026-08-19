import type { LandingType } from "@/lib/landing-types";

export interface AdOffer {
  id: string;
  category: string;
  price: number;
  landingType: LandingType;
  route: string;
  heroImage: string;
  badge: string;
  headline: string;
  sub: string;
  adultOnly?: boolean;
}

export const AD_OFFERS = {
  compatibility_990: {
    id: "compatibility_990",
    category: "sokgunghap",
    price: 990,
    landingType: "compatibility",
    route: "/saju/compatibility",
    heroImage: "/ads/saju/compatibility-bg.png",
    badge: "궁합 사주",
    headline: "우리 둘, 잘 맞을까?",
    sub: "두 사람의 성향과 관계 온도, 자주 부딪히는 지점을 사주 흐름으로 함께 살펴봅니다.",
  },
  intimate_compatibility_990: {
    id: "intimate_compatibility_990",
    category: "sokgunghap",
    price: 990,
    landingType: "intimate_compatibility",
    route: "/saju/intimate-compatibility",
    heroImage: "/ads/saju/intimate-compatibility-bg.png",
    badge: "속궁합 사주",
    headline: "말보다 먼저 맞는 온도",
    sub: "가까워질수록 드러나는 끌림과 주도권, 두 사람만의 친밀도 상성을 섬세하게 읽습니다.",
  },
  mature_compatibility_990: {
    id: "mature_compatibility_990",
    category: "sokgunghap",
    price: 990,
    landingType: "mature_compatibility",
    route: "/saju/mature-compatibility",
    heroImage: "/ads/saju/mature-compatibility-bg.png",
    badge: "19금 사주",
    headline: "밤이 되면 달라지는 궁합",
    sub: "두 사람의 끌림과 친밀감, 관계의 완급을 성인 대상의 사주 해석으로 살펴봅니다.",
    adultOnly: true,
  },
  romance_timing_990: {
    id: "romance_timing_990",
    category: "insun",
    price: 990,
    landingType: "romance_timing",
    route: "/saju/romance-timing",
    heroImage: "/ads/saju/romance-timing-bg.png",
    badge: "연애운 사주",
    headline: "이번 사랑, 언제 시작될까?",
    sub: "인연의 창이 열리는 시기와 만남의 경로, 스쳐 가기 전에 알아볼 신호를 확인합니다.",
  },
  breakup_decision_990: {
    id: "breakup_decision_990",
    category: "ibyeol",
    price: 990,
    landingType: "breakup_decision",
    route: "/saju/breakup-decision",
    heroImage: "/ads/saju/breakup-decision-bg.png",
    badge: "이별 사주",
    headline: "끝낼까, 붙잡을까?",
    sub: "반복되는 갈등의 원인과 관계의 흐름을 살펴보고, 다음 선택의 기준을 정리합니다.",
  },
} as const satisfies Record<string, AdOffer>;

export type AdOfferId = keyof typeof AD_OFFERS;

export function getAdOffer(value: string | undefined | null): AdOffer | null {
  if (!value || !(value in AD_OFFERS)) return null;
  return AD_OFFERS[value as AdOfferId] as AdOffer;
}

export function resolveAdOffer(category: string, value: string | undefined | null): AdOffer | null {
  const offer = getAdOffer(value);
  return offer?.category === category ? offer : null;
}
