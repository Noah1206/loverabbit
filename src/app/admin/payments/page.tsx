"use client";

import { FormEvent, useEffect, useState } from "react";

type PendingOrder = {
  id: number;
  userId: number;
  readingId: string | null;
  kind: "reading" | "membership" | "chat_credits";
  email: string | null;
  category: string | null;
  status: "pending";
  amount: number;
  depositorCode: string | null;
  createdAt: string;
};

const STORAGE_KEY = "loverabbit_admin_approval_key";

export default function AdminPaymentsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadOrders = async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payments", {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "승인 대기 주문을 불러오지 못했어요.");
      setOrders(data.orders ?? []);
      setAdminKey(key);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (reason) {
      setOrders([]);
      setError(reason instanceof Error ? reason.message : "승인 대기 주문을 불러오지 못했어요.");
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
      void loadOrders(saved);
    }
  }, []);

  const login = (event: FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (!key) return;
    void loadOrders(key);
  };

  const review = async (order: PendingOrder, decision: "paid" | "cancelled") => {
    const action = decision === "paid"
      ? order.kind === "chat_credits"
        ? "입금을 승인하고 대화권을 지급"
        : "입금을 승인하고 풀 리딩을 열기"
      : "이 요청을 거절";
    if (!window.confirm(`#${order.id} 주문의 ${action}할까요?`)) return;
    setProcessingId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/payments/${order.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision, note: notes[order.id] ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "주문을 처리하지 못했어요.");
      setOrders((current) => current.filter((item) => item.id !== order.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "주문을 처리하지 못했어요.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!adminKey) {
    return (
      <main className="container admin-payments-page">
        <form className="card admin-login-card" onSubmit={login}>
          <span className="badge">관리자 전용</span>
          <h1>계좌이체 승인 관리</h1>
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
            {loading ? "확인 중…" : "승인 목록 열기"}
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
          <h1>입금 승인 대기</h1>
          <p>{orders.length}건의 주문을 확인해주세요.</p>
        </div>
        <div>
          <button className="btn btn-ghost" onClick={() => void loadOrders(adminKey)} disabled={loading}>
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

      {error && <p className="payment-error">{error}</p>}

      {orders.length === 0 ? (
        <section className="card admin-empty-orders">
          <span aria-hidden>✓</span>
          <h2>현재 승인 대기 주문이 없어요</h2>
          <p>새 입금 확인 요청이 들어오면 여기에 표시됩니다.</p>
        </section>
      ) : (
        <div className="admin-order-list">
          {orders.map((order) => (
            <article className="card admin-order-card" key={order.id}>
              <div className="admin-order-title">
                <div>
                  <small>주문 #{order.id}</small>
                  <h2>{order.amount.toLocaleString()}원</h2>
                </div>
                <span className="badge">{order.kind === "chat_credits" ? "대화권" : "리딩"} · 승인 대기</span>
              </div>
              <dl>
                <div><dt>입금코드</dt><dd>{order.depositorCode ?? "없음"}</dd></div>
                <div><dt>회원</dt><dd>{order.email ?? `회원 #${order.userId}`}</dd></div>
                <div><dt>상품</dt><dd>{order.category ?? "사주 리딩"}</dd></div>
                <div><dt>요청시각</dt><dd>{new Date(order.createdAt).toLocaleString("ko-KR")}</dd></div>
              </dl>
              <label>
                운영 메모
                <input
                  value={notes[order.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [order.id]: event.target.value }))
                  }
                  maxLength={500}
                  placeholder="예: 입금자명 확인 완료"
                />
              </label>
              <div className="admin-order-actions">
                <button
                  className="btn"
                  onClick={() => void review(order, "paid")}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id
                    ? "처리 중…"
                    : order.kind === "chat_credits"
                      ? "입금 승인 · 대화권 지급"
                      : "입금 승인 · 리딩 열기"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void review(order, "cancelled")}
                  disabled={processingId === order.id}
                >
                  승인 거절
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
