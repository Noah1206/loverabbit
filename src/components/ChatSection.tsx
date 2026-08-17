"use client";

import { useState } from "react";

// 추가 상담 — 해금된 리딩 아래에서 명리 분석가와 후속 질문 1회를 제공한다.
// 리딩 페이지와 내 상담 보관함(/my)이 공용으로 사용.
export default function ChatSection({
  readingId,
  blob,
}: {
  readingId: string;
  blob: string;
}) {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState("");

  const userTurns = msgs.filter((m) => m.role === "user").length;
  const locked = limitReached || userTurns >= 1;

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId, blob, question: q, history: msgs }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) setLimitReached(true);
        throw new Error(data.error ?? "상담 실패");
      }
      setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: data.answer }]);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: "1.3rem" }}>🔮</span>
        <strong>추가 사주 상담</strong>
        <span className="badge">첫 질문 무료</span>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <div style={{ justifySelf: "start", maxWidth: "85%", background: "var(--bg-card2)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", fontSize: "0.92rem" }}>
          리딩에서 궁금한 점이 있으면 물어보세요. 명식 기준으로 답해드릴게요.
        </div>
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ justifySelf: "end", maxWidth: "85%", background: "linear-gradient(135deg, var(--accent), var(--violet))", color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "10px 14px", fontSize: "0.92rem" }}>
              {m.content}
            </div>
          ) : (
            <div key={i} style={{ justifySelf: "start", maxWidth: "85%", background: "var(--bg-card2)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", fontSize: "0.92rem", whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          )
        )}
        {sending && (
          <div className="pulse" style={{ justifySelf: "start", background: "var(--bg-card2)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", fontSize: "0.92rem", color: "var(--text-dim)" }}>
            명식을 다시 확인하는 중…
          </div>
        )}
      </div>

      {locked ? (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-dim)" }}>
            이번 리딩의 무료 추가 상담을 사용했어요. 다른 질문은 새 리딩에서 이어가 주세요.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder={userTurns === 0 ? "예: 그럼 언제 연락하는 게 좋아?" : "계속 물어보세요"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            maxLength={500}
          />
          <button className="btn" style={{ padding: "12px 20px", whiteSpace: "nowrap" }} onClick={send} disabled={sending || !input.trim()}>
            전송
          </button>
        </div>
      )}
      {error && <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
