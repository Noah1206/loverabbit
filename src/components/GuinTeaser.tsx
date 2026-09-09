"use client";

import Link from "next/link";

/*
  귀인지도 — 배너가 아니라 요소로 (2026-09-09 운영자).

  슬라이드 배너 안에 있었다. 배너는 3초마다 넘어가므로 읽는 도중에 사라진다.

  형태는 참고 화면을 따른다 — 한지 블록 하나에 왼쪽은 글, 오른쪽은 수묵.
  배너와 다른 점은 넘어가지 않고 제자리에 선다는 것이다.

  "무료" 알약은 걷었다 (2026-09-09 운영자). 수묵 위에 검은 알약이 얹히면
  그림의 결이 끊긴다. 값이 없다는 정보는 종목 줄(genres.ts 의 free)과
  사주지도 화면이 이미 지고 있어, 여기서 한 번 더 말하지 않아도 된다.
*/
export default function GuinTeaser() {
  return (
    <Link href="/guin" className="gt">
      <span className="gt-copy">
        <strong>
          내 주변 사람 중
          <br />
          누가 진짜 내 귀인일까?
        </strong>
        <small>친구·연인·동료를 등록하면 인연 지도가 그려져요</small>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gt-art" src="/home/guin.jpg" alt="" loading="lazy" />
    </Link>
  );
}
