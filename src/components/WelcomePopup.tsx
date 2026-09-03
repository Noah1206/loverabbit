"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { FIRST_READING_PRICE } from "@/lib/coupons";
import { useEscape } from "@/lib/use-escape";

/*
  처음 온 사람에게 한 번 뜨는 팝업 — "첫 사주는 무조건 1,900원".
  포춘 앱 이벤트 팝업 꼴(2026-09-04 운영자 지시): 골드 카드, 배지,
  초대형 가격, 재물 토끼, 진갈색 CTA.

  광고에서 온 사람은 상품 페이지 9초에서 나간다. 값을 첫 화면 어디에 적어도
  안 읽는 사람이 있어서, 한 번은 눈앞에 세운다. 방문할 때마다 뜬다
  (2026-09-04 운영자 — 브라우저당 1회에서 바꿈). sessionStorage 라 탭을
  닫았다 다시 오면 또 뜨고, 같은 세션 안에서 페이지를 오갈 때는 안 뜬다.

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
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [pathname]);

  const close = () => {
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // 저장이 막힌 브라우저면 다음 방문에 한 번 더 뜬다. 그 정도는 괜찮다.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="app-modal-layer welcome-popup-layer" role="dialog" aria-modal="true" aria-labelledby="welcome-popup-title" onClick={close}>
      <div className="card welcome-popup" onClick={(event) => event.stopPropagation()}>
        {/* 추석 장식 — 배경 그라데이션(달·금화 무더기·구름)은 카드가 그리고,
            움직이는 잎·반짝임만 요소로 띄운다. 전부 장식이라 aria-hidden. */}
        <span className="welcome-popup-deco" aria-hidden="true">
          <i className="wp-leaf wp-leaf-1">🍁</i>
          <i className="wp-leaf wp-leaf-2">🍂</i>
          <i className="wp-leaf wp-leaf-3">🍁</i>
          <i className="wp-leaf wp-leaf-4">🍂</i>
          <i className="wp-spark wp-spark-1">✦</i>
          <i className="wp-spark wp-spark-2">✦</i>
          <i className="wp-spark wp-spark-3">✧</i>
        </span>

        <button type="button" className="welcome-popup-close" onClick={close} aria-label="닫기">
          ✕
        </button>

        {/* 값은 그림에 굽지 않는다 — 가격이 바뀌면 코드만 고치면 된다. */}
        <span className="welcome-popup-badge">첫 가입 한정 혜택</span>

        <h3 className="welcome-popup-headline" id="welcome-popup-title">
          첫 사주 리딩
        </h3>

        <p className="welcome-popup-big-price" aria-label={`${FIRST_READING_PRICE.toLocaleString("ko-KR")}원`}>
          <strong>{FIRST_READING_PRICE.toLocaleString("ko-KR")}</strong>
          <span>원</span>
        </p>

        <img className="welcome-popup-mascot" src="/assets/today/rabbit-hello-hanbok.webp" alt="" />

        <p className="welcome-popup-price">어떤 사주든, 처음 온 분께만 드리는 가격이에요</p>

        <button type="button" className="btn welcome-popup-cta" onClick={close}>
          내 사주 보러가기
        </button>
      </div>
    </div>
  );
}
