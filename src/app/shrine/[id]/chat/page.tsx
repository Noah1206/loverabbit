"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ChatPaymentModal from "@/components/ChatPaymentModal";
import ShrineStage from "@/components/ShrineStage";
import { DEFAULT_EMOTION, inferEmotion, isEmotion, type Emotion } from "@/lib/character-emotions";
import ShrineTransition from "@/components/ShrineTransition";
import SignupModal from "@/components/SignupModal";
import { DEFAULT_CHAT_PRODUCT, FREE_CHAT_TURNS } from "@/lib/chat-products";
import { CHARACTERS } from "@/lib/characters";
import { GATE_ARRIVE_MS } from "@/lib/shrine-entrance";
import {
  consumeShrineArrival,
  loadShrineMessages,
  saveShrineMessages,
  type ShrineMessage,
} from "@/lib/shrine-session";
import { getUser, saveUser, type User } from "@/lib/user";

// *별표 지문*(표정·몸짓 묘사)은 대사와 다르게 — 신당 색으로 기울여 보여준다.
// 지문 블록이 자체 여백을 갖기 때문에, 지문에 붙어 있던 줄바꿈은 빈 줄로 보이지 않게 지운다.
function renderSpeech(text: string, stageColor: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  const isStage = (part: string) => part.length > 2 && part.startsWith("*") && part.endsWith("*");

  return parts.map((raw, index) => {
    if (isStage(raw)) {
      return (
        <em
          key={index}
          style={{
            display: "block",
            margin: index === 0 ? "0 0 8px" : "10px 0 8px",
            color: stageColor,
            fontStyle: "italic",
            fontSize: "0.86rem",
            letterSpacing: "0.01em",
            opacity: 0.95,
          }}
        >
          {raw.slice(1, -1)}
        </em>
      );
    }

    let line = raw;
    if (index > 0 && isStage(parts[index - 1])) line = line.replace(/^\s*\n+/, "");
    if (index < parts.length - 1 && isStage(parts[index + 1])) line = line.replace(/\n+\s*$/, "");
    if (!line) return null;
    return <span key={index}>{line}</span>;
  });
}

