"use client";

import { useEffect, useState } from "react";

import { getUser, type User } from "@/lib/user";

// 문의창.
//
// 떠 있는 버튼(FAB)은 걷었다 (2026-09-01 운영자) — 화면 오른쪽 아래를 늘
// 차지하는데 푸터에 이미 "문의하기" 가 있다. 이제 이 컴포넌트는 창만 들고
// 있고, 여는 것은 loverabbit:inquiry 이벤트다.
//
// 보낸 내용은 lr_inquiries 에 쌓여 /admin/inquiries 에서 읽는다.

const CATEGORIES = [
  { id: "payment", label: "결제·입금" },
  { id: "reading", label: "사주 리딩" },
  { id: "account", label: "계정·로그인" },
  { id: "bug", label: "오류 신고" },
  { id: "etc", label: "그 외" },
] as const;

const MAX_LEN = 2000;

export default function InquiryButton() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [category, setCategory] = useState<string>("etc");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const stored = getUser();
    setUser(stored);
    if (stored?.email) setEmail(stored.email);
  }, [open]);

  /* 푸터의 "고객센터"처럼 멀리 있는 자리에서도 이 창을 연다. 문의는 여기
     하나뿐이라 화면마다 새로 만들 이유가 없다 — 부르는 쪽은 이벤트만 쏜다. */
  useEffect(() => {
    const openInquiry = () => setOpen(true);
    window.addEventListener("loverabbit:inquiry", openInquiry);
    return () => window.removeEventListener("loverabbit:inquiry", openInquiry);
  }, []);

  // 열려 있는 동안에는 뒤 배경이 스크롤되지 않게 한다.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setError("");
    if (sent) {
      setSent(false);
      setMessage("");
      setCategory("etc");
    }
  };

  const send = async () => {
    setError("");
    if (message.trim().length < 5) {
      setError("문의 내용을 5자 이상 적어주세요.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: email.trim(),
          pagePath: window.location.pathname,
          userToken: user?.token,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "문의를 보내지 못했어요.");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "문의를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="inquiry-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="문의하기"
          onClick={close}
        >
          <div className="card inquiry-sheet" onClick={(e) => e.stopPropagation()}>
            {sent ? (
              <>
                <div className="inquiry-sent-mark" aria-hidden>✓</div>
                <h3 style={{ textAlign: "center", margin: "6px 0 6px" }}>문의를 받았어요</h3>
                <p className="inquiry-hint" style={{ textAlign: "center" }}>
                  {email ? `${email} 로 답장드릴게요.` : "확인 후 답장드릴게요."} 보통 하루 안에 답장이 갑니다.
                </p>
                <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={close}>
                  닫기
                </button>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 4px" }}>무엇을 도와드릴까요?</h3>
                <p className="inquiry-hint">
                  결제·리딩·오류 무엇이든 남겨주세요. 직접 읽고 답장드립니다.
                </p>

                <div className="inquiry-chips">
                  {CATEGORIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={category === item.id ? "on" : ""}
                      onClick={() => setCategory(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="inquiry-label" htmlFor="inquiry-message">문의 내용</label>
                <textarea
                  id="inquiry-message"
                  className="inquiry-textarea"
                  rows={5}
                  maxLength={MAX_LEN}
                  placeholder="어떤 상황이었는지 적어주시면 더 빨리 확인할 수 있어요."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="inquiry-counter">{message.length} / {MAX_LEN}</div>

                <label className="inquiry-label" htmlFor="inquiry-email">
                  답장받을 이메일{user ? " (선택)" : ""}
                </label>
                <input
                  id="inquiry-email"
                  className="inquiry-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="me@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                {error && <p className="inquiry-error" role="alert">{error}</p>}

                <button
                  className="btn"
                  style={{ width: "100%", marginTop: 14 }}
                  onClick={() => void send()}
                  disabled={sending}
                >
                  {sending ? "보내는 중…" : "문의 보내기"}
                </button>
                <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={close}>
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
