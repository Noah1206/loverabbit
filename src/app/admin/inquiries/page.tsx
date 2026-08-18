"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Inquiry = {
  id: number;
  userId: number | null;
  userEmail: string | null;
  email: string | null;
  category: "payment" | "reading" | "chat" | "account" | "bug" | "etc";
  message: string;
  pagePath: string | null;
  status: "open" | "done";
  adminNote: string | null;
  createdAt: string;
};

// 결제 승인 화면과 같은 키를 쓴다. 한쪽에서 열어두면 다른 쪽도 바로 열린다.
const STORAGE_KEY = "loverabbit_admin_approval_key";

const CATEGORY_LABEL: Record<Inquiry["category"], string> = {
  payment: "결제·입금",
  reading: "사주 리딩",
  chat: "캐릭터 대화",
  account: "계정·로그인",
  bug: "오류 신고",
  etc: "그 외",
};

export default function AdminInquiriesPage() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = async (key: string, status: "open" | "done" | "all") => {
    setLoading(true);
    setError("");
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const response = await fetch(`/api/admin/inquiries${query}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "문의를 불러오지 못했어요.");
      setInquiries(data.inquiries ?? []);
      setAdminKey(key);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (reason) {
      setInquiries([]);
      setError(reason instanceof Error ? reason.message : "문의를 불러오지 못했어요.");
      if (reason instanceof Error && reason.message.includes("인증")) {
        setAdminKey("");
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setInputKey(saved);
      void load(saved, "open");
    }
  }, []);

  const login = (event: FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (!key) return;
    void load(key, filter);
  };

  const changeFilter = (next: "open" | "done" | "all") => {
    setFilter(next);
    if (adminKey) void load(adminKey, next);
  };

  const review = async (inquiry: Inquiry, status: "open" | "done") => {
    setProcessingId(inquiry.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notes[inquiry.id] ?? inquiry.adminNote ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "문의를 처리하지 못했어요.");
      setInquiries((current) =>
        filter === "all"
          ? current.map((item) => (item.id === inquiry.id ? { ...item, ...data } : item))
          : current.filter((item) => item.id !== inquiry.id)
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "문의를 처리하지 못했어요.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!adminKey) {
    return (
      <main className="container admin-payments-page">
        <form className="card admin-login-card" onSubmit={login}>
          <span className="badge">관리자 전용</span>
          <h1>문의함</h1>
          <p>운영 환경에 등록된 관리자 승인 키를 입력해주세요.</p>
          <label>
            관리자 승인 키
            <input
              type="password"
              value={inputKey}
              onChange={(event) => setInputKey(event.target.value)}
              autoComplete="current-password"
              placeholder="16자 이상의 승인 키"
            />
          </label>
          <button className="btn" type="submit" disabled={loading || !inputKey.trim()}>
            {loading ? "확인 중…" : "문의함 열기"}
          </button>
          {error && <p className="payment-error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="container admin-payments-page">
      <header className="admin-payments-header">
        <div>
          <span className="badge">관리자 전용</span>
          <h1>문의함</h1>
          <p>{inquiries.length}건 · {filter === "open" ? "미처리" : filter === "done" ? "처리 완료" : "전체"}</p>
        </div>
        <div>
          <Link className="btn btn-ghost" href="/admin/payments">결제 승인</Link>
          <button className="btn btn-ghost" onClick={() => void load(adminKey, filter)} disabled={loading}>
            새로고침
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setAdminKey("");
              setInputKey("");
            }}
          >
            잠금
          </button>
        </div>
      </header>

      <div className="inquiry-chips" style={{ marginBottom: 18 }}>
        {(["open", "done", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "on" : ""}
            onClick={() => changeFilter(value)}
          >
            {value === "open" ? "미처리" : value === "done" ? "처리 완료" : "전체"}
          </button>
        ))}
      </div>

      {error && <p className="payment-error">{error}</p>}
      {loading && <p style={{ color: "var(--text-dim)" }}>불러오는 중…</p>}
      {!loading && inquiries.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>표시할 문의가 없어요.</p>
      )}

      <div className="admin-order-list">
        {inquiries.map((inquiry) => (
          <article className="card admin-order-card" key={inquiry.id}>
            <div className="admin-order-title">
              <strong>#{inquiry.id} {CATEGORY_LABEL[inquiry.category]}</strong>
              <small>{new Date(inquiry.createdAt).toLocaleString("ko-KR")}</small>
            </div>

            <p className="admin-inquiry-message">{inquiry.message}</p>

            <dl className="admin-inquiry-meta">
              <div>
                <dt>답장할 곳</dt>
                <dd>{inquiry.email ?? inquiry.userEmail ?? "정보 없음"}</dd>
              </div>
              <div>
                <dt>회원</dt>
                <dd>{inquiry.userId ? `#${inquiry.userId} ${inquiry.userEmail ?? ""}` : "비로그인"}</dd>
              </div>
              <div>
                <dt>보낸 화면</dt>
                <dd>{inquiry.pagePath ?? "-"}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{inquiry.status === "done" ? "처리 완료" : "미처리"}</dd>
              </div>
            </dl>

            <label>
              메모
              <input
                value={notes[inquiry.id] ?? inquiry.adminNote ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [inquiry.id]: event.target.value }))
                }
                placeholder="답장 내용이나 처리 결과를 적어두세요"
              />
            </label>

            <div className="admin-order-actions">
              {inquiry.email || inquiry.userEmail ? (
                <a
                  className="btn btn-ghost"
                  href={`mailto:${inquiry.email ?? inquiry.userEmail}?subject=${encodeURIComponent(
                    `[러브레빗] 문의 #${inquiry.id} 답변`
                  )}`}
                >
                  메일로 답장
                </a>
              ) : null}
              {inquiry.status === "open" ? (
                <button
                  className="btn"
                  disabled={processingId === inquiry.id}
                  onClick={() => void review(inquiry, "done")}
                >
                  {processingId === inquiry.id ? "처리 중…" : "처리 완료로 표시"}
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  disabled={processingId === inquiry.id}
                  onClick={() => void review(inquiry, "open")}
                >
                  다시 열기
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