// 신당 대화 화면 — 입장 연출(/shrine/[id])을 지나온 손님이 도령과 마주 앉는 곳.
// 관문에서 넘어온 경우 같은 소품이 흩어지며 사라지는 도착 연출로 이어 받는다.
export default function ShrineChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ch = CHARACTERS[id ?? ""];

  const [msgs, setMsgs] = useState<ShrineMessage[]>([]);
  // 지금 도령이 짓고 있는 표정. 답이 올 때마다 바뀌고, 무대가 그 표정으로 움직인다.
  const [emotion, setEmotion] = useState<Emotion>(DEFAULT_EMOTION);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [signupRequired, setSignupRequired] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  // 남은 무료 대화 수는 서버가 알려준다 (null = 아직 모름)
  const [freeTurnsLeft, setFreeTurnsLeft] = useState<number | null>(null);
  // 관문을 지나 들어온 순간에만 재생되는 도착 연출
  const [arriving, setArriving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ch) return;
    const stored = loadShrineMessages(ch.id);
    // 대화는 첫 인사부터 시작한다 — 입장 화면을 지나온 손님은 이미 문 안에 있다
    setMsgs(stored.length > 0 ? stored : [{ role: "assistant", content: ch.greeting }]);
    setArriving(consumeShrineArrival(ch.id));
    if (new URLSearchParams(window.location.search).get("payment") === "approved") {
      setPaymentNotice("결제가 완료됐어요. 끊긴 대화부터 이어서 말해보세요.");
    }
    const account = getUser();
    setUser(account);

    // 서버 이력이 정본이다. 로컬을 먼저 그려 바로 보이게 하고, 서버에 남은
    // 대화가 있으면 그걸로 바꿔 끼운다 — 답이 오는 중에 새로고침한 사람이
    // 여기서 그 답을 만나고(질문권 쓴 대화가 증발하지 않는다), 기기를 바꿔도
    // 대화가 따라온다. 서버가 비어 있으면(이력 저장 이전 대화) 로컬을 그대로 둔다.
    if (!account) return;
    let alive = true;
    fetch("/api/shrine-chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: account.token, characterId: ch.id }),
    })
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages?: ShrineMessage[] }) => {
        if (!alive || !data.messages || data.messages.length === 0) return;
        setMsgs([{ role: "assistant", content: ch.greeting }, ...data.messages]);
      })
      .catch(() => {
        // 이력을 못 불러온 것뿐이다. 로컬 대화로 계속 쓰게 둔다.
      });
    return () => {
      alive = false;
    };
  }, [ch]);

  // 도착 연출은 한 번만 — 끝나면 무대에서 걷어낸다
  useEffect(() => {
    if (!arriving) return;
    const timer = setTimeout(() => setArriving(false), GATE_ARRIVE_MS);
    return () => clearTimeout(timer);
  }, [arriving]);

  useEffect(() => {
    if (!ch || msgs.length === 0) return;
    saveShrineMessages(ch.id, msgs);
  }, [ch, msgs]);

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
      // 서버가 꼬리표에서 읽어준 표정을 쓰고, 없으면 지문에서 직접 추측한다.
      setEmotion(isEmotion(data.emotion) ? data.emotion : inferEmotion(String(data.answer ?? "")));
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
  const theme = ch.theme;

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
    <>
      <ShrineStage
        emotion={emotion}
        character={ch}
        onBack={() => router.push(`/shrine/${ch.id}`, { scroll: false })}
        dim
        phase={arriving ? "arriving" : null}
      >
        <div
          className="shrine-stage-panel"
          style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%", background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "10px 14px", fontSize: "0.92rem", boxShadow: `0 6px 18px ${theme.glow}` }}>
                    {m.content}
                  </div>
                ) : (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "85%", background: theme.ink, color: "#f2eaf6", border: `1px solid ${theme.line}`, borderRadius: "4px 16px 16px 16px", padding: "11px 14px", fontSize: "0.92rem", whiteSpace: "pre-wrap", lineHeight: 1.62 }}>
                    <strong style={{ color: theme.accent, fontSize: "0.78rem", display: "block", marginBottom: 5, letterSpacing: "0.04em" }}>{ch.name}</strong>
                    {renderSpeech(m.content, theme.stage)}
                  </div>
                )
              )}
              {sending && (
                <div className="pulse" style={{ alignSelf: "flex-start", background: theme.ink, border: `1px solid ${theme.line}`, color: theme.stage, borderRadius: "4px 16px 16px 16px", padding: "10px 14px", fontSize: "0.9rem", fontStyle: "italic" }}>
                  {ch.name}이 기운을 읽는 중…
                </div>
              )}
              {error && <p style={{ color: theme.stage, fontSize: "0.85rem" }}>{error}</p>}
            </div>
          </div>

          <div style={{ padding: "10px 16px calc(14px + env(safe-area-inset-bottom))" }}>
            {locked ? (
              <div style={{ textAlign: "center", background: theme.ink, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16 }}>
                <span className="badge">무료 대화 {FREE_CHAT_TURNS}/{FREE_CHAT_TURNS} 사용</span>
                <p style={{ color: "#fff", fontSize: "0.94rem", margin: "10px 0" }}>
                  여기서 끊지 마세요. {ch.name}의 다음 답장은 {!user || signupRequired ? "로그인" : "대화권 결제"} 후 이어집니다.
                </p>
                {!user || signupRequired ? (
                  <button className="btn" style={{ width: "100%", background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 6px 18px ${theme.glow}` }} onClick={() => setShowSignup(true)}>
                    로그인하고 대화 이어가기 →
                  </button>
                ) : (
                  <>
                    <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.82rem", marginBottom: 10 }}>
                      {DEFAULT_CHAT_PRODUCT.name} · {DEFAULT_CHAT_PRODUCT.price.toLocaleString()}원
                    </div>
                    <button className="btn" style={{ width: "100%", background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 6px 18px ${theme.glow}` }} onClick={() => setShowPay(true)}>
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
                    style={{ background: theme.ink, border: `1px solid ${theme.line}`, color: "#fff" }}
                  />
                  <button className="btn" style={{ padding: "12px 20px", whiteSpace: "nowrap", background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 6px 18px ${theme.glow}` }} onClick={send} disabled={sending || !input.trim()}>
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
      </ShrineStage>

      {/* 도착 연출 — 관문에서 날아오던 소품이 같은 방향으로 흩어지며 사라진다 */}
      {arriving && <ShrineTransition characterId={ch.id} shrineName={ch.title} phase="arrive" />}

      {showSignup && (
        <SignupModal
          onDone={(nextUser) => {
            setUser(nextUser);
            setSignupRequired(false);
            setShowSignup(false);
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
    </>
  );
}
