// 이 파일은 marketing/video/build-card-motion.mjs 가 생성한다. 손으로 고치지 마라.
//
// public/cards-motion/<id>.mp4 가 실제로 있는 카드만 들어 있다. 여기 이름이
// 있으면 화면이 그 카드에서 영상을 틀려 하고, 없으면 정지 그림 그대로 간다.

export const CARD_MOTION: readonly string[] = [
  "bamgijil",
  "baramgi",
  "bimil",
  "dohwasal",
  "gwontaegi",
  "gyeolhon",
  "hwanseung",
  "ibyeol",
  "jaehoe",
  "jjak",
  "sokgunghap",
  "sseom",
  "yeonae",
];

export function hasCardMotion(category: string | undefined | null): boolean {
  return !!category && CARD_MOTION.includes(category);
}
