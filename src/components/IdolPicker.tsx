"use client";

import Link from "next/link";

import { IDOL_CHIP_ORDER, IDOL_GROUP_MAP } from "@/lib/idols";

/*
  연예인 궁합 — 최애를 이름으로 고른다.

  아이돌 궁합 상품은 상대 생년월일을 받는데, 최애의 생일을 외우는 사람은
  드물다. 그 한 칸이 비어서 상품 앞에서 돌아섰다.

  이름을 누르면 그 그룹으로 간다. 명단(lib/idols.ts)에 담은 것은 공개 프로필
  세 가지 — 그룹·활동명·생년월일 — 뿐이고, 계산에 필요하지 않은 것은 담지
  않는다.

  얼굴 사진은 쓰지 않는다 — 초상이라 이 저장소가 들고 있을 것이 아니다.

  제목 옆 작은 그림도 걷었다 (2026-09-09). 그림이 3D 인물로 바뀌면서, 작게
  잘리면 사람 얼굴이 반만 나온다. 배너에 큰 그림이 이미 서 있으므로 여기서는
  글과 알약만으로 충분하다.

  "더보기" 를 걷었다 (2026-09-09). 옆으로 미는 줄이 되면서 접을 이유가
  없어졌다 — 서른셋이 한 줄에 있어도 자리를 더 먹지 않고, 접으면 오히려
  뒤에 뭐가 있는지 모른다.

  카드마다 이니셜 표식을 세운다. 그룹 로고를 쓸 수 없어서(등록 상표) 고유색
  위에 이니셜을 얹은 것인데, 글자만 있던 알약보다 눈으로 고르기 쉽다.
*/
export default function IdolPicker() {
  return (
    <section className="ip">
      <header className="ip-head">
        <small>최애와 나, 무슨 사이?!</small>
        <h2>연예인 궁합</h2>
      </header>

      <div className="ip-cards">
        {IDOL_CHIP_ORDER.map((id) => {
          const g = IDOL_GROUP_MAP.get(id);
          if (!g) return null;
          return (
            <Link key={id} href={`/idol/${id}`} className="ip-card">
              {/* 로고 대신 이니셜 카드 (2026-09-09 운영자). 그룹 로고는 소속사의
                  등록 상표라 담을 수 없다 — 생년월일만 담고 사진·본명을 뺀 것과
                  같은 선이다. 이니셜과 고유색으로 그 자리를 대신한다. */}
              <span className="ip-card-mark" style={{ background: g.color }}>
                {g.mark}
              </span>
              <strong>{g.label}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
