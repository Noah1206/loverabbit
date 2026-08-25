"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { flushFunnel, trackFunnel } from "@/lib/funnel";

/**
 * 어느 화면을 열었고 어디서 떠났는가.
 *
 * 화면마다 손으로 붙이지 않고 여기 한 곳에서 잡는다. 이탈 지점을 알자고 만든
 * 것이라 빠진 화면이 하나라도 있으면 그 화면은 "아무도 안 나간 곳" 으로 보인다 —
 * 실제로는 안 세고 있었을 뿐인데.
 *
 * 세션의 마지막 발자국이 곧 이탈 지점이다. 그래서 page_exit 이 없어도 답은
 * 나오지만, 머문 시간은 떠날 때만 알 수 있어 함께 남긴다. 3초를 보고 나간
 * 화면과 2분을 붙잡고 나간 화면은 같은 이탈이 아니다.
 */
export default function FunnelTracker() {
  const pathname = usePathname();
  // 지금 화면에 언제 들어왔나. 떠날 때 빼서 머문 시간을 만든다.
  const enteredAt = useRef<number>(Date.now());
  const current = useRef<string | null>(null);
  /*
    이 화면의 이탈을 이미 적었는가.

    떠나는 순간에 pagehide 와 visibilitychange 가 둘 다 운다. 둘 다 걸어 둔 것은
    한쪽만 우는 브라우저가 있어서인데, 대부분의 브라우저에서는 둘 다 울어 같은
    이탈이 두 번 적힌다. 두 번째 줄은 시계를 방금 맞춘 직후라 체류가 0ms 이고,
    그 0 이 중앙값을 끌어내려 "다들 순식간에 나갔다" 로 보이게 만든다.

    이탈 화면 수는 세션의 마지막 줄만 세므로 중복에 흔들리지 않지만, 체류
    시간은 흔들린다. 한 화면에 한 번만 적는다.
  */
  const exited = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    // 화면을 갈아탔다면 앞 화면을 먼저 닫는다. 이걸 빼면 한 세션에서 연 화면이
    // 전부 "안 떠난 화면" 이 되고, 머문 시간도 마지막 하나만 남는다.
    if (current.current && current.current !== pathname) {
      trackFunnel("page_exit", {
        path: current.current,
        dwellMs: Date.now() - enteredAt.current,
      });
    }

    current.current = pathname;
    enteredAt.current = Date.now();
    exited.current = false;
    trackFunnel("page_view", { path: pathname });
  }, [pathname]);

  useEffect(() => {
    // 탭을 닫거나 앱을 전환하는 순간. 여기가 진짜 이탈이다.
    const leave = () => {
      if (!current.current || exited.current) return;
      exited.current = true;
      trackFunnel("page_exit", {
        path: current.current,
        dwellMs: Date.now() - enteredAt.current,
      });
      flushFunnel(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leave();
        return;
      }
      // 탭으로 돌아왔다. 자리를 비운 동안은 머문 시간이 아니므로 시계를 다시
      // 맞추고, 다음 이탈을 받을 수 있게 잠금을 푼다.
      enteredAt.current = Date.now();
      exited.current = false;
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
