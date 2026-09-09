"use client";

import Link from "next/link";

import type { IdolGroup } from "@/lib/idols";

/*
  최애 고르기 — 그룹 안에서 한 명.

  누르면 리딩 폼으로 가면서 그 사람의 생년월일을 URL 로 들고 간다(?pb=).
  공개 프로필의 값이라 URL 에 실어도 새로 새는 것이 없고, 폼에서 사용자가
  고쳐 넣으면 그쪽이 이긴다.

  얼굴 사진은 두지 않는다 — 초상이라 이 저장소가 들고 있을 것이 아니다.
  이름과 생일만으로도 고르는 데 모자라지 않는다.
*/
export default function IdolGroupView({ group }: { group: IdolGroup }) {
  return (
    <main className="container ig" style={{ paddingTop: 28 }}>
      <Link href="/" className="ig-back" aria-label="홈으로">
        ‹ 홈
      </Link>

      <p className="ig-lead">최애와 나, 무슨 사이?!</p>
      <h1 className="ig-h1">{group.label}</h1>
      <p className="ig-sub">멤버를 고르면 생년월일이 채워져요.</p>

      <div className="ig-members">
        {group.members.map((m) => (
          <Link
            key={m.name}
            href={`/reading?c=idol&pb=${m.birth}`}
            className="ig-member"
          >
            <strong>{m.name}</strong>
            <small>{m.birth.replace(/-/g, ".")}</small>
            <i aria-hidden>›</i>
          </Link>
        ))}
      </div>

      <p className="ig-note">
        생년월일은 공개된 프로필 값이에요. 태어난 시는 공개값이 아니라서 연·월·일
        세 기둥으로 봅니다.
      </p>

      <Link href="/product/idol" className="ig-direct">
        명단에 없는 사람은 직접 입력하기 <i aria-hidden>›</i>
      </Link>
    </main>
  );
}
