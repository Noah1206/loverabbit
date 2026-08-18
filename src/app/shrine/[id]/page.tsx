"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatPaymentModal from "@/components/ChatPaymentModal";
import ShrineAudioToggle from "@/components/ShrineAudioToggle";
import SignupModal from "@/components/SignupModal";
import { useTheme } from "@/components/ThemeProvider";
import { DEFAULT_CHAT_PRODUCT, FREE_CHAT_TURNS } from "@/lib/chat-products";
import { CHARACTERS, participantCount } from "@/lib/characters";
import { getUser, saveUser, type User } from "@/lib/user";

type ShrineMessage = { role: "user" | "assistant"; content: string };

function shrineSessionKey(characterId: string) {
  return `loverabbit_shrine_session_v1_${characterId}`;
}

// 신당 — 도령과의 몰입형 캐릭터 챗. 전체 화면(하단 탭바 위로 덮음), 입장 연출 → 대화.
export default function ShrinePage() {
  const { showMatureLabels } = useTheme();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ch = CHARACTERS[id ?? ""];

  const [entered, setEntered] = useState(false);
  const [msgs, setMsgs] = useState<ShrineMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [signupRequired, setSignupRequired] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  // 남은 무료 대화 수는 서버가 알려준다 (null = 아직 모름)
  const [freeTurnsLeft, setFreeTurnsLeft] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ch) {
      setCount(participantCount(ch.id));
      const stored = sessionStorage.getItem(shrineSessionKey(ch.id));
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { entered?: boolean; messages?: ShrineMessage[] };
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMsgs(parsed.messages.slice(-21));
            setEntered(parsed.entered !== false);
          }
        } catch {
          sessionStorage.removeItem(shrineSessionKey(ch.id));
        }
      } else if (new URLSearchParams(window.location.search).get("start") === "1") {
        setEntered(true);
        setMsgs([{ role: "assistant", content: ch.greeting }]);
      }
      if (new URLSearchParams(window.location.search).get("payment") === "approved") {
        setPaymentNotice("결제가 완료됐어요. 끊긴 대화부터 이어서 말해보세요.");
      }
    }
    setUser(getUser());
  }, [ch]);

  useEffect(() => {
    if (!ch || msgs.length === 0) return;
    sessionStorage.setItem(
      shrineSessionKey(ch.id),
      JSON.stringify({ entered, messages: msgs.slice(-21) })
    );
  }, [ch, entered, msgs]);

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
    // 대화는 로그인 사용자만 — 요청을 보내기 전에 막는다
    if (!user) {
      setShowSignup(true);
      return;
    }
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
        if (data.needSignup) {
          setSignupRequired(true);
          setShowSignup(true);
        }
        if (data.limitReached) {
          setLimitReached(true);
          setFreeTurnsLeft(0);
        }
        throw new Error(data.error ?? "대화 실패");
      }
      setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: data.answer }]);
      if (typeof data.creditsRemaining === "number" && user) {
        const nextUser = { ...user, chatCredits: data.creditsRemaining };
        setUser(nextUser);
        saveUser(nextUser);
      }
      setFreeTurnsLeft(typeof data.freeTurnsRemaining === "number" ? data.freeTurnsRemaining : 0);
      setInput("");
      setLimitReached(false);
      setSignupRequired(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  const locked = limitReached;

  const refreshCredits = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json().catch(() => ({}))) as User & { error?: string };
      if (!response.ok || !data.token || !data.email) {
        throw new Error(data.error ?? "대화권 상태를 확인하지 못했어요.");
      }
      saveUser(data);
      setUser(data);
      if ((data.chatCredits ?? 0) > 0) {
        setLimitReached(false);
        setPaymentNotice(`대화권 ${data.chatCredits}회가 확인됐어요.`);
      } else {
        setPaymentNotice("아직 승인 대기 중이에요. 입금 확인 후 다시 눌러주세요.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "대화권 상태를 확인하지 못했어요.");
    }
  };

  return (
    <div className="shrine-immersive-shell" style={{ position: "fixed", inset: 0, zIndex: 70, background: "#0a0710", display: "flex", flexDirection: "column" }}>
      {/* 배경 — 도령 전신. 루프 영상이 있는 신당은 인물이 움직인다 */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${ch.img})`, backgroundSize: "cover", backgroundPosition: "center 10%",
          filter: entered ? "brightness(0.45)" : "brightness(0.85)",
          transition: "filter 0.8s",
        }}
      >
        {ch.video && (
          <video
            src={ch.video}
            poster={ch.img}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%" }}
          />
        )}
      </div>
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
              // 대화는 로그인 사용자만 — 입장 단계에서 먼저 막는다
              if (!user) {
                setShowSignup(true);
                return;
              }
              setEntered(true);
              if (msgs.length === 0) setMsgs([{ role: "assistant", content: ch.greeting }]);
            }}
          >
            {user ? "지금 신당으로 입장하기" : "로그인하고 신당 입장하기"}
          </button>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: 10 }}>
            {showMatureLabels && "만 19세 이상 · "}로그인하면 무료 대화 {FREE_CHAT_TURNS}번
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
                <span className="badge">무료 대화 {FREE_CHAT_TURNS}/{FREE_CHAT_TURNS} 사용</span>
                <p style={{ color: "#fff", fontSize: "0.94rem", margin: "10px 0" }}>
                  여기서 끊지 마세요. {ch.name}의 다음 답장은 {!user || signupRequired ? "로그인" : "대화권 결제"} 후 이어집니다.
                </p>
                {!user || signupRequired ? (
                  <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>
                    로그인하고 대화 이어가기 →
                  </button>
                ) : (
                  <>
                    <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.82rem", marginBottom: 10 }}>
                      {DEFAULT_CHAT_PRODUCT.name} · {DEFAULT_CHAT_PRODUCT.price.toLocaleString()}원
                    </div>
                    <button className="btn" style={{ width: "100%" }} onClick={() => setShowPay(true)}>
                      대화권 결제하고 계속하기 →
                    </button>
                    <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => void refreshCredits()}>
                      결제·입금 승인 상태 확인
                    </button>
                    <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => router.push("/rewards")}>
                      친구 초대로 질문권 받기
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {paymentNotice && <p style={{ color: "#ffd28a", fontSize: "0.8rem", textAlign: "center", marginBottom: 8 }}>{paymentNotice}</p>}
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
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", textAlign: "center", marginTop: 7 }}>
                  {freeTurnsLeft === null
                    ? `로그인 계정당 무료 대화 ${FREE_CHAT_TURNS}번 · 이후 대화권 결제`
                    : freeTurnsLeft > 0
                      ? `무료 대화 ${freeTurnsLeft}번 남음 · 이후 대화권 결제`
                      : `무료 대화를 모두 썼어요 · 대화권 ${user?.chatCredits ?? 0}회 보유`}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showSignup && (
        <SignupModal
          onDone={(nextUser) => {
            setUser(nextUser);
            setSignupRequired(false);
            setShowSignup(false);
            // 로그인하고 돌아오면 곧바로 신당 안으로 들여보낸다
            setEntered(true);
            if (msgs.length === 0) setMsgs([{ role: "assistant", content: ch.greeting }]);
          }}
          onClose={() => setShowSignup(false)}
          reason="신당 대화는 로그인 후 이용할 수 있어요. 로그인하면 무료 대화 5번이 열려요"
        />
      )}

      {showPay && user && (
        <ChatPaymentModal
          product={DEFAULT_CHAT_PRODUCT}
          characterId={ch.id}
          userToken={user.token}
          customerEmail={user.email}
          onTransferSubmitted={(orderId) => setPaymentNotice(`입금 확인 요청 #${orderId}이 접수됐어요.`)}
          onClose={() => setShowPay(false)}
        />
      )}
    </div>
  );
}
