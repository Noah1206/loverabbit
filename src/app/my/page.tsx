"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listArchive, updateArchive, removeFromArchive, type ArchiveEntry } from "@/lib/archive";
import ChatSection from "@/components/ChatSection";
import PaymentModal from "@/components/PaymentModal";
import SignupModal from "@/components/SignupModal";
import { savePendingReading, takePendingReading } from "@/lib/pending-reading";
import { getUser, type User } from "@/lib/user";

export default function MyPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);

  useEffect(() => {
    const archived = listArchive();
    const params = new URLSearchParams(window.location.search);
    const requestedReading = params.get("open");
    setEntries(archived);
    if (requestedReading && archived.some((entry) => entry.readingId === requestedReading)) {
      setOpenId(requestedReading);
    }
    setPaymentApproved(params.get("payment") === "approved");
    const stored = getUser();
    setUser(stored);
    if (stored) {
      const pending = takePendingReading();
      if (pending?.source === "archive") {
        setOpenId(pending.result.readingId);
        setShowPay(true);
      }
    }
  }, []);

  const open = entries.find((e) => e.readingId === openId) ?? null;
  const depositorCode = open ? `레빗-${open.readingId.slice(0, 4).toUpperCase()}` : "";

  // 보관함에서도 계좌이체 확인 요청 후 관리자 승인 대기 페이지로 이동한다.
  const unlock = async () => {
    if (!open) return;
    setPaying(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: open.readingId,
          blob: open.blob,
          method: "transfer",
          depositorCode,
          userToken: user?.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "입금 확인 요청 실패");
      if (!Number.isSafeInteger(Number(data.orderId))) {
        throw new Error("승인 대기 주문 번호를 받지 못했어요.");
      }
      updateArchive(open.readingId, { pendingOrderId: Number(data.orderId) });
      setEntries(listArchive());
      setShowPay(false);
      router.push(`/payment/pending?orderId=${encodeURIComponent(String(data.orderId))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
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
          <p style={{ fontSize: "2rem" }}>🐰</p>
          <p style={{ marginBottom: 16 }}>아직 받은 리딩이 없어요.</p>
          <Link href="/reading" className="btn">첫 리딩 받으러 가기 →</Link>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {entries.map((e) => {
          const isOpen = openId === e.readingId;
          return (
            <div key={e.readingId} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpenId(isOpen ? null : e.readingId)}
                style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--text)" }}
              >
                <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--bg-card2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>🔮</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{e.label}</strong>
                    {e.full ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", background: "var(--violet)", padding: "2px 8px", borderRadius: 999 }}>해금됨</span>
                    ) : e.pendingOrderId ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", background: "#9f6b19", padding: "2px 8px", borderRadius: 999 }}>승인 대기</span>
                    ) : (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", background: "var(--accent)", padding: "2px 8px", borderRadius: 999 }}>티저만</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {new Date(e.createdAt).toLocaleDateString("ko-KR")} · {e.teaser}
                  </p>
                </div>
                <span style={{ color: "var(--text-dim)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div className="card" style={{ background: "var(--bg-card2)", fontSize: "0.82rem", color: "var(--text-dim)", padding: 14, marginBottom: 12 }}>
                    <strong style={{ color: "var(--gold)" }}>내 사주</strong> {e.chart.me}
                    {e.chart.partner && (<><br /><strong style={{ color: "var(--gold)" }}>그 사람</strong> {e.chart.partner}</>)}
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", marginBottom: 12 }}>{e.teaser}</p>

                  {e.full ? (
                    <>
                      <div className="card" style={{ background: "var(--bg-card2)", padding: 16 }}>
                        <p style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem" }}>{e.full}</p>
                      </div>
                      <ChatSection readingId={e.readingId} blob={e.blob} />
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                      <p style={{ fontSize: "0.88rem", marginBottom: 10 }}>풀 리딩이 아직 잠겨 있어요.</p>
                      {e.pendingOrderId ? (
                        <Link className="btn" href={`/payment/pending?orderId=${e.pendingOrderId}`}>
                          입금 승인 상태 확인
                        </Link>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => {
                            if (user) {
                              setShowPay(true);
                              return;
                            }
                            savePendingReading({
                              source: "archive",
                              category: e.category,
                              createdAt: Date.now(),
                              result: {
                                readingId: e.readingId,
                                teaser: e.teaser,
                                chart: e.chart,
                                price: e.price,
                                blob: e.blob,
                                previewSections: [],
                                lockedSectionTitles: [],
                                demo: false,
                              },
                            });
                            setShowSignup(true);
                          }}
                          disabled={paying}
                        >
                          {user ? "풀 리딩 해금" : "가입하고 풀 리딩 해금"} — {e.price.toLocaleString()}원
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    className="btn btn-ghost"
                    style={{ width: "100%", marginTop: 12, fontSize: "0.85rem" }}
                    onClick={() => {
                      if (window.confirm("이 리딩을 보관함에서 삭제할까요?")) {
                        removeFromArchive(e.readingId);
                        setEntries(listArchive());
                        setOpenId(null);
                      }
                    }}
                  >
                    보관함에서 삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p style={{ color: "var(--accent)", marginTop: 12 }}>{error}</p>}

      {showSignup && (
        <SignupModal
          onDone={(u) => {
            setUser(u);
            setShowSignup(false);
            setShowPay(true);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}

      {showPay && open && (
        <PaymentModal
          readingId={open.readingId}
          price={open.price}
          userToken={user?.token ?? ""}
          customerEmail={user?.email ?? ""}
          depositorCode={depositorCode}
          paying={paying}
          onTransferSubmitted={unlock}
          onClose={() => setShowPay(false)}
        />
      )}
    </main>
  );
}
