/**
 * 고민 고르기 카드에 세울 고민들 (2026-09-09).
 *
 * 컴포넌트에서 뺀 이유: WorryPicker 는 "use client" 라 테스트가 그대로 읽으면
 * 리액트까지 딸려 온다. 목록만 따로 두면 화면과 테스트가 같은 표를 본다.
 *
 * 상품 id 만 적는다 — 문구는 products.ts 의 headline 에서 온다. 여기에 id 를
 * 더하면 public/worry/<id>.jpg 도 함께 넣어야 하고, 안 넣으면 테스트가 잡는다.
 */
export const WORRY_IDS = [
  "jaehoe",
  "sseom",
  "gwontaegi",
  "baramgi",
  "jjak",
  "gyeolhon",
] as const;
