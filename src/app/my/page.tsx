"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listArchive, updateArchive, removeFromArchive, type ArchiveEntry } from "@/lib/archive";
import ChatSection from "@/components/ChatSection";
import PaymentModal from "@/components/PaymentModal";
import SignupModal from "@/components/SignupModal";
import { getUser, type User } from "@/lib/user";

const MEMBERSHIP_KEY = "loverabbit_membership_v1";

export default function MyPage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [membership, setMembership] = useState<{ token: string; expiresAt: number } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEntries(listArchive());
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBERSHIP_KEY) ?? "null");
      if (saved?.expiresAt > Date.now()) setMembership(saved);
    } catch {}
    setUser(getUser());
  }, []);

  const open = entries.find((e) => e.readingId === openId) ?? null;
  const depositorCode = open ? `레빗-${open.readingId.slice(0, 4).toUpperCase()}` : "";

  // 보관함에서 해금 — 리딩 페이지와 동일한 /api/unlock 경로 사용
  const unlock = async (method: "transfer" | "membership") => {
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
          method,
          depositorCode: method === "transfer" ? depositorCode : undefined,
          membershipToken: method === "membership" ? membership?.token : undefined,
          userToken: user?.token,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "해금 실패");
      const full = (await res.json()).full as string;
      updateArchive(open.readingId, { full });
      setEntries(listArchive());
      setShowPay(false);
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
                    {e.full
                      ? <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", background: "var(--violet)", padding: "2px 8px", borderRadius: 999 }}>해금됨</span>
                      : <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", background: "var(--accent)", padding: "2px 8px", borderRadius: 999 }}>티저만</span>}
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
                      <ChatSection
                        readingId={e.readingId}
                        blob={e.blob}
                        membershipToken={membership?.token ?? null}
                      />
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                      <p style={{ fontSize: "0.88rem", marginBottom: 10 }}>풀 리딩이 아직 잠겨 있어요.</p>
                      {membership ? (
                        <button className="btn" onClick={() => unlock("membership")} disabled={paying}>
                          {paying ? "해금 중…" : "멤버십으로 무료 열기 🌙"}
                        </button>
                      ) : (
                        <button className="btn" onClick={() => (user ? setShowPay(true) : setShowSignup(true))} disabled={paying}>
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
          price={open.price}
          depositorCode={depositorCode}
          paying={paying}
          onDone={() => unlock("transfer")}
          onClose={() => setShowPay(false)}
        />
      )}
    </main>
  );
}
