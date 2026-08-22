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
  loginTitle: string;
  loginReason: string;
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
    loginTitle: "우리 둘의 궁합, 바로 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 궁합 미리보기로 이어져요.",
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
    loginTitle: "둘만의 속궁합, 지금 확인해요",
    loginReason: "로그인 후 두 사람의 끌림과 친밀도 미리보기로 이어져요.",
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
    loginTitle: "밤의 궁합, 어디까지 맞을까요?",
    loginReason: "로그인 후 성인 확인과 두 사람 정보 입력으로 이어져요.",
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
    loginTitle: "다음 사랑의 타이밍을 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 연애운 미리보기로 이어져요.",
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
    loginTitle: "끝낼지 붙잡을지, 기준을 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 이별 사주 미리보기로 이어져요.",
  },
  inner_mind_990: {
    id: "inner_mind_990",
    category: "sseom",
    price: 990,
    landingType: "inner_mind",
    // 이 랜딩만 화면을 따로 쓴다(InnerMindLandingClient). AdSajuLanding 을 안 거치므로
    // heroImage 는 실제로 그려지지 않지만, 다른 오퍼와 같은 모양을 유지한다 -
    // 한 칸만 비면 나중에 이 오퍼가 예외로 남아 조용히 어긋난다.
    route: "/saju/inner-mind",
    heroImage: "/ads/saju/compatibility-bg.png",
    badge: "속마음 사주",
    headline: "그 사람 속마음, 뭘까?",
    sub: "말과 행동이 어긋나는 지점과 지금 관계가 어디쯤 와 있는지를 사주 흐름으로 짚습니다.",
    loginTitle: "그 사람의 속마음을 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 속마음 미리보기로 이어져요.",
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
