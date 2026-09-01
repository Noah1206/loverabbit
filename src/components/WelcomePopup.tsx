"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FIRST_READING_PRICE } from "@/lib/coupons";
import { useEscape } from "@/lib/use-escape";

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
  useEscape(() => {
    if (open) close();
  });

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
        {/* 닫기는 진짜 버튼이어야 한다 — 그림에 그려진 X 는 눌리지 않는다.
            그래서 포스터에는 X 를 그리지 않았다. */}
        <button type="button" className="welcome-popup-close" onClick={close} aria-label="닫기">
          ✕
        </button>

        {/* 포스터 한 장. 문구("궁금해? 러브레빗한테 물어봐")까지 그림에 들어 있다
            (2026-09-02 운영자 결정) — 그래서 화면에는 h3 을 두지 않고, 대신
            낭독기와 검색을 위해 alt 로 같은 말을 남긴다.

            값은 그림에 넣지 않았다. 오늘 환율이 바뀌었듯 가격은 또 바뀌고,
            구워 두면 그때마다 그림을 다시 만들어야 한다. */}
        <img
          className="welcome-popup-poster"
          src="/assets/home/welcome-poster.webp"
          alt="궁금해? 러브레빗한테 물어봐"
          id="welcome-popup-title"
        />

        <p className="welcome-popup-price">
          어떤 사주든 첫 한 장은 {FIRST_READING_PRICE.toLocaleString("ko-KR")}원
        </p>

        <button type="button" className="btn welcome-popup-cta" onClick={close}>
          내 사주 보러가기
        </button>
      </div>
    </div>
  );
}
