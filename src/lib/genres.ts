// 종목 — 홈이 무엇을 파는지 나누는 가장 바깥 축.
//
// 왜 필요한가.
//
// "종목이 적다" 는 말이 20종을 팔고 있는데도 나왔다. 전부 사주 한 갈래로만
// 보였기 때문이다 — 주제(연애·재물·일)로는 갈라 두었지만, 사용자가 세는 것은
// 주제가 아니라 **무엇을 보는가** 다. 궁합은 상대를 넣어야 하는 다른 종류의
// 일인데 연애 주제 안에 상품 하나로 섞여 있어 보이지 않았다.
//
// 새 데이터를 만들지 않는다. 궁합인지 아닌지는 products.ts 의 needsPartner 가
// 이미 정하고 있다 — 상대 생년월일을 받는 리딩이 곧 궁합이다. 여기서 하는
// 일은 그 값으로 목록을 가르고 이름을 붙이는 것뿐이다.

import { PRODUCTS, type Product } from "@/lib/products";

export type GenreId = "saju" | "tarot" | "idol";

export interface Genre {
  id: GenreId;
  label: string;
  /** 목록 화면 제목 아래 한 줄 */
  desc: string;
  /**
   * 종목 목록 화면 머리에 깔 가로 배너. 없으면 화면이 배너 없이 그린다.
   *
   * 격자에 쓰는 아이콘은 여기 없다 — 그건 GenreIcon 이 선으로 그린다.
   * 캐릭터 그림을 격자에 쓰다 걷었다 (2026-09-08 운영자): 종목 여섯에 얼굴
   * 여섯이 서면 한 화면에 캐릭터가 너무 많아, 대표 캐릭터의 무게가 떨어진다.
   */
  banner?: string;
  /** 목록이 있는 종목만 이 값을 가진다. 없으면 바로 그 화면으로 간다. */
  href: string;
  /** 값 없이 열리는가 — 칸에 "무료" 를 적을지 정한다 */
  free?: boolean;
}

/*
  종목 셋 (2026-09-10 운영자).

  여섯이었다. 궁합·주간월간·사주지도·만세력이 각자 칸을 갖고 있었는데, 넷 다
  "무엇을 볼까" 를 가르는 축이 아니었다 — 궁합은 사주의 한 갈래고, 주간월간은
  같은 사주를 다른 기간으로 볼 뿐이며, 지도와 만세력은 파는 상품이 아니라
  도구다. 칸이 여섯이면 고르는 일이 여섯 갈래가 되는데 실제로 갈리는 것은
  셋이다: 내 사주를 볼까, 카드를 뽑을까, 최애와의 궁합을 볼까.

  궁합 상품은 사주 목록 안에 그대로 있다(productsOfGenre 참고). 없앤 것은
  칸이지 상품이 아니다.

  /period·/guin·/manseryeok 은 제 페이지라 그대로 열린다. /genre/gunghap 만
  404 가 된다 — 그 주소는 이 표를 보고 만들어지던 것이라 표에서 빠지면 함께
  사라진다. 링크가 남은 곳은 없고, 상품은 전부 /genre/saju 에 있다.
*/
export const GENRES: Genre[] = [
  {
    id: "saju",
    label: "사주",
    desc: "내 명식으로 읽는 나의 결",
    banner: "/assets/genre/saju-banner.webp",
    href: "/genre/saju",
  },
  {
    id: "tarot",
    label: "타로",
    desc: "뽑은 카드를 내 결에 겹쳐",
    banner: "/assets/genre/tarot-banner.webp",
    href: "/tarot",
  },
  {
    id: "idol",
    label: "연예인 궁합",
    desc: "최애와 나는 어떤 결일까",
    banner: "/assets/genre/gunghap-banner.webp",
    href: "/product/idol",
  },
];

export const GENRE_MAP = new Map(GENRES.map((g) => [g.id, g]));

/**
 * 종목에 속한 상품. 궁합은 상대를 받는 것(needsPartner), 사주는 나머지다.
 * 지도·만세력은 파는 상품이 아니라 화면 자체라 빈 배열이다.
 */
export function productsOfGenre(id: GenreId): Product[] {
  // 사주가 궁합까지 다 안는다 (2026-09-10). 궁합을 따로 세우지 않기로 하면서
  // 그 상품들이 갈 곳이 없어졌는데, 원래 한 뿌리라 나누지 않는 편이 맞다.
  // 최애 궁합만 뺀다 — 그것은 제 칸을 갖는다.
  if (id === "saju") return PRODUCTS.filter((p) => p.id !== "idol");
  return [];
}
