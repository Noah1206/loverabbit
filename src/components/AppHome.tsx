"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import loveRabbitLogo from "../../public/logo.png";
import SignupModal from "@/components/SignupModal";
import { getUser, logoutUser, type User } from "@/lib/user";
import { useTheme } from "@/components/ThemeProvider";

// 앱형 홈 — 콘텐츠 마켓 레이아웃. 전역 테마 기본값은 다크이며 사용자의 선택을 저장한다.
// 상품 데이터는 lib/products.ts 단일 소스에서 온다 (상세 판매 페이지와 공유).
import { READING_SALE_CREDITS } from "@/lib/credits";
import { PRODUCTS, PRODUCT_MAP, type Product } from "@/lib/products";
import { questionsLeft } from "@/lib/credits";
import InquiryButton from "@/components/InquiryButton";

interface RecentReading {
  readingId: string;
  category: string;
  label: string;
  teaser: string;
  unlocked: boolean;
  createdAt: string;
}

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
  const [showSignup, setShowSignup] = useState(false);
  // 로그인한 사람에게만 보이는 자리. 크레딧과 최근 리딩은 서버가 답한다.
  const [balance, setBalance] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentReading[]>([]);
  /*
    손가락 화면의 hover 대역 (2026-08-31). 첫 탭은 카드를 "무장"만 시켜
    hover 애니메이션(굵은 줄·알약 밝아짐)을 보여주고, 같은 카드를 한 번 더
    탭해야 상세로 들어간다. 다른 카드를 탭하면 무장이 그쪽으로 옮겨 간다.
    hover 가 있는 기기(마우스)에서는 끼어들지 않는다.
  */
  const [armed, setArmed] = useState<string | null>(null);
  const noHover = useRef(false);
  useEffect(() => {
    noHover.current = window.matchMedia("(hover: none)").matches;
  }, []);
  const armOrGo = (id: string) => (event: React.MouseEvent) => {
    if (!noHover.current || armed === id) return; // 두 번째 탭 — 그대로 진입
    event.preventDefault();
    setArmed(id);
  };

  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
    return () => clearInterval(t);
  }, []);

  // 못 가져와도 그냥 지나간다 — 이 줄은 덤이고, 없다고 홈이 막히면 안 된다.
  useEffect(() => {
    if (!user) {
      setBalance(null);
      setRecent([]);
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
    post("/api/my-readings")
      .then((d: { readings?: RecentReading[] } | null) => { if (alive) setRecent(d?.readings ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

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
              alt="러브레빗 토끼 로고"
              width={30}
              height={30}
              priority
              sizes="30px"
            />
            LOVE<span style={{ color: "var(--accent)" }}>RABBIT</span>
          </strong>
          <div className="app-header-actions">
            {/* 질문권 — 참고 화면의 카운터 자리. 값이 바뀌면 숫자가 한 번 튄다. */}
            {balance !== null && (
              <Link href="/credits" className="app-header-count" aria-label={`질문권 ${questionsLeft(balance)}번 남음`}>
                <span aria-hidden>🎫</span>
                <b key={questionsLeft(balance)}>{questionsLeft(balance)}</b>
              </Link>
            )}
            <Link href="/rewards" className="app-header-icon" aria-label="선물함">
              <span aria-hidden>🎁</span>
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
              className="app-header-action app-header-login"
            >
              {user ? user.email.split("@")[0] : "로그인"}
            </button>
          </div>
        </header>

        {/* ── 내 상태 줄 — 로그인한 사람에게만. 질문권과 최근 리딩을 헤더 밑에
             먼저 보여, 홈에 들어오자마자 "내 것"이 눈에 걸리게 한다. ── */}
        {user && recent.length > 0 && (
          <div className="home-status">
            {recent[0] && (
              <Link href={`/reading/${recent[0].readingId}`} className="home-status-card">
                <span className="home-status-avatar" aria-hidden>
                  {PRODUCT_MAP[recent[0].category]?.emoji ?? "\uD83D\uDC30"}
                </span>
                <span className="home-status-body">
                  <strong>
                    {recent[0].unlocked
                      ? `${recent[0].label} 리딩을 다시 볼 수 있어요`
                      : `${recent[0].label} 리딩이 기다리고 있어요`}
                    {!recent[0].unlocked && <i className="home-status-dot" aria-hidden />}
                  </strong>
                  <span>{recent[0].teaser}</span>
                </span>
                <span className="home-status-go" aria-hidden>›</span>
              </Link>
            )}

          </div>
        )}

        {/* ── 공지 배너 ── 참고 화면의 제목줄 달린 창 모양. 제목줄이 무엇에
             대한 알림인지 먼저 말하고, 본문이 바뀔 때 아래에서 올라온다. */}
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
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
                  className={`card fortune-grid-card${armed === p.id ? " is-armed" : ""}`}
                  data-tone={p.tone}
                  data-product={p.id}
                  onClick={armOrGo(p.id)}
                >
                  <div className="fortune-grid-media">
                    <CardArt p={p} className="fortune-grid-art" />
                  </div>
                  <div className="fortune-grid-body">
                    <strong>{p.title}</strong>
                    {/* 그리드에는 긴 소개(cardCopy) 대신 한 줄 훅 — 참고 화면의 밀도.
                        긴 소개는 상세 페이지가 이어받는다. */}
                    <p>{p.ctaHook}</p>
                    <span className="fortune-grid-foot">
                      <span className="fortune-grid-price">
                        <b>{READING_SALE_CREDITS}크레딧</b>
                      </span>
                      <span className="fortune-grid-go">보러가기 ›</span>
                    </span>
                  </div>
                </Link>
              );
            })}
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
