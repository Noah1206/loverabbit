"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Review = {
  id: number;
  source: "live" | "beta";
  userId: number | null;
  readingId: string | null;
  displayName: string;
  productId: string | null;
  productLabel: string;
  /** 베타 후기에는 별점이 없다 */
  rating: number | null;
  body: string | null;
  purchaseCount: number;
  status: "published" | "hidden";
  hiddenReason: string | null;
  importKey: string | null;
  createdAt: string;
};

// 문의함·결제 승인과 같은 키를 쓴다. 한쪽에서 열어두면 다른 쪽도 바로 열린다.
const STORAGE_KEY = "loverabbit_admin_approval_key";

export default function AdminReviewsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"published" | "hidden" | "all">("all");
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = async (key: string, status: "published" | "hidden" | "all") => {
    setLoading(true);
    setError("");
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const response = await fetch(`/api/admin/reviews${query}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "후기를 불러오지 못했어요.");
      setReviews(data.reviews ?? []);
      setAdminKey(key);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (reason) {
      setReviews([]);
      setError(reason instanceof Error ? reason.message : "후기를 불러오지 못했어요.");
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
      void load(saved, "all");
    }
  }, []);

  const login = (event: FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (!key) return;
    void load(key, filter);
  };

  const changeFilter = (next: "published" | "hidden" | "all") => {
    setFilter(next);
    if (adminKey) void load(adminKey, next);
  };

  const moderate = async (review: Review, status: "published" | "hidden") => {
    const reason = (reasons[review.id] ?? review.hiddenReason ?? "").trim();
    if (status === "hidden" && reason.length < 2) {
      setError("후기를 내리려면 사유를 먼저 적어주세요.");
      return;
    }
    setProcessingId(review.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "후기를 처리하지 못했어요.");
      setReviews((current) =>
        filter === "all"
          ? current.map((item) => (item.id === review.id ? { ...item, ...data } : item))
          : current.filter((item) => item.id !== review.id)
      );
    } catch (reason2) {
      setError(reason2 instanceof Error ? reason2.message : "후기를 처리하지 못했어요.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!adminKey) {
    return (
      <main className="container admin-payments-page">
        <form className="card admin-login-card" onSubmit={login}>
          <span className="badge">관리자 전용</span>
          <h1>후기 관리</h1>
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
            {loading ? "확인 중…" : "후기 관리 열기"}
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
          <h1>후기 관리</h1>
          <p>
            {reviews.length}건 ·{" "}
            {filter === "published" ? "노출 중" : filter === "hidden" ? "내려둠" : "전체"}
          </p>
        </div>
        <div>
          <Link className="btn btn-ghost" href="/admin/inquiries">문의함</Link>
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

      {/* 후기는 들어오는 대로 바로 노출된다. 이 화면은 승인하는 곳이 아니라
          도배·욕설·개인정보가 섞였을 때 사유를 남기고 내리는 곳이다.
          별점이 낮다고 내리면 남은 후기 전체가 거짓말이 된다. */}
      <p className="admin-review-policy">
        후기는 결제하고 리딩을 열어 본 분만 쓸 수 있고, 들어오는 즉시 홈에 노출됩니다.
        도배·욕설·개인정보가 담긴 경우에만 사유를 적어 내려주세요.
        <br />
        <b>출처 &lsquo;베타 테스트&rsquo;</b>는 베타 때 받아 옮겨 담은 후기라 별점이 없습니다
        (<code>npm run reviews:import</code>). 원본에 없던 별점을 나중에 채워 넣지 마세요.
      </p>

      <div className="inquiry-chips" style={{ marginBottom: 18 }}>
        {(["all", "published", "hidden"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "on" : ""}
            onClick={() => changeFilter(value)}
          >
            {value === "all" ? "전체" : value === "published" ? "노출 중" : "내려둠"}
          </button>
        ))}
      </div>

      {error && <p className="payment-error">{error}</p>}
      {loading && <p style={{ color: "var(--text-dim)" }}>불러오는 중…</p>}
      {!loading && reviews.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>아직 들어온 후기가 없어요.</p>
      )}

      <div className="admin-order-list">
        {reviews.map((review) => (
          <article className="card admin-order-card" key={review.id}>
            <div className="admin-order-title">
              <strong>
                #{review.id}{" "}
                {review.rating === null
                  ? "(별점 없음)"
                  : `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`}{" "}
                · {review.productLabel}
              </strong>
              <small>{new Date(review.createdAt).toLocaleString("ko-KR")}</small>
            </div>

            <p className="admin-inquiry-message">{review.body ?? "(별점만 남김)"}</p>

            <dl className="admin-inquiry-meta">
              <div>
                <dt>출처</dt>
                <dd>{review.source === "beta" ? "베타 테스트 (옮겨 담음)" : "구매 확인됨"}</dd>
              </div>
              <div>
                <dt>작성자</dt>
                <dd>
                  {review.displayName}
                  {review.userId !== null && ` (회원 #${review.userId})`}
                </dd>
              </div>
              <div>
                <dt>구매 횟수</dt>
                <dd>{review.purchaseCount}번</dd>
              </div>
              <div>
                <dt>리딩</dt>
                <dd>
                  {review.readingId ? (
                    <Link href={`/reading/${review.readingId}`}>{review.readingId.slice(0, 8)}…</Link>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{review.status === "hidden" ? `내려둠 — ${review.hiddenReason ?? ""}` : "노출 중"}</dd>
              </div>
            </dl>

            <label>
              내리는 사유
              <input
                value={reasons[review.id] ?? review.hiddenReason ?? ""}
                onChange={(event) =>
                  setReasons((current) => ({ ...current, [review.id]: event.target.value }))
                }
                placeholder="도배 / 욕설 / 개인정보 노출 등"
              />
            </label>

            <div className="admin-order-actions">
              {review.status === "published" ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => void moderate(review, "hidden")}
                  disabled={processingId === review.id}
                >
                  {processingId === review.id ? "처리 중…" : "내리기"}
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={() => void moderate(review, "published")}
                  disabled={processingId === review.id}
                >
                  {processingId === review.id ? "처리 중…" : "다시 노출"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
