import type { Metadata } from "next";

import SearchClient from "./SearchClient";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "검색 | 러브레빗",
  description: "속궁합·재회·취업까지, 찾는 이름으로 사주와 타로를 바로 찾아보세요.",
  alternates: { canonical: `${SITE_URL}/search` },
};

export default function SearchPage() {
  return <SearchClient />;
}
