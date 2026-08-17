"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHARACTERS, participantCount } from "@/lib/characters";
import SignupModal from "@/components/SignupModal";
import { getUser, clearUser, type User } from "@/lib/user";
import { useTheme } from "@/components/ThemeProvider";

// 앱형 홈 — 콘텐츠 마켓 레이아웃. 전역 테마 기본값은 다크이며 사용자의 선택을 저장한다.
// 상품 데이터는 lib/products.ts 단일 소스에서 온다 (상세 판매 페이지와 공유).
import { PRODUCTS, type Product } from "@/lib/products";

const SITE_URL = "https://loverabbit-one.vercel.app/";
const LOCAL_TEST_URL = "http://192.168.219.108:3000/?v=qr-price3";

const HERO_IDS = ["sokgunghap", "jaehoe", "bamgijil"];

const NOTICES = [
  { text: "💬 리딩 후 추가 상담 기능 오픈!", sub: "첫 질문은 무료 · 신당에선 도령과 대화 5번 무료" },
  { text: "🐰 오픈 이벤트 — 오늘 가입 없이 무료 티저 무제한", sub: "풀 리딩은 커피 한 잔 값" },
  { text: "🔥 속궁합 리딩, 그 사람 정보까지 넣으면 정확도 UP", sub: "생년월일만 알아도 OK" },
];

