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

export type GenreId = "saju" | "gunghap" | "period" | "map" | "manseryeok";

export interface Genre {
  id: GenreId;
  label: string;
  /** 목록 화면 제목 아래 한 줄 */
  desc: string;
  art: string;
  /** 목록이 있는 종목만 이 값을 가진다. 없으면 바로 그 화면으로 간다. */
  href: string;
  /** 값 없이 열리는가 — 칸에 "무료" 를 적을지 정한다 */
  free?: boolean;
}

export const GENRES: Genre[] = [
  {
    id: "saju",
    label: "사주",
    desc: "내 명식으로 읽는 나의 결",
    art: "/assets/zodiac/rabbit-hanbok.webp",
    href: "/genre/saju",
  },
  {
    id: "gunghap",
    label: "궁합",
    desc: "두 사람 사이를 읽는다",
    art: "/assets/zodiac/rooster-hanbok.webp",
    href: "/genre/gunghap",
  },
  {
    id: "period",
    label: "주간·월간",
    desc: "이번 주와 이번 달의 흐름",
    art: "/assets/zodiac/horse-hanbok.webp",
    href: "/period",
    free: true,
  },
  {
    id: "map",
    label: "사주지도",
    desc: "내 주변 사람들과의 인연",
    art: "/assets/zodiac/monkey-hanbok.webp",
    href: "/guin",
    free: true,
  },
  {
    id: "manseryeok",
    label: "만세력",
    desc: "내 여덟 글자를 그대로",
    art: "/assets/zodiac/dragon-hanbok.webp",
    href: "/manseryeok",
    free: true,
  },
];

export const GENRE_MAP = new Map(GENRES.map((g) => [g.id, g]));

/**
 * 종목에 속한 상품. 궁합은 상대를 받는 것(needsPartner), 사주는 나머지다.
 * 지도·만세력은 파는 상품이 아니라 화면 자체라 빈 배열이다.
 */
export function productsOfGenre(id: GenreId): Product[] {
  if (id === "gunghap") return PRODUCTS.filter((p) => p.needsPartner);
  if (id === "saju") return PRODUCTS.filter((p) => !p.needsPartner);
  return [];
}
