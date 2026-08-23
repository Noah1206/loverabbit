// CTA 사회적 증거 숫자 — 페이지별로 고정해 SSR/클라이언트 표시가 달라지지 않게 한다.
export const AD_PARTICIPANT_COUNTS = {
  compatibility_990: 354,
  intimate_compatibility_990: 428,
  mature_compatibility_990: 581,
  romance_timing_990: 267,
  breakup_decision_990: 693,
  dohwasal_990: 438,
} as const;

export const PRODUCT_PARTICIPANT_COUNTS: Record<string, number> = {
  sokgunghap: 482, jaehoe: 637, bamgijil: 391, baramgi: 524,
  gyeolhon: 308, gwontaegi: 447, hwanseung: 572, sseom: 286, jjak: 619,
  bimil: 355, ibyeol: 704, dohwasal: 438, insun: 261, yeonae: 587,
};

export const INNER_MIND_PARTICIPANT_COUNT = 749;
