"use client";

// 오류가 났을 때 이전 페이지로 되돌리는 조각.
//
// 오류 화면에서 사람이 하는 일은 대개 하나다 — 뒤로 가기. 그런데 지금까지는
// "홈으로 돌아가기" 버튼 하나뿐이라, 결제 직전까지 왔던 사람도 처음으로 돌아갔다.
//
// 두 가지를 조심한다.
//
//  1. **되돌이표.** 이전 페이지가 또 오류를 내면 뒤로-오류-뒤로가 무한히 돈다.
//     한 번 저절로 되돌린 뒤에는 잠깐 동안 다시 하지 않는다. 그때는 버튼만 둔다.
//  2. **들어온 자리.** 광고 링크로 바로 들어온 사람은 뒤로 갈 데가 없다.
//     그때는 history 를 건드리지 않고 정해진 곳으로 보낸다.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FLAG = "lr-back-on-error";
/** 이 시간 안에 또 오류가 나면 저절로 되돌리기를 멈춘다 */
const COOLDOWN_MS = 8000;

export default function BackOnError({
  fallback = "/",
  delayMs = 900,
  label = "이전 화면",
  auto = true,
}: {
  /** 뒤로 갈 데가 없을 때 보낼 곳 */
  fallback?: string;
  /** 사람이 무슨 일이 났는지 읽을 틈 */
  delayMs?: number;
  label?: string;
  /**
   * 저절로 되돌아갈지. 끄면 버튼으로만 움직인다 — 다시 해 볼 여지가 있는 오류
   * 옆에서는 저절로 화면이 바뀌면 다시 시도할 틈이 없다.
   *
   * 도중에 켜져도 된다(첫 실패에는 끄고, 두 번째 실패에 켜는 식으로).
   */
  auto?: boolean;
}) {
  const router = useRouter();
  // 되돌이표를 막느라 자동 되돌리기를 포기한 상태. 버튼은 그대로 남는다.
  const [held, setHeld] = useState(false);
  const fired = useRef(false);

  const goBack = () => {
    // 뒤로 갈 자리가 있는지는 브라우저만 안다. 없으면 정해진 곳으로.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace(fallback);
  };

  useEffect(() => {
    if (!auto || fired.current) return;
    fired.current = true;

    let recent = 0;
    try {
      recent = Number(sessionStorage.getItem(FLAG) ?? 0);
      if (Date.now() - recent < COOLDOWN_MS) {
        setHeld(true);
        return;
      }
      sessionStorage.setItem(FLAG, String(Date.now()));
    } catch {
      // 사생활 모드처럼 저장이 막힌 곳이 있다. 그때는 저절로 되돌리지 않는다 —
      // 되돌이표를 막을 방법이 없는 채로 저절로 움직이면 안 된다.
      setHeld(true);
      return;
    }

    const timer = setTimeout(goBack, delayMs);
    return () => clearTimeout(timer);
    // goBack 은 router 만 붙잡고 있어 다시 만들 이유가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, delayMs]);

  return (
    <button className="btn" type="button" onClick={goBack}>
      {auto && !held ? `${label}으로 돌아가는 중…` : label}
    </button>
  );
}
