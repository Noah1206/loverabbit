"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import loveRabbitLogo from "../../public/logo.png";
import { CHARACTERS, participantCount } from "@/lib/characters";
import SignupModal from "@/components/SignupModal";
import { getUser, logoutUser, type User } from "@/lib/user";
import { useTheme } from "@/components/ThemeProvider";

// 앱형 홈 — 콘텐츠 마켓 레이아웃. 전역 테마 기본값은 다크이며 사용자의 선택을 저장한다.
// 상품 데이터는 lib/products.ts 단일 소스에서 온다 (상세 판매 페이지와 공유).
import { PRODUCTS, type Product } from "@/lib/products";
import { SITE_URL } from "@/lib/site";
import InquiryButton from "@/components/InquiryButton";
import HomeReviews from "@/components/HomeReviews";

const LOCAL_TEST_URL = "http://192.168.219.108:3000/?v=qr-price3";

const NOTICES = [
  { text: "💬 리딩 후 추가 상담 기능 오픈!", sub: "첫 질문은 무료 · 로그인하면 신당 대화 5번 무료" },
  { text: "🐰 오픈 이벤트 — 오늘 가입 없이 무료 티저 무제한", sub: "첫 신점은 990원 · 풀 리딩은 9,900원부터" },
  { text: "🔥 속궁합 리딩, 그 사람 정보까지 넣으면 정확도 UP", sub: "생년월일만 알아도 OK" },
];

function CardArt({ p, height, className }: { p: Product; height?: number; className?: string }) {
  // 로딩·실패 시에도 무드가 유지되도록 그라데이션을 밑색으로 깔고 일러스트를 얹는다
  return (
    <div
      aria-hidden
      className={className}
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
  const { theme, showMatureLabels } = useTheme();
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
  const list = PRODUCTS.filter((p) => filter === "all" || p.tags.includes(filter));

  return (
    <div className={`theme-${theme}`} style={{ margin: "0 auto" }}>
      <div className="app-home-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ── 상단바 ── */}
        <header className="app-header">
          <strong className="app-header-brand">
            <Image
              className="app-header-logo"
              src={loveRabbitLogo}
              alt="하트를 안고 있는 러브레빗 토끼 로고"
              width={30}
              height={30}
              priority
              sizes="30px"
            />
            LOVE<span style={{ color: "var(--accent)" }}>RABBIT</span>
            {showMatureLabels && <span className="app-header-mature-badge">19+</span>}
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
              onClick={async () => {
                if (user) {
                  if (window.confirm(`${user.email} 로 로그인 중이에요. 로그아웃할까요?`)) {
                    await logoutUser();
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
        <div style={{ padding: "0 20px 10px" }}>
          <div
            style={{
              borderRadius: 14, padding: "11px 16px", textAlign: "center", cursor: "default",
              // 색으로 눈길을 끌던 자리다. 포인트를 무채색으로 바꾸면서, 배너도
              // 한 단계 밝은 표면 + 얇은 테두리로 구분만 짓는다.
              background: dark
                ? "linear-gradient(120deg, #1b1b20, #131316)"
                : "linear-gradient(120deg, #ffffff, #f2f2f4)",
              border: dark ? "1px solid #2c2c33" : "1px solid #e2e2e6",
              boxShadow: dark ? "0 6px 28px rgba(0,0,0,0.45)" : "0 6px 24px rgba(0,0,0,0.12)",
            }}
          >
            <p style={{ fontWeight: 800, fontSize: "0.92rem", lineHeight: 1.35, color: "var(--text)" }}>{NOTICES[notice].text}</p>
            <p style={{ fontSize: "0.75rem", lineHeight: 1.35, color: "var(--text-dim)" }}>{NOTICES[notice].sub}</p>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 6 }}>
              {NOTICES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setNotice(i)}
                  aria-label={`공지 ${i + 1}`}
                  style={{
                    width: i === notice ? 16 : 6, height: 6, borderRadius: 999, border: "none", cursor: "pointer",
                    background: i === notice ? "#fff" : "rgba(255,255,255,0.45)", transition: "width 0.25s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 신당 — 도령 캐릭터 챗 ── */}
        <section style={{ padding: "30px 0 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 20px 16px" }}>
            <h3 style={{ fontSize: "1.05rem" }}>🏮 신당</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 700 }}>도령·신녀와 비밀 상담 — 로그인 후 무료 5번</span>
          </div>
          <div className="shrine-scroll">
            {Object.values(CHARACTERS).map((ch, index) => (
              <Link key={ch.id} href={`/shrine/${ch.id}`} className="hero-card shrine-card">
                <div aria-hidden className="shrine-card-art">
                  <Image
                    src={ch.img}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="(max-width: 640px) calc(100vw - 40px), 600px"
                    style={{ objectFit: "cover", objectPosition: "center 10%" }}
                  />
                </div>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.95) 85%)" }} />
                <div className="shrine-card-copy">
                  <span className="shrine-card-label">
                    {ch.title}
                    {ch.isNew ? <em>NEW</em> : null}
                  </span>
                  <strong>{ch.name}</strong>
                  <p>{ch.tagline}</p>
                  <span className="shrine-card-enter">🔥 {participantCount(ch.id).toLocaleString()}명 참여 · 입장하기 →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 필터 탭 + 상품 그리드 ── */}
        <section style={{ padding: "40px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {([["all", "전체"], ["popular", "인기"], ["new", "신규"]] as const).map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
            <button className="chip" style={{ marginLeft: "auto", color: "var(--accent-soft)" }} onClick={() => soon("태그 검색")}>태그 &gt;</button>
          </div>

          <div className="fortune-grid">
            {/* 레퍼런스 구성: 이미지가 카드 전체를 채우고 하단 그라데이션 위에 제목·설명·CTA 오버레이 */}
            {list.map((p) => {
              return (
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="card fortune-grid-card"
                  data-tone={p.tone}
                  data-product={p.id}
                >
                  <CardArt p={p} className="fortune-grid-art" />
                  <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 38%, rgba(10,6,16,0.55) 62%, rgba(10,6,16,0.96) 88%)" }} />
                  {p.tags.includes("popular") && (
                    <span className="fortune-grid-badge fortune-grid-badge-popular">인기</span>
                  )}
                  <div className="fortune-grid-copy">
                    <span className="fortune-grid-kicker">{p.emoji} {p.badge}</span>
                    <strong>{p.title}</strong>
                    <p>{p.cardCopy}</p>
                    <span className="fortune-grid-cta">
                      <span aria-hidden>{p.emoji}</span>
                      <span className="fortune-grid-cta-label">{p.ctaLabel}</span>
                      <b aria-hidden>→</b>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── 후기 ── 사주 카드를 전부 지나온 뒤에 온다 ── */}
        <HomeReviews />

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
              <p style={{ marginTop: 6 }}><Link href="/profile" style={{ color: "var(--text)" }}>프로필 설정</Link></p>
              <p><Link href="/reading" style={{ color: "var(--text)" }}>리딩 바로가기</Link></p>
            </div>
          </div>
        </footer>
      </div>

      {showQr && (
        <div
          className="app-modal-layer"
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

      <InquiryButton />
    </div>
  );
}
