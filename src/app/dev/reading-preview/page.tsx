"use client";

// 생성해 둔 리딩을 **실제 결과 페이지 디자인 그대로** 보기 위한 개발 전용 화면.
//
// 결과 페이지(/reading/[id])는 보관함(localStorage)에서 리딩을 읽는다. 그래서
// 여기서 하는 일은 딱 하나다 — 생성한 리딩을 보관함에 해금 상태로 심고 넘겨준다.
// 화면을 새로 그리지 않으므로, 여기 보이는 것이 사용자가 실제로 보는 것이다.
//
// ?product=sokgunghap 으로 상품을 고른다. 없으면 가장 최근에 만든 것.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveToArchive, type ArchiveEntry } from "@/lib/archive";

// useSearchParams 를 쓰는 컴포넌트는 빌드 때 미리 그려질 수 없다 — 주소창의 쿼리는
// 그 순간에 없기 때문이다. Suspense 로 감싸지 않으면 next build 가 이 페이지에서
// 통째로 멈춘다. 개발용 화면 하나 때문에 배포가 막히는 자리라 경계를 명시해 둔다.
export default function ReadingPreviewPage() {
  return (
    <Suspense fallback={<main style={{ padding: 40 }}>불러오는 중이에요…</main>}>
      <ReadingPreview />
    </Suspense>
  );
}

function ReadingPreview() {
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("product");
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [note, setNote] = useState("생성해 둔 리딩을 불러오는 중이에요…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dev/reading-preview${wanted ? `?product=${wanted}` : ""}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "불러오지 못했어요.");
          return;
        }
        setAvailable(data.available ?? []);
        const entry = data.entry as ArchiveEntry;
        saveToArchive(entry);
        setNote(`${entry.label} — 결과 화면으로 넘어가요.`);
        router.replace(`/reading/${entry.readingId}`);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, wanted]);

  return (
    <main style={{ padding: "48px 20px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>리딩 미리보기 (개발 전용)</h1>
      {error ? (
        <p style={{ color: "var(--text-dim)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{error}</p>
      ) : (
        <p style={{ color: "var(--text-dim)" }}>{note}</p>
      )}
      {available.length > 1 && (
        <p style={{ marginTop: 16, color: "var(--text-dim)", fontSize: 13 }}>
          만들어 둔 상품: {available.join(" · ")}
        </p>
      )}
    </main>
  );
}
