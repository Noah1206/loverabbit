"use client";

import Link from "next/link";

/*
  귀인지도 — 배너가 아니라 요소로 (2026-09-09 운영자).

  슬라이드 배너 안에 있었다. 배너는 3초마다 넘어가므로 읽는 도중에 사라지고,
  이 화면은 값이 없는 것(무료)이 가장 큰 정보라 그 한 줄이 넘어가면 안 된다.

  형태는 참고 화면을 따른다 — 색 블록 하나에 왼쪽은 글, 오른쪽은 캐릭터.
  배너와 다른 점은 넘어가지 않고 제자리에 선다는 것이다.
*/
export default function GuinTeaser() {
  return (
    <Link href="/guin" className="gt">
      <span className="gt-copy">
        <span className="gt-tag">
          무료 <i aria-hidden>›</i>
        </span>
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
