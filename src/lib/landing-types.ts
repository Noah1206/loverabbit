export const LANDING_TYPES = [
  "compatibility",
  "intimate_compatibility",
  "mature_compatibility",
  "romance_timing",
  "breakup_decision",
  "inner_mind",
  "dohwasal",
  "baramgi",
] as const;

export type LandingType = (typeof LANDING_TYPES)[number];
