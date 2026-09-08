import type { Metadata } from "next";
import { notFound } from "next/navigation";

import GenreList from "./GenreList";
import { GENRES, GENRE_MAP, productsOfGenre, type GenreId } from "@/lib/genres";
import { SITE_URL } from "@/lib/site";

/*
  종목 목록 — 한 종목에 속한 사주를 세로 리스트로 편다.

  왜 격자가 아니라 리스트인가. 홈의 주제 줄은 카드 그림이 크게 서서 무엇을
  파는지 분위기로 먼저 말한다. 여기는 다르다 — 종목을 고르고 들어온 사람은
  이미 무엇을 볼지 정했고, 남은 일은 **그중 어느 것인지 고르는 것**이다.
  그때 필요한 것은 분위기가 아니라 제목과 태그가 한 줄에 다 보이는 목록이다.
*/

export function generateStaticParams() {
  return GENRES.filter((g) => g.href.startsWith("/genre/")).map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const genre = GENRE_MAP.get(id as GenreId);
  if (!genre) return {};
  return {
    title: `${genre.label} — ${genre.desc} | 러브레빗`,
    description: `${genre.desc}. ${productsOfGenre(genre.id).length}가지 ${genre.label} 리딩을 한자리에서 골라보세요.`,
    alternates: { canonical: `${SITE_URL}/genre/${genre.id}` },
  };
}

export default async function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const genre = GENRE_MAP.get(id as GenreId);
  // 목록이 없는 종목(지도·만세력)은 이 주소를 쓰지 않는다 — 그 화면이 곧 종목이다
  if (!genre || !genre.href.startsWith("/genre/")) notFound();

  const items = productsOfGenre(genre.id);
  if (!items.length) notFound();

  return <GenreList genre={genre} items={items} />;
}
