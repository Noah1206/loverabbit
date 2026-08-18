"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ShrineAudioToggle from "@/components/ShrineAudioToggle";
import { useTheme } from "@/components/ThemeProvider";
import { CHARACTERS, participantCount } from "@/lib/characters";
import { getUser, saveUser, type User } from "@/lib/user";

// 신당 — 도령과의 몰입형 캐릭터 챗. 전체 화면(하단 탭바 위로 덮음), 입장 연출 → 대화.
export default function ShrinePage() {
  const { showMatureLabels } = useTheme();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ch = CHARACTERS[id ?? ""];

  const [entered, setEntered] = useState(false);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ch) setCount(participantCount(ch.id));
    setUser(getUser());
  }, [ch]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  if (!ch) {
    return (
      <main className="container" style={{ paddingTop: 60, textAlign: "center" }}>
        <p>존재하지 않는 신당이에요.</p>
      </main>
    );
  }

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/shrine-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: ch.id, question: q, history: msgs, userToken: user?.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) setLimitReached(true);
        throw new Error(data.error ?? "대화 실패");
      }
      setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: data.answer }]);
      if (typeof data.creditsRemaining === "number" && user) {
        const nextUser = { ...user, chatCredits: data.creditsRemaining };
        setUser(nextUser);
        saveUser(nextUser);
      }
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  const locked = limitReached;

  return (
    <div className="shrine-immersive-shell" style={{ position: "fixed", inset: 0, zIndex: 70, background: "#0a0710", display: "flex", flexDirection: "column" }}>
      {/* 배경 — 도령 전신 */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${ch.img})`, backgroundSize: "cover", backgroundPosition: "center 10%",
          filter: entered ? "brightness(0.45)" : "brightness(0.85)",
          transition: "filter 0.8s",
        }}
      />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,7,16,0.75) 0%, transparent 25%, transparent 55%, rgba(10,7,16,0.92) 85%)" }} />

      {/* 상단 바 */}
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <button onClick={() => (entered ? setEntered(false) : router.push("/"))} aria-label="뒤로" style={{ background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", fontSize: "1.1rem", width: 36, height: 36, borderRadius: "50%", cursor: "pointer" }}>‹</button>
        <strong style={{ color: "#fff", letterSpacing: "0.14em" }}>LOVERABBIT</strong>
        <ShrineAudioToggle src={ch.bgm} shrineName={ch.title} />
      </header>

      {!entered ? (
        /* ── 입장 화면 ── */
        <div style={{ position: "relative", marginTop: "auto", padding: "0 20px calc(24px + env(safe-area-inset-bottom))", textAlign: "center" }}>
          <h1 style={{ color: "#fff", fontSize: "1.7rem", marginBottom: 4 }}>{ch.title}</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>{ch.name} — {ch.tagline}</p>
          <p style={{ display: "inline-block", background: "rgba(0,0,0,0.55)", color: "#ffd28a", fontSize: "0.85rem", fontWeight: 700, padding: "6px 14px", borderRadius: 999, marginBottom: 14 }}>
            🔥 {count.toLocaleString()}명이 참여함
          </p>
          <button
            className="btn"
            style={{ width: "100%", background: "linear-gradient(135deg, #a1131f, #5c0a12)", boxShadow: "0 6px 24px rgba(161,19,31,0.45)" }}
            onClick={() => {
              setEntered(true);
              if (msgs.length === 0) setMsgs([{ role: "assistant", content: ch.greeting }]);
            }}
          >
            지금 신당으로 입장하기
          </button>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: 10 }}>
            {showMatureLabels && "만 19세 이상 · "}무료 대화 5번
            {user?.chatCredits ? ` · 보상 질문권 ${user.chatCredits}장` : " · 친구 초대 시 질문권 10장"}
          </p>
        </div>
      ) : (
        /* ── 대화 화면 ── */
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%", background: "linear-gradient(135deg, #ff5c94, #b99df8)", color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "10px 14px", fontSize: "0.92rem" }}>
                    {m.content}
                  </div>
                ) : (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "85%", background: "rgba(16,10,20,0.85)", color: "#f2eaf6", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px 16px 16px 16px", padding: "11px 14px", fontSize: "0.92rem", whiteSpace: "pre-wrap" }}>
                    <strong style={{ color: "#ffd28a", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>{ch.name}</strong>
                    {m.content}
                  </div>
                )
              )}
              {sending && (
                <div className="pulse" style={{ alignSelf: "flex-start", background: "rgba(16,10,20,0.85)", color: "rgba(255,255,255,0.6)", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", fontSize: "0.9rem" }}>
                  {ch.name}이 기운을 읽는 중…
                </div>
              )}
              {error && <p style={{ color: "#ff8ab2", fontSize: "0.85rem" }}>{error}</p>}
            </div>
          </div>

          <div style={{ padding: "10px 16px calc(14px + env(safe-area-inset-bottom))" }}>
            {locked ? (
              <div style={{ textAlign: "center", background: "rgba(16,10,20,0.9)", borderRadius: 16, padding: 16 }}>
                <p style={{ color: "#fff", fontSize: "0.9rem", marginBottom: 10 }}>무료 대화를 모두 사용했어요.</p>
                <button className="btn" onClick={() => router.push("/reading")}>친구 초대하고 질문권 10장 받기</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder={`${ch.name}에게 말 걸기…`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  maxLength={500}
                  style={{ background: "rgba(16,10,20,0.85)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff" }}
                />
                <button className="btn" style={{ padding: "12px 20px", whiteSpace: "nowrap" }} onClick={send} disabled={sending || !input.trim()}>
                  전송
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
