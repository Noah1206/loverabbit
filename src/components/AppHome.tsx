"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import loveRabbitLogo from "../../public/logo.png";
import SignupModal from "@/components/SignupModal";
import { getUser, logoutUser, type User } from "@/lib/user";
import { useTheme } from "@/components/ThemeProvider";

// 앱형 홈 — 콘텐츠 마켓 레이아웃. 전역 테마 기본값은 다크이며 사용자의 선택을 저장한다.
// 상품 데이터는 lib/products.ts 단일 소스에서 온다 (상세 판매 페이지와 공유).
import { READING_SALE_CREDITS } from "@/lib/credits";
import { GRID_HIDDEN, PRODUCTS, PRODUCT_MAP, type Product } from "@/lib/products";
import { questionsLeft } from "@/lib/credits";
import InquiryButton from "@/components/InquiryButton";


const NOTICES = [
  { text: "🐰 오픈 이벤트 — 가입하면 첫 사주 1,900원", sub: "어떤 사주든 첫 한 장은 1,900원" },
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
  const { theme } = useTheme();
  const [notice, setNotice] = useState(0);
  const [filter, setFilter] = useState<"all" | "popular" | "new">("all");
  const [user, setUser] = useState<User | null>(null);
  // localStorage 를 읽기 전에는 배너를 그리지 않는다 — 로그인한 사람에게
  // "로그인하세요" 가 한 순간 번쩍이는 것을 막는다.
  const [checked, setChecked] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  // 헤더의 질문권 카운터가 쓰는 잔액. 서버가 답한다.
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
    setChecked(true);
    return () => clearInterval(t);
  }, []);

  // 못 가져와도 그냥 지나간다 — 이 줄은 덤이고, 없다고 홈이 막히면 안 된다.
  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    let alive = true;
    const post = (path: string) =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token }),
      }).then((res) => (res.ok ? res.json() : null));

    post("/api/credits")
      .then((d: { balance?: number } | null) => { if (alive && typeof d?.balance === "number") setBalance(d.balance); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const soon = (name: string) => alert(`${name}은(는) 오픈 준비 중이에요 🐰`);
  const list = PRODUCTS.filter((p) => !GRID_HIDDEN.has(p.id) && (filter === "all" || p.tags.includes(filter)));

  return (
    <div className={`theme-${theme}`} style={{ margin: "0 auto" }}>
      <div className="app-home-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ── 상단바 ── */}
        <header className="app-header">
          {/* 글자를 걷고 로고만 남긴다 (2026-09-01 운영자). 이름은 alt 가 진다 —
              눈으로는 안 보여도 낭독기와 검색에는 남아야 한다. */}
          <strong className="app-header-brand">
            <Image
              className="app-header-logo"
              src={loveRabbitLogo}
              alt="러브레빗"
              width={36}
              height={36}
              priority
              sizes="36px"
            />
          </strong>
          <div className="app-header-actions">
            {/* 질문권 — 참고 화면의 카운터 자리. 값이 바뀌면 숫자가 한 번 튄다. */}
            {balance !== null && (
              <Link href="/credits" className="app-header-count" aria-label={`질문권 ${questionsLeft(balance)}번 남음`}>
                <span aria-hidden>🎫</span>
                <b key={questionsLeft(balance)}>{questionsLeft(balance)}</b>
              </Link>
            )}
            <Link href="/credits" className="app-header-icon" aria-label="크레딧 충전 · 내 러빗">
              {/* 쌓인 동전 — 눌러서 가는 곳이 충전 페이지다. BottomNav 처럼 24 격자 stroke 로만 */}
              <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="14.5" cy="6.8" rx="5.5" ry="2.6" />
                <path d="M9 6.8v3.6c0 1.44 2.46 2.6 5.5 2.6s5.5-1.16 5.5-2.6V6.8" />
                <path d="M9 10.4v3.6c0 1.44 2.46 2.6 5.5 2.6s5.5-1.16 5.5-2.6v-3.6" />
                <ellipse cx="8" cy="16.4" rx="5" ry="2.4" />
                <path d="M3 16.4v1.6c0 1.33 2.24 2.4 5 2.4s5-1.07 5-2.4v-1.6" />
              </svg>
            </Link>
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
              className="app-header-icon"
              aria-label={user ? `${user.email.split("@")[0]} · 로그아웃` : "로그인"}
              title={user ? `${user.email.split("@")[0]} · 로그아웃` : "로그인"}
            >
              {/* 사람 아이콘. 로그인하면 안을 채워 "들어와 있음"을 색으로 말한다 —
                  글자를 걷었으니 상태는 모양이 대신 진다. 동전 아이콘과 같은 24 격자. */}
              <svg
                aria-hidden
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="3.6" fill={user ? "currentColor" : "none"} />
                <path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8" />
              </svg>
            </button>
          </div>
        </header>

        {/* ── 배너 ── 헤더 바로 밑에 고정. 그림은 하나지만 문구는 사람에 따라
             갈린다 — 아직 로그인하지 않았으면 로그인을, 이미 들어온 사람에게는
             사주를 권한다. "로그인하세요"를 로그인한 사람에게 다시 보이면 소음이다.

             그림에는 글자가 없다. 문구는 왼쪽 빈 자리에 얹는 텍스트라서
             카피를 바꿔도 이미지를 다시 만들 필요가 없다. */}
        {checked && (user ? (
          <Link href="/reading" className="home-login-banner">
            <span className="home-login-banner-copy">
              <strong>
                오늘의 인연,
                <br />
                사주로 먼저 봐요
              </strong>
              <span className="home-login-banner-cta">
                내 사주 보러 가기 <i aria-hidden>›</i>
              </span>
            </span>
          </Link>
        ) : (
          <button type="button" className="home-login-banner" onClick={() => setShowSignup(true)}>
            <span className="home-login-banner-copy">
              <strong>
                지금 로그인하고
                <br />
                러빗을 받아보세요!
              </strong>
              <span className="home-login-banner-cta">
                로그인하고 시작하기 <i aria-hidden>›</i>
              </span>
            </span>
          </button>
        ))}

        {/* ── 필터 탭 + 상품 그리드 ── */}
        <section style={{ padding: "40px 8px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
            {([["all", "전체"], ["popular", "인기"], ["new", "신규"]] as const).map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
            <button className="chip" style={{ marginLeft: "auto", color: "var(--accent-soft)" }} onClick={() => soon("태그 검색")}>태그 &gt;</button>
          </div>

          <div className="fortune-grid">
            {/* 세트(모음집) 카드는 뺐다 (2026-08-31 운영자 결정) — 단품만 보여준다.
                /set/[id] 판매 페이지 자체는 남아 있어 직접 링크는 여전히 열린다. */}
            {/* 레퍼런스 구성: 이미지가 카드 전체를 채우고 하단 그라데이션 위에 제목·설명·CTA 오버레이 */}
            {list.map((p) => {
              return (
                /* 카드는 상세 판매 페이지로 간다 (2026-09-01 운영자 결정 — 8/31 의
                   "바로 폼으로"를 되돌린다). 무엇을 사는지 먼저 읽고 나서 폼으로
                   간다. 폼으로 바로 가는 길은 상세 페이지의 CTA 가 잇는다. */
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="card fortune-grid-card"
                  data-tone={p.tone}
                  data-product={p.id}
                >
                  <div className="fortune-grid-media">
                    <CardArt p={p} className="fortune-grid-art" />
                  </div>
                  <div className="fortune-grid-body">
                    <strong>{p.title}</strong>
                    {/* 긴 소개(cardCopy)로 복귀 (2026-08-31 운영자 결정) — 세 줄에서 자른다. */}
                    <p>{p.cardCopy}</p>
                    <span className="fortune-grid-foot">
                      <span className="fortune-grid-price">
                        {/* 러빗 코인 — 동그라미 안의 토끼 로고가 화폐 기호다 */}
                        <i className="rabbit-coin" aria-hidden>
                          <Image src={loveRabbitLogo} alt="" width={12} height={12} />
                        </i>
                        <b>{READING_SALE_CREDITS}</b>
                        <small>러빗</small>
                      </span>
                      <span className="fortune-grid-go" aria-hidden>›</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── 공지 배너 ── 제목줄 달린 창 모양. 제목줄이 무엇에 대한 알림인지
             먼저 말하고, 본문이 바뀔 때 아래에서 올라온다.

             상품 그리드 아래로 내렸다 (2026-09-01 운영자 결정). 헤더 바로 밑은
             로그인 배너가 쓰고, 홈에 들어온 사람이 먼저 볼 것은 살 수 있는
             리딩이지 공지가 아니다. */}
        <div className="home-notice-wrap">
          <div className="home-notice">
            <div className="home-notice-bar">
              <span className="home-notice-bar-title">
                <span aria-hidden>🐰</span> 러브레빗 소식
              </span>
              <span className="home-notice-bar-dots" aria-hidden>
                <i /><i /><i />
              </span>
            </div>
            <div className="home-notice-body">
              {/* key 가 바뀌면 새로 그려지면서 올라오는 동작이 다시 돈다 */}
              <div key={notice} className="home-notice-copy">
                <p className="home-notice-title">{NOTICES[notice].text}</p>
                <p className="home-notice-sub">{NOTICES[notice].sub}</p>
              </div>
              <div className="home-notice-tabs" role="tablist" aria-label="공지">
                {NOTICES.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === notice}
                    aria-label={`공지 ${i + 1}`}
                    className={"home-notice-tab" + (i === notice ? " on" : "")}
                    onClick={() => setNotice(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>


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

      {showSignup && (
        <SignupModal
          reason="가입하면 리딩 보관·결제가 이 계정에 연결돼요"
          onClose={() => setShowSignup(false)}
        />
      )}

      <InquiryButton />
    </div>
  );
}
