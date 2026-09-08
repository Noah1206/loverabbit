import type { Metadata } from "next";

import { loadGuinMap } from "@/lib/guin-db";
import { isDatabaseConfigured } from "@/lib/database";

/*
  공유 링크의 미리보기.

  지금까지 카카오·메신저에 지도 링크를 붙이면 사이트 기본 문구가 떴다
  ("러브레빗 — 마음과 인연을 읽다"). 누가 무엇을 보냈는지가 안 보이니
  열어볼 이유도 안 생긴다.

  이 파일은 **서버 컴포넌트**다. 지도 화면(page.tsx)은 "use client" 라 metadata 를
  내보낼 수 없어서, 그 위에 얇은 레이아웃 하나를 두고 여기서만 만든다.

  싣는 것은 별명 하나뿐이다. 참여자 이름도, 점수도, 생년월일도 넣지 않는다 —
  미리보기는 링크를 받은 사람 말고도 누가 볼지 모르는 자리다.
*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  // DB 가 없거나 못 읽으면 조용히 기본값으로 — 미리보기 때문에 화면이 죽지 않는다.
  if (!isDatabaseConfigured()) return {};
  try {
    const map = await loadGuinMap(token);
    if (!map || map.status !== "active") return {};

    const title = `${map.ownerNickname}님의 사주지도`;
    const description = "너는 나에게 어떤 인연일까? 생일만 입력하면 지도에 나타나요 🐰";
    return {
      title,
      description,
      openGraph: { title, description, images: ["/og.jpg"] },
      // 남의 지도가 검색에 걸릴 이유가 없다. 링크를 받은 사람만 보는 자리다.
      robots: { index: false, follow: false },
    };
  } catch {
    return {};
  }
}

export default function GuinMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
