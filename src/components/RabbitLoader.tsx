"use client";

/*
  기다림의 화면 하나 — 연결점마다 다른 스피너를 두지 않는다.

  로딩·로그인 복귀·결제 승인처럼 "지금 넘어가는 중"인 자리는 전부 이 화면을
  쓴다. 화면마다 다른 문법으로 기다리게 하면 같은 서비스로 읽히지 않는다.

  **기다림에는 반드시 끝이 있어야 한다.** timeoutMs 가 지나면 onTimeout 이
  불리고, 부르는 쪽은 그때 나갈 길을 보여 준다 — 상한 없는 스피너는 사용자를
  가두는 것과 같다. 상한을 두지 않으려면 timeoutMs 에 0 을 준다(예: 사람이
  입금을 확인해 주기를 기다리는 화면).

  영상이 못 오면 포스터가, 포스터도 못 오면 배경색이 남는다. 어느 쪽이든
  글자는 그대로 읽힌다.
*/

import { useEffect, useRef } from "react";

export default function RabbitLoader({
  message,
  sub,
  timeoutMs = 0,
  onTimeout,
  children,
}: {
  message: string;
  /** 한 줄 더 — 왜 기다리는지, 창을 닫아도 되는지 */
  sub?: string;
  /** 이만큼 지나면 onTimeout. 0 이면 상한 없음(사람을 기다리는 화면). */
  timeoutMs?: number;
  onTimeout?: () => void;
  /** 시간이 지난 뒤 나갈 길 — 부르는 쪽이 넣는다 */
  children?: React.ReactNode;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (!timeoutMs || !onTimeout) return;
    fired.current = false;
    const timer = window.setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      onTimeout();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs, onTimeout]);

  return (
    <div className="rabbit-loader">
      <div className="rabbit-loader-art" aria-hidden>
        <video
          src="/assets/loader/rabbit-loading.mp4"
          poster="/assets/loader/rabbit-loading-poster.webp"
          autoPlay
          loop
          muted
          playsInline
          // 자동재생이 막힌 브라우저에서는 poster 가 그대로 남는다 — 그게 폴백이다
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </div>
      {/* 상태 변화를 낭독기가 읽게 한다 — 보이지 않는 사람에게도 기다림은 같다 */}
      <p className="rabbit-loader-text" role="status" aria-live="polite">
        {message}
      </p>
      {sub && <p className="rabbit-loader-sub">{sub}</p>}
      {children && <div className="rabbit-loader-actions">{children}</div>}
    </div>
  );
}
