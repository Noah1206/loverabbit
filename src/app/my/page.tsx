"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listArchive, removeFromArchive, type ArchiveEntry } from "@/lib/archive";
import BrandMark from "@/components/BrandMark";

// 보관함은 목록만 담당한다. 리딩 본문·해금·추가 상담은 기사 페이지(/reading/[id])에서 처리한다.
export default function MyPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [paymentApproved, setPaymentApproved] = useState(false);

  useEffect(() => {
    const archived = listArchive();
    setEntries(archived);

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("open");
    const approved = params.get("payment") === "approved";
    setPaymentApproved(approved);
    // 결제/승인 화면에서 넘어온 열기 요청은 곧장 그 리딩 기사로 보낸다
    if (requested && archived.some((entry) => entry.readingId === requested)) {
      router.replace(`/reading/${requested}${approved ? "?payment=approved" : ""}`);
    }
  }, [router]);

  const remove = (readingId: string) => {
    if (!window.confirm("이 리딩을 보관함에서 삭제할까요?")) return;
    removeFromArchive(readingId);
    setEntries(listArchive());
  };

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 6 }}>📜 내 상담</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        이 기기에서 받은 리딩이 자동으로 보관됩니다.
      </p>

      {paymentApproved && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)", background: "var(--bg-card2)" }}>
          <strong style={{ color: "var(--accent-soft)" }}>✓ 입금 확인이 완료됐어요</strong>
          <p style={{ marginTop: 4, fontSize: "0.84rem", color: "var(--text-dim)" }}>
            승인된 풀 리딩을 바로 열어두었습니다.
          </p>
        </div>
      )}

      {entries.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><BrandMark size={52} /></div>
          <p style={{ marginBottom: 16 }}>아직 받은 리딩이 없어요.</p>
          <Link href="/reading" className="btn">첫 리딩 받으러 가기 →</Link>
        </div>
      )}

      <div className="archive-list">
        {entries.map((entry) => (
          <div key={entry.readingId} className="archive-row">
            <Link href={`/reading/${entry.readingId}`} className="archive-link">
              <span className="archive-icon" aria-hidden>🔮</span>
              <span className="archive-copy">
                <span className="archive-title">
                  <strong>{entry.label}</strong>
                  {entry.full ? (
                    <em className="on">해금됨</em>
                  ) : entry.pendingOrderId ? (
                    <em className="pending">승인 대기</em>
                  ) : (
                    <em>티저만</em>
                  )}
                </span>
                <span className="archive-excerpt">
                  {new Date(entry.createdAt).toLocaleDateString("ko-KR")} · {entry.teaser}
                </span>
              </span>
              <span className="archive-arrow" aria-hidden>›</span>
            </Link>
            <button type="button" className="archive-remove" onClick={() => remove(entry.readingId)}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
