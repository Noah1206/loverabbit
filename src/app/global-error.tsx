"use client";

// 뿌리째 깨졌을 때.
//
// app/error.tsx 는 레이아웃 안에서 난 오류만 잡는다. 레이아웃 자체가 깨지면 그
// 경계도 함께 무너지므로 Next 는 이 파일을 대신 띄운다. 그래서 여기서는 html 과
// body 를 직접 써야 한다 — 레이아웃이 없는 상태다.
//
// 같은 이유로 globals.css 가 적용된다는 보장이 없어 꼭 필요한 것만 인라인으로 둔다.

import { useEffect } from "react";
import BackOnError from "@/components/BackOnError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("전체 오류:", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#0f0f13",
          color: "#f2f2f5",
          fontFamily:
            "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>화면을 불러오지 못했어요</h1>
          <p style={{ margin: "0 0 20px", opacity: 0.75, fontSize: "0.9rem" }}>
            보고 계시던 곳으로 되돌아갈게요.
          </p>
          <BackOnError />
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                opacity: 0.65,
                fontSize: "0.85rem",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              이 화면 다시 불러오기
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
