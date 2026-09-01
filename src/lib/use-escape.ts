"use client";

import { useEffect } from "react";

/** 열려 있는 동안 Escape 로 닫는다 — 모달 네 곳이 같이 쓴다. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}
