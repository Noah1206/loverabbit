"use client";

import Link from "next/link";
import { useState } from "react";

import { IDOL_CHIP_ORDER, IDOL_GROUP_MAP } from "@/lib/idols";

/*
  연예인 궁합 — 최애를 이름으로 고른다.

  아이돌 궁합 상품은 상대 생년월일을 받는데, 최애의 생일을 외우는 사람은
  드물다. 그 한 칸이 비어서 상품 앞에서 돌아섰다.

  이름을 누르면 그 그룹으로 간다. 명단(lib/idols.ts)에 담은 것은 공개 프로필
  세 가지 — 그룹·활동명·생년월일 — 뿐이고, 계산에 필요하지 않은 것은 담지
  않는다.

  칩만 두고 그림을 안 쓴 이유: 얼굴 사진은 초상이라 이 저장소가 들고 있을
  것이 아니다. 대신 섹션 자체에 캐릭터 그림을 한 장 세워 결을 맞춘다.
*/

/** 처음 보이는 칩 수. 나머지는 "더보기" 뒤에 */
const FOLD = 8;

export default function IdolPicker() {
  const [open, setOpen] = useState(false);
  const ids = open ? IDOL_CHIP_ORDER : IDOL_CHIP_ORDER.slice(0, FOLD);

  return (
    <section className="ip">
      <header className="ip-head">
        <small>최애와 나, 무슨 사이?!</small>
        <h2>연예인 궁합</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ip-art" src="/home/idol.jpg" alt="" loading="lazy" />
      </header>

      <div className="ip-chips">
        {ids.map((id) => {
          const g = IDOL_GROUP_MAP.get(id);
          if (!g) return null;
          return (
            <Link key={id} href={`/idol/${id}`} className="ip-chip">
              {g.label}
            </Link>
          );
        })}
        {!open && IDOL_CHIP_ORDER.length > FOLD && (
          <button className="ip-chip ip-chip-more" onClick={() => setOpen(true)}>
            더보기
          </button>
        )}
      </div>
    </section>
  );
}
