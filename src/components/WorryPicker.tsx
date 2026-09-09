"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PRODUCT_MAP } from "@/lib/products";
import { getUser } from "@/lib/user";
import { WORRY_IDS } from "@/components/worry-ids";

/*
  고민 고르기 — 상품 목록 대신 물음으로 묻는다.

  종목 줄이 "무엇을 볼까" 를 묻는다면 여기는 "무엇이 걸리는가" 를 묻는다.
  둘은 다른 길이다: 종목은 이미 사주를 보기로 정한 사람의 길이고, 이쪽은
  아직 정하지 않았지만 마음에 걸리는 게 있는 사람의 길이다.

  **문구를 새로 짓지 않는다.** 상품마다 headline 이 이미 물음 형태로 쓰여
  있다("그 사람, 아직 나에게 마음이 남아 있을까?"). 그것을 그대로 카드에
  올린다 — 여기서 새로 쓰면 같은 상품이 두 가지 말로 팔리게 된다.

  옆으로 밀어 보게 둔 이유: 고민을 세로로 늘어놓으면 목록이 되고, 목록은
  훑는 것이지 고르는 것이 아니다. 한 번에 하나 반이 보이면 그 하나를 읽게
  된다.
*/


export default function WorryPicker() {
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const user = getUser();
    if (!user?.email) return;
    // 별명이 없으므로 이메일 앞부분을 쓴다 — 없으면 이름 없이 묻는다.
    setName(user.email.split("@")[0] ?? "");
  }, []);

  const items = WORRY_IDS.map((id) => PRODUCT_MAP[id]).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <section className="wp">
      <header className="wp-head">
        <small>지금 바로 고민 해결</small>
        <h2>{name ? `${name}님의 고민 1순위는?` : "지금 가장 걸리는 고민은?"}</h2>
      </header>

      <p className="wp-lead">
        지금 가장 마음에 걸리는 것을 하나 골라보세요.
      </p>

      <div className="wp-rail">
        {items.map((p) => (
          <article key={p.id} className="wp-card" data-tone={p.tone}>
            <div className="wp-card-art">
              {/* 이 줄만의 그림이다 (2026-09-09 운영자). 상품 카드
                  (cards-pastel)는 3D 렌더라 "무엇을 파는가" 를 말하는데, 여기서
                  묻는 것은 "무엇이 걸리는가" 다 — 사는 사람의 기분에 가까운
                  그림이 필요했다. 그래서 고민마다 손그림 한 장을 따로 둔다.

                  그림 안에 글자를 넣지 않았다. 물음은 아래 wp-card-q 가 적고,
                  그 문구는 상품의 headline 이다 — 그림에 새기면 상품 문구를
                  고칠 때마다 그림을 다시 그려야 한다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/worry/${p.id}.jpg`} alt="" loading="lazy" />
            </div>
            <p className="wp-card-q">{p.headline}</p>
            <Link href={`/product/${p.id}`} className="wp-card-btn">
              선택 <i aria-hidden>→</i>
            </Link>
          </article>
        ))}
      </div>

      <p className="wp-foot">카드를 옆으로 넘겨 더 많은 고민을 확인하세요</p>
    </section>
  );
}
