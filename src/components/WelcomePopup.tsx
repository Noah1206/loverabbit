"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FIRST_READING_PRICE } from "@/lib/coupons";

/*
  처음 온 사람에게 한 번 뜨는 팝업 — "첫 사주는 무조건 1,900원".

  광고에서 온 사람은 상품 페이지 9초에서 나간다. 값을 첫 화면 어디에 적어도
  안 읽는 사람이 있어서, 한 번은 눈앞에 세운다. 한 브라우저에 한 번만 (localStorage).

  뜨는 곳: 홈, 상품 페이지, 광고 랜딩. 폼·결제·리딩·관리자 화면에서는 안 뜬다 —
  거기서는 이미 하던 일이 있다.
*/

const KEY = "lr_welcome_popup_v1";
const SHOW_ON = [/^\/$/, /^\/product\//, /^\/saju\//];

export default function WelcomePopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!SHOW_ON.some((re) => re.test(pathname ?? ""))) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [pathname]);

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // 저장이 막힌 브라우저면 다음 방문에 한 번 더 뜬다. 그 정도는 괜찮다.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="app-modal-layer welcome-popup-layer" role="dialog" aria-modal="true" aria-labelledby="welcome-popup-title" onClick={close}>
      <div className="card welcome-popup" onClick={(event) => event.stopPropagation()}>
        <span className="welcome-popup-icon" aria-hidden>🐰</span>
        <span className="badge">처음 오셨나요?</span>
        <h3 id="welcome-popup-title">
          첫 사주는 무조건
          <br />
          <em>{FIRST_READING_PRICE.toLocaleString("ko-KR")}원</em>에 봐드립니다
        </h3>
        <p>
          어떤 사주든 첫 한 장은 {FIRST_READING_PRICE.toLocaleString("ko-KR")}원이에요.
          <br />
          명식은 결제 전에 먼저 확인할 수 있어요.
        </p>
        <button type="button" className="btn welcome-popup-cta" onClick={close}>
          네, 사주 볼게요
        </button>
      </div>
    </div>
  );
}
