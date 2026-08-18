"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ShrineStage from "@/components/ShrineStage";
import ShrineTransition from "@/components/ShrineTransition";
import SignupModal from "@/components/SignupModal";
import { useTheme } from "@/components/ThemeProvider";
import { FREE_CHAT_TURNS } from "@/lib/chat-products";
import { CHARACTERS, participantCount } from "@/lib/characters";
import { GATE_NAVIGATE_MS } from "@/lib/shrine-entrance";
import { loadShrineMessages, markShrineArrival } from "@/lib/shrine-session";
import { getUser, type User } from "@/lib/user";

// 신당 입장 화면 — 도령 앞에 서기까지. 대화는 /shrine/[id]/chat 에서 따로 이어진다.
// 입장 버튼을 누르면 신당마다 다른 관문 연출이 화면을 덮고, 그 연출이 끝나기 전에 대화 화면으로 넘어간다.
export default function ShrineGatePage() {
  const { showMatureLabels } = useTheme();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ch = CHARACTERS[id ?? ""];

  const [user, setUser] = useState<User | null>(null);
  const [count, setCount] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [departing, setDeparting] = useState(false);
  const departTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUser(getUser());
    if (!ch) return;
    setCount(participantCount(ch.id));
    setHasHistory(loadShrineMessages(ch.id).length > 0);
    // 대화 화면을 미리 받아둔다 — 연출이 끝나는 순간 바로 열리도록
    router.prefetch(`/shrine/${ch.id}/chat`);
  }, [ch, router]);

  useEffect(() => {
    return () => {
      if (departTimer.current) clearTimeout(departTimer.current);
    };
  }, []);

  // 버튼을 누른 그 순간 관문에 불이 붙고, 연출이 아직 움직이는 중에 화면이 바뀐다.
  const beginDeparture = useCallback(() => {
    if (!ch || departTimer.current) return;
    markShrineArrival(ch.id);
    setDeparting(true);
    // scroll: false — 화면 전체를 덮는 무대라 라우터가 스크롤을 건드릴 필요가 없다
    departTimer.current = setTimeout(
      () => router.push(`/shrine/${ch.id}/chat`, { scroll: false }),
      GATE_NAVIGATE_MS
    );
  }, [ch, router]);

  // 카드나 광고에서 ?start=1 로 들어온 손님은 버튼을 거치지 않고 곧장 관문을 지난다
  useEffect(() => {
    if (!ch || !user) return;
    if (new URLSearchParams(window.location.search).get("start") !== "1") return;
    // 주소에서 start를 지워둔다 — 대화 화면에서 뒤로 오면 다시 끌려 들어가지 않게
    window.history.replaceState({}, "", `/shrine/${ch.id}`);
    beginDeparture();
  }, [beginDeparture, ch, user]);

  if (!ch) {
    return (
      <main className="container" style={{ paddingTop: 60, textAlign: "center" }}>
        <p>존재하지 않는 신당이에요.</p>
      </main>
    );
  }

  const enterShrine = () => {
    if (departing) return;
    if (!user) {
      setShowSignup(true);
      return;
    }
    beginDeparture();
  };

  return (
    <>
      <ShrineStage
        character={ch}
        onBack={() => router.push("/")}
        dim={false}
        phase={departing ? "departing" : null}
      >
        <div
          className="shrine-stage-panel"
          style={{
            position: "relative",
            marginTop: "auto",
            padding: "0 20px calc(24px + env(safe-area-inset-bottom))",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#fff", fontSize: "1.7rem", marginBottom: 4 }}>{ch.title}</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
            {ch.name} — {ch.tagline}
          </p>
          <p
            style={{
              display: "inline-block",
              background: "rgba(0,0,0,0.55)",
              color: ch.theme.stage,
              border: `1px solid ${ch.theme.line}`,
              fontSize: "0.85rem",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            🔥 {count.toLocaleString()}명이 참여함
          </p>
          <button
            className="btn"
            disabled={departing}
            style={{
              width: "100%",
              background: `linear-gradient(135deg, ${ch.theme.accent}, ${ch.theme.accent2})`,
              boxShadow: `0 6px 24px ${ch.theme.glow}`,
            }}
            onClick={enterShrine}
          >
            {!user
              ? "로그인하고 신당 입장하기"
              : hasHistory
                ? "하던 대화 이어가기"
                : "지금 신당으로 입장하기"}
          </button>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: 10 }}>
            {showMatureLabels && "만 19세 이상 · "}로그인하면 무료 대화 {FREE_CHAT_TURNS}번
            {user?.chatCredits ? ` · 보상 질문권 ${user.chatCredits}장` : " · 친구 초대 시 질문권 10장"}
          </p>
        </div>
      </ShrineStage>

      {/* 관문 — 신당마다 다른 소품이 화면을 덮으며 손님을 안으로 밀어 넣는다 */}
      {departing && <ShrineTransition characterId={ch.id} shrineName={ch.title} phase="depart" />}

      {showSignup && (
        <SignupModal
          onDone={(nextUser) => {
            setUser(nextUser);
            setShowSignup(false);
            // 로그인하고 돌아오면 곧바로 신당 안으로 들여보낸다
            beginDeparture();
          }}
          onClose={() => setShowSignup(false)}
          reason="신당 대화는 로그인 후 이용할 수 있어요. 로그인하면 무료 대화 5번이 열려요"
        />
      )}
    </>
  );
}
