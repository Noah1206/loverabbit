"use client";

// 화면이 깨졌을 때.
//
// 여기 아무것도 없었다. 그래서 어느 화면이든 렌더링 도중 예외가 나면 Next 의 기본
// 오류 화면이 떴다 — 개발 모드에서는 스택 트레이스가, 운영에서는 영어 한 줄이.
// 어느 쪽이든 사 주려던 사람이 볼 화면은 아니고, 빠져나갈 문도 없다.
//
// 이 경계는 하던 자리로 되돌린다. reset() 을 먼저 걸어 두는 것은 일시적인
// 실패(네트워크가 한 번 끊긴 것 같은)를 되돌아가지 않고 넘길 수 있어서다.

import { useEffect } from "react";
import BackOnError from "@/components/BackOnError";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // digest 는 서버 로그의 같은 오류를 가리키는 번호다. 사람에게 보여 줄 것은
    // 아니지만 문의가 들어왔을 때 이 줄로 찾는다.
    console.error("화면 오류:", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h1>화면을 불러오지 못했어요</h1>
        <p>보고 계시던 곳으로 되돌아갈게요.</p>
        <BackOnError />
        <button className="btn btn-ghost" type="button" onClick={reset}>
          이 화면 다시 불러오기
        </button>
      </section>
    </main>
  );
}
