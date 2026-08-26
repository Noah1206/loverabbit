"use client";

import { FormEvent, useEffect, useState } from "react";
import { normalizeAttribution } from "@/lib/attribution";
import {
  passkeySupported,
  registerPasskey,
  unlockWithPasskey,
} from "@/lib/admin-passkey-client";

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
  metadata?: Record<string, unknown> | null;
};

/**
 * 어느 광고가 이 주문을 만들었는지 한 줄로.
 *
 * 랜딩은 다섯 개뿐이라 그것만으로는 같은 랜딩에 걸린 소재들이 한 덩어리가 된다.
 * 결제 때 함께 적어 둔 utm 을 여기서 읽는다. 광고 없이 들어온 주문에는 아무것도
 * 없고, 그때는 줄 자체를 그리지 않는다.
 */
function adSource(order: PendingOrder): string | null {
  const attr = normalizeAttribution(
    order.metadata && typeof order.metadata === "object"
      ? (order.metadata as Record<string, unknown>).attribution
      : null
  );
  if (!attr) return null;
  const parts = [attr.source, attr.campaign, attr.content].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const STORAGE_KEY = "loverabbit_admin_approval_key";
/*
  Face ID 로 받은 표는 localStorage 에 둔다.

  승인 키를 sessionStorage 에 두는 것은 탭을 닫으면 지우려는 뜻이다. 이 표는
  다르다 — 12시간이면 서버가 스스로 만료시키고, 훔쳐도 그 시간 뒤에는 죽는다.
  아이폰에서 탭이 정리될 때마다 Face ID 를 다시 대야 한다면 이 기능의 요점이
  없어지므로, 여기서는 남는 쪽이 맞다.
*/
const PASSKEY_STORAGE_KEY = "loverabbit_admin_passkey_session";

export default function AdminPaymentsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyPasskey, setBusyPasskey] = useState(false);
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  // 승인 키로 들어왔는가, Face ID 표로 들어왔는가. 등록 버튼은 앞쪽에만 뜬다.
  const [unlockedBy, setUnlockedBy] = useState<"key" | "passkey" | null>(null);

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
    } catch (reason) {
      setOrders([]);
      setError(reason instanceof Error ? reason.message : "승인 대기 주문을 불러오지 못했어요.");
      if (reason instanceof Error && reason.message.includes("인증")) {
        setAdminKey("");
        setUnlockedBy(null);
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PASSKEY_STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCanUsePasskey(passkeySupported());
    // Face ID 표가 살아 있으면 그걸로 연다. 없으면 예전처럼 승인 키를 본다.
    const session = localStorage.getItem(PASSKEY_STORAGE_KEY);
    if (session) {
      setUnlockedBy("passkey");
      void loadOrders(session);
      return;
    }
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setInputKey(saved);
      setUnlockedBy("key");
      void loadOrders(saved);
    }
  }, []);

  const unlockByFace = async () => {
    setBusyPasskey(true);
    setError("");
    try {
      const token = await unlockWithPasskey();
      localStorage.setItem(PASSKEY_STORAGE_KEY, token);
      setUnlockedBy("passkey");
      await loadOrders(token);
    } catch (reason) {
      // 사용자가 그냥 취소한 것을 오류로 떠들지 않는다.
      const message = reason instanceof Error ? reason.message : "인증에 실패했어요.";
      if (!/NotAllowedError|취소/.test(message)) setError(message);
    } finally {
      setBusyPasskey(false);
    }
  };

  const enrollThisDevice = async () => {
    const key = unlockedBy === "key" ? adminKey : "";
    if (!key) {
      setError("기기를 등록하려면 관리자 키로 먼저 들어와야 해요.");
      return;
    }
    setBusyPasskey(true);
    setError("");
    setNotice("");
    try {
      await registerPasskey(key, "관리자 기기");
      setNotice("이 기기를 등록했어요. 다음부터 Face ID 로 열 수 있어요.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "기기를 등록하지 못했어요.";
      if (!/NotAllowedError|취소/.test(message)) setError(message);
    } finally {
      setBusyPasskey(false);
    }
  };

  const login = (event: FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (!key) return;
    sessionStorage.setItem(STORAGE_KEY, key);
    setUnlockedBy("key");
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
          <p>등록한 기기면 Face ID 로 바로 열 수 있어요.</p>

          {canUsePasskey && (
            <>
              <button
                className="btn"
                type="button"
                onClick={() => void unlockByFace()}
                disabled={busyPasskey || loading}
              >
                {busyPasskey ? "확인 중…" : "Face ID 로 열기"}
              </button>
              <p className="admin-passkey-divider">또는 승인 키로</p>
            </>
          )}
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
          <button
            className={canUsePasskey ? "btn btn-ghost" : "btn"}
            type="submit"
            disabled={loading || !inputKey.trim()}
          >
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
          {/* 등록은 승인 키로 들어왔을 때만. Face ID 표로 새 기기를 심게 두면
              표를 한 번 훔친 사람이 영구 접근을 만든다 — 서버도 같은 이유로
              등록에 승인 키를 요구한다. */}
          {canUsePasskey && unlockedBy === "key" && (
            <button className="btn btn-ghost" onClick={() => void enrollThisDevice()} disabled={busyPasskey}>
              {busyPasskey ? "등록 중…" : "이 기기 등록"}
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(PASSKEY_STORAGE_KEY);
              setAdminKey("");
              setInputKey("");
              setUnlockedBy(null);
            }}
          >
            잠금
          </button>
        </div>
      </header>

      {error && <p className="payment-error">{error}</p>}
      {notice && <p className="admin-passkey-notice">{notice}</p>}

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
                <div><dt>주문코드</dt><dd>{order.depositorCode ?? "없음"}</dd></div>
                <div><dt>회원</dt><dd>{order.email ?? `회원 #${order.userId}`}</dd></div>
                <div><dt>상품</dt><dd>{order.category ?? "사주 리딩"}</dd></div>
                <div><dt>요청시각</dt><dd>{new Date(order.createdAt).toLocaleString("ko-KR")}</dd></div>
                {adSource(order) && (
                  <div><dt>유입 광고</dt><dd>{adSource(order)}</dd></div>
                )}
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
