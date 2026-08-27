import type { LandingType } from "@/lib/landing-types";

export interface AdOffer {
  id: string;
  category: string;
  price: number;
  landingType: LandingType;
  route: string;
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
    price: 1900,
    landingType: "compatibility",
    route: "/saju/compatibility",
    badge: "궁합 사주",
    headline: "우리 둘, 잘 맞을까?",
    sub: "두 사람의 성향과 관계 온도, 자주 부딪히는 지점을 사주 흐름으로 함께 살펴봅니다.",
    loginTitle: "우리 둘의 궁합, 바로 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 궁합 미리보기로 이어져요.",
  },
  intimate_compatibility_990: {
    id: "intimate_compatibility_990",
    category: "sokgunghap",
    price: 1900,
    landingType: "intimate_compatibility",
    route: "/saju/intimate-compatibility",
    badge: "속궁합 사주",
    headline: "말보다 먼저 맞는 온도",
    sub: "가까워질수록 드러나는 끌림과 주도권, 두 사람만의 친밀도 상성을 섬세하게 읽습니다.",
    loginTitle: "둘만의 속궁합, 지금 확인해요",
    loginReason: "로그인 후 두 사람의 끌림과 친밀도 미리보기로 이어져요.",
  },
  mature_compatibility_990: {
    id: "mature_compatibility_990",
    category: "sokgunghap",
    price: 1900,
    landingType: "mature_compatibility",
    route: "/saju/mature-compatibility",
    badge: "19금 · 속궁합 사주",
    headline: "그 사람과 나는, 가까워질수록 더 잘 맞을까?",
    sub: "겉으로 드러나지 않는 두 사람의 끌림 구조와 친밀도의 상성을 일주 단위로 분석합니다",
    loginTitle: "두 사람의 숨은 온도를 확인해요",
    loginReason: "로그인 후 성인 확인과 두 사람의 속궁합 입력 화면으로 이어져요.",
    adultOnly: true,
  },
  // 이 랜딩이 팔던 인연 타이밍(insun)은 올해의 연애운(yeonae)으로 합쳐졌다
  // (2026-08-24). 주소와 오퍼 id 는 그대로 둔다 - 이 값이 이미 돌고 있는 메타
  // 광고 URL 에 박혀 있어서, 바꾸면 유료 클릭이 정가 페이지에 떨어진다.
  // 파는 상품만 yeonae 로 옮겼고, 히어로 문구는 이 광고가 파는 각도 그대로다.
  romance_timing_990: {
    id: "romance_timing_990",
    category: "yeonae",
    price: 1900,
    landingType: "romance_timing",
    route: "/saju/romance-timing",
    badge: "인연 타이밍",
    headline: "내 다음 인연은, 언제 어디서 올까?",
    sub: "운의 흐름에서 인연의 창이 열리는 시기와 만나게 될 경로, 상대의 윤곽까지 봅니다",
    loginTitle: "다음 인연이 오는 때를 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 인연 타이밍 미리보기로 이어져요.",
  },
  yeonae_990: {
    id: "yeonae_990",
    category: "yeonae",
    price: 1900,
    landingType: "romance_timing",
    route: "/product/yeonae",
    badge: "올해의 연애운",
    headline: "올해 내 연애, 어떻게 흘러갈까?",
    sub: "남은 한 해의 연애운을 월 단위로 펼쳐 기회의 달과 고비의 달을 표시하고, 다음 인연의 창이 열리는 시기와 경로까지 봅니다",
    loginTitle: "올해의 연애 흐름을 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 올해의 연애운 미리보기로 이어져요.",
  },
  // 재회는 전용 랜딩(/saju/...)이 없다. 상품 상세가 곧 랜딩이다 - yeonae_990 과
  // 같은 모양이고, 그 화면이 광고 랜딩과 같은 ProductSalesPage 를 쓴다.
  jaehoe_990: {
    id: "jaehoe_990",
    category: "jaehoe",
    price: 1900,
    landingType: "jaehoe",
    route: "/product/jaehoe",
    badge: "재회신점",
    headline: "그 사람, 아직 나에게 마음이 남아 있을까?",
    sub: "이별 뒤에도 남아 있는 감정의 결을 짚어, 상대 속마음과 다시 이어질 타이밍까지 읽어드립니다",
    loginTitle: "그 사람의 남은 마음을 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 재회 미리보기로 이어져요.",
  },
  breakup_decision_990: {
    id: "breakup_decision_990",
    category: "ibyeol",
    price: 1900,
    landingType: "breakup_decision",
    route: "/saju/breakup-decision",
    badge: "이별 부검 리포트",
    headline: "그 연애는, 어디서부터 어긋났을까?",
    sub: "끝난 연애를 명식으로 부검해 진짜 사인(死因)을 밝히고, 다음 연애의 처방을 남깁니다",
    loginTitle: "그 연애의 진짜 사인을 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 이별 부검 미리보기로 이어져요.",
  },
  inner_mind_990: {
    id: "inner_mind_990",
    category: "sseom",
    price: 1900,
    landingType: "inner_mind",
    // 이 랜딩만 화면을 따로 쓴다(InnerMindLandingClient). ProductSalesPage 를 안 거친다.
    route: "/saju/inner-mind",
    badge: "썸 해부 사주",
    headline: "이 썸, 왜 진도가 안 나갈까?",
    sub: "밀당인지 망설임인지 무관심인지 — 정체된 썸의 브레이크를 찾아냅니다",
    loginTitle: "이 썸의 진짜 속도를 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 썸 해부 미리보기로 이어져요.",
  },
  dohwasal_990: {
    id: "dohwasal_990",
    category: "dohwasal",
    price: 1900,
    landingType: "dohwasal",
    route: "/saju/dohwasal",
    badge: "도화살 진단",
    headline: "나한테 도화살, 진짜 있을까?",
    sub: "명식 속 도화(桃花)의 개수와 위치를 확인하고, 그 매력을 축복으로 쓰는 법을 알려드립니다",
    loginTitle: "내 도화의 위치와 힘을 확인해요",
    loginReason: "로그인 후 생년정보를 입력하면 도화살 진단 미리보기로 이어져요.",
  },
  baramgi_990: {
    id: "baramgi_990",
    category: "baramgi",
    price: 1900,
    landingType: "baramgi",
    route: "/saju/baramgi",
    badge: "바람기 레이더",
    headline: "그 사람, 믿어도 되는 걸까?",
    sub: "상대 명식의 도화 기운과 이성운 흐름으로, 흔들릴 수 있는 시기와 신호를 미리 짚습니다",
    loginTitle: "그 사람의 위험 신호를 확인해요",
    loginReason: "로그인 후 두 사람 정보를 입력하면 바람기 레이더 미리보기로 이어져요.",
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
