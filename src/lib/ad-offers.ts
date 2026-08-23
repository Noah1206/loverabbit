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
    badge: "19금 · 속궁합 사주",
    headline: "그 사람과 나는, 가까워질수록 더 잘 맞을까?",
    sub: "겉으로 드러나지 않는 두 사람의 끌림 구조와 친밀도의 상성을 일주 단위로 분석합니다",
    loginTitle: "두 사람의 숨은 온도를 확인해요",
    loginReason: "로그인 후 성인 확인과 두 사람의 속궁합 입력 화면으로 이어져요.",
    adultOnly: true,
  },
  romance_timing_990: {
    id: "romance_timing_990",
    category: "insun",
    price: 990,
    landingType: "romance_timing",
    route: "/saju/romance-timing",
    heroImage: "/ads/saju/romance-timing-bg.png",
    badge: "인연 타이밍",
    headline: "내 다음 인연은, 언제 어디서 올까?",
    sub: "운의 흐름에서 인연의 창이 열리는 시기와 만나게 될 경로, 상대의 윤곽까지 봅니다",
    loginTitle: "다음 인연이 오는 때를 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 인연 타이밍 미리보기로 이어져요.",
  },
  yeonae_990: {
    id: "yeonae_990",
    category: "yeonae",
    price: 990,
    landingType: "romance_timing",
    route: "/product/yeonae",
    heroImage: "/cards-pastel/yeonae.jpg",
    badge: "올해의 연애운",
    headline: "올해 내 연애, 어떻게 흘러갈까?",
    sub: "남은 한 해의 연애운을 월 단위로 펼쳐 기회의 달과 고비의 달을 미리 표시합니다",
    loginTitle: "올해의 연애 흐름을 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 올해의 연애운 미리보기로 이어져요.",
  },
  breakup_decision_990: {
    id: "breakup_decision_990",
    category: "ibyeol",
    price: 990,
    landingType: "breakup_decision",
    route: "/saju/breakup-decision",
    heroImage: "/ads/saju/breakup-decision-bg.png",
    badge: "이별 부검 리포트",
    headline: "그 연애는, 어디서부터 어긋났을까?",
    sub: "끝난 연애를 명식으로 부검해 진짜 사인(死因)을 밝히고, 다음 연애의 처방을 남깁니다",
    loginTitle: "그 연애의 진짜 사인을 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 이별 부검 미리보기로 이어져요.",
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
    badge: "썸 해부 사주",
    headline: "이 썸, 왜 진도가 안 나갈까?",
    sub: "밀당인지 망설임인지 무관심인지 — 정체된 썸의 브레이크를 찾아냅니다",
    loginTitle: "이 썸의 진짜 속도를 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 썸 해부 미리보기로 이어져요.",
  },
  dohwasal_990: {
    id: "dohwasal_990",
    category: "dohwasal",
    price: 990,
    landingType: "dohwasal",
    route: "/saju/dohwasal",
    heroImage: "/cards-pastel/dohwasal.jpg",
    badge: "도화살 진단",
    headline: "나한테 도화살, 진짜 있을까?",
    sub: "명식 속 도화(桃花)의 개수와 위치를 확인하고, 그 매력을 축복으로 쓰는 법을 알려드립니다",
    loginTitle: "내 도화의 위치와 힘을 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 도화살 진단 미리보기로 이어져요.",
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