function CardArt({ p, height }: { p: Product; height: number }) {
  // 로딩·실패 시에도 무드가 유지되도록 그라데이션을 밑색으로 깔고 일러스트를 얹는다
  return (
    <div
      aria-hidden
      style={{
        height,
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(160deg, ${p.grad[0]}, ${p.grad[1]})`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/cards-pastel/${p.id}.jpg`}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%" }}
      />
    </div>
  );
}

export default function AppHome() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const [notice, setNotice] = useState(0);
  const [filter, setFilter] = useState<"all" | "popular" | "new">("all");
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrTarget, setQrTarget] = useState(SITE_URL);

  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host)) {
      setQrTarget(LOCAL_TEST_URL);
    }
    return () => clearInterval(t);
  }, []);

  const soon = (name: string) => alert(`${name}은(는) 오픈 준비 중이에요 🐰`);
  const heroes = HERO_IDS.map((id) => PRODUCTS.find((p) => p.id === id)!);
  const list = PRODUCTS.filter((p) => filter === "all" || p.tags.includes(filter));

  return (
    <div className={`theme-${theme}`} style={{ margin: "0 auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ── 상단바 ── */}
        <header className="app-header">
          <strong className="app-header-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="러브레빗 로고" />
            LOVE<span style={{ color: "var(--accent)" }}>RABBIT</span>
          </strong>
          <div className="app-header-actions">
            <button
              onClick={() => setShowQr(true)}
              aria-label="휴대폰 접속 QR 코드 보기"
              title="휴대폰 접속 QR"
              className="app-header-action"
            >
              ▦ QR
            </button>
            <button
              onClick={() => {
                if (user) {
                  if (window.confirm(`${user.email} 로 로그인 중이에요. 로그아웃할까요?`)) {
                    clearUser();
                    setUser(null);
                  }
                } else {
                  setShowSignup(true);
                }
              }}
              className="app-header-action app-header-login"
            >
              {user ? user.email.split("@")[0] : "로그인"}
            </button>
          </div>
        </header>

        {/* ── 공지 배너 캐러셀 ── */}
        <div style={{ padding: "16px 20px 4px" }}>
          <div
            style={{
              borderRadius: 16, padding: "18px 20px", textAlign: "center", cursor: "default",
              background: dark
                ? "linear-gradient(120deg, rgba(255,61,127,0.85), rgba(139,92,246,0.85))"
                : "linear-gradient(120deg, rgba(255,140,180,0.95), rgba(185,157,248,0.95))",
              boxShadow: dark ? "0 6px 28px rgba(255,61,127,0.25)" : "0 6px 24px rgba(255,140,180,0.35)",
            }}
          >
            <p style={{ fontWeight: 800, fontSize: "1.02rem", color: "#fff" }}>{NOTICES[notice].text}</p>
            <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.88)" }}>{NOTICES[notice].sub}</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
              {NOTICES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setNotice(i)}
                  aria-label={`공지 ${i + 1}`}
                  style={{
                    width: i === notice ? 18 : 7, height: 7, borderRadius: 999, border: "none", cursor: "pointer",
                    background: i === notice ? "#fff" : "rgba(255,255,255,0.45)", transition: "width 0.25s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 히어로 상품 캐러셀 ── */}
        <section style={{ marginTop: 16, position: "relative" }}>
          <div className="hero-scroll">
            {heroes.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="hero-card">
                <CardArt p={p} height={300} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 35%, rgba(10,6,16,0.95) 82%)" }} />
                {/* 히어로 텍스트는 어두운 오버레이 위라 테마와 무관하게 밝은 색 고정 */}
                <div style={{ position: "absolute", left: 18, right: 18, bottom: 16 }}>
                  <span className="badge" style={{ marginBottom: 8 }}>{p.badge}</span>
                  <h2 style={{ fontSize: "1.5rem", lineHeight: 1.3, margin: "6px 0 6px", color: "#fff" }}>{p.title}</h2>
                  <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.78)", marginBottom: 10 }}>{p.desc}</p>
                  <span style={{ color: "var(--accent-soft)", fontWeight: 800, fontSize: "0.92rem" }}>무료로 시작하기 →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 신당 — 도령 캐릭터 챗 ── */}
        <section style={{ padding: "26px 0 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 20px 12px" }}>
            <h3 style={{ fontSize: "1.05rem" }}>🏮 신당</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700 }}>도령과 직접 대화하기 — 무료 5번</span>
          </div>
          <div className="hero-scroll">
            {Object.values(CHARACTERS).map((ch) => (
              <Link key={ch.id} href={`/shrine/${ch.id}`} className="hero-card">
                <div aria-hidden style={{ height: 280, position: "relative", overflow: "hidden", background: "#0a0710" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ch.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%" }} />
                </div>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(10,6,16,0.95) 85%)" }} />
                <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
                  <strong style={{ color: "#fff", fontSize: "1.05rem" }}>{ch.name}</strong>
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem", margin: "2px 0 6px" }}>{ch.tagline}</p>
                  <p style={{ color: "#ffd28a", fontSize: "0.75rem", fontWeight: 700 }}>🔥 {participantCount(ch.id).toLocaleString()}명 참여 · 입장하기 →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 필터 탭 + 상품 그리드 ── */}
        <section style={{ padding: "26px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {([["all", "전체"], ["popular", "인기"], ["new", "신규"]] as const).map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
            <button className="chip" style={{ marginLeft: "auto", color: "var(--accent-soft)" }} onClick={() => soon("태그 검색")}>태그 &gt;</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
            {/* 레퍼런스 구성: 이미지가 카드 전체를 채우고 하단 그라데이션 위에 제목·설명·CTA 오버레이 */}
            {list.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="card" style={{ padding: 0, overflow: "hidden", position: "relative", display: "block" }}>
                <CardArt p={p} height={264} />
                <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 38%, rgba(10,6,16,0.55) 62%, rgba(10,6,16,0.96) 88%)" }} />
                {p.tags.includes("popular") && (
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: "0.68rem", fontWeight: 800, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>인기</span>
                )}
                {p.tags.includes("new") && (
                  <span style={{ position: "absolute", top: 10, left: 10, fontSize: "0.68rem", fontWeight: 800, background: "var(--violet)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>NEW</span>
                )}
                <div style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
                  <strong style={{ fontSize: "0.98rem", color: "#fff", display: "block", marginBottom: 3 }}>{p.title}</strong>
                  <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", margin: "0 0 7px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.desc}</p>
                  <span style={{ color: "var(--accent-soft)", fontWeight: 800, fontSize: "0.8rem" }}>무료로 시작하기 →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 푸터 ── */}
        <footer style={{ marginTop: 44, padding: "26px 20px 10px", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {["𝕏", "📷", "🎵"].map((s, i) => (
              <button key={i} onClick={() => soon("공식 SNS")} aria-label="SNS" style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--bg-card)", color: "var(--text)", fontSize: "1rem", cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: "0.82rem" }}>
            <div>
              <strong style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>지원</strong>
              <p style={{ marginTop: 6 }}><button onClick={() => soon("고객센터")} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, font: "inherit" }}>고객센터</button></p>
              <p><button onClick={() => soon("자주 묻는 질문")} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, font: "inherit" }}>자주 묻는 질문</button></p>
            </div>
            <div>
              <strong style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>법적 고지</strong>
              <p style={{ marginTop: 6 }}><button onClick={() => soon("이용약관")} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, font: "inherit" }}>이용약관</button></p>
              <p><button onClick={() => soon("개인정보처리방침")} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, font: "inherit" }}>개인정보처리방침</button></p>
            </div>
            <div>
              <strong style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>러브레빗</strong>
              <p style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={toggleTheme}
                  style={{ color: "var(--text)", background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}
                >
                  {dark ? "☀️ 라이트 테마 보기" : "🌙 다크 테마 보기"}
                </button>
              </p>
              <p><Link href="/reading" style={{ color: "var(--text)" }}>리딩 바로가기</Link></p>
            </div>
          </div>
        </footer>
      </div>

      {showQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-title"
          onClick={() => setShowQr(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center",
            justifyContent: "center", padding: 20, background: "rgba(8,5,14,0.82)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 360, textAlign: "center", position: "relative" }}
          >
            <button
              onClick={() => setShowQr(false)}
              aria-label="QR 코드 닫기"
              style={{
                position: "absolute", top: 10, right: 12, border: 0, background: "none",
                color: "var(--text-dim)", fontSize: "1.25rem", cursor: "pointer",
              }}
            >
              ×
            </button>
            <h2 id="qr-title" style={{ fontSize: "1.2rem", marginBottom: 6 }}>휴대폰으로 러브레빗 열기</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 14 }}>
              휴대폰 카메라로 QR 코드를 비춰주세요.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrTarget === LOCAL_TEST_URL ? "/loverabbit-local-qr.png" : "/loverabbit-qr.png"}
              alt="러브레빗 모바일 접속 QR 코드"
              width={260}
              height={260}
              style={{ width: "100%", maxWidth: 260, height: "auto", borderRadius: 16, background: "#fff" }}
            />
            <a
              href={qrTarget}
              style={{ display: "block", marginTop: 12, color: "var(--accent)", fontSize: "0.82rem", wordBreak: "break-all" }}
            >
              {qrTarget}
            </a>
          </div>
        </div>
      )}

      {showSignup && (
        <SignupModal
          reason="가입하면 리딩 보관·결제가 이 계정에 연결돼요"
          onDone={(u) => {
            setUser(u);
            setShowSignup(false);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}

    </div>
  );
}
