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
  /* 그리드에 적는 사주 한 장 값. 사람마다 다르다 (2·4·10러빗 — 지금까지
     열어본 장수를 탄다). 로그인 전에는 첫 장 값을 적는다: 아직 아무것도
     열지 않은 사람이 실제로 낼 값이다. */
  const [readingCost, setReadingCost] = useState(READING_SALE_CREDITS);
  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
    setChecked(true);
    return () => clearInterval(t);
  }, []);

  // 못 가져와도 그냥 지나간다 — 배너는 폼으로 보내면 되고, 홈이 막히면 안 된다.
  useEffect(() => {
    if (!user) {
      setReadingCost(READING_SALE_CREDITS);
      return;
    }
    let alive = true;
    // 이 사람이 다음 한 장에 낼 값. 못 가져오면 첫 장 값 그대로 둔다 —
    // 결제창이 정본이라, 여기서 틀려도 깎이는 값은 서버가 정한다.
    fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { readingCost?: number } | null) => {
        if (alive && typeof d?.readingCost === "number") setReadingCost(d.readingCost);
      })
      .catch(() => {});
    // 웹툰 배너가 쓰던 /api/my-readings 조회는 걷었다 (2026-09-02) — 배너를
    // 숨긴 뒤로는 읽는 곳이 없어, 홈이 열릴 때마다 헛도는 요청이었다.
    return () => {
      alive = false;
    };
  }, [user]);

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
          <Link href="/reading" className="home-login-banner home-member-banner">
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

        {/* ── 웹툰 사주 ── 홈에서 숨겼다 (2026-09-02 운영자). /webtoon-saju/[id]
             페이지와 생성 경로는 그대로 살아 있어 직접 링크는 여전히 열린다 —
             홈에서 들어가는 줄만 걷었다. 되돌리려면 아래 주석을 풀고,
             webtoonId 상태와 /api/my-readings 조회도 같이 되살려야 한다
             (해금된 리딩 하나를 찾아 그 웹툰으로 보내던 값이다).

        <Link
          href={webtoonId ? `/webtoon-saju/${webtoonId}` : "/reading"}
          className="home-webtoon"
        >
          <span className="home-webtoon-emoji" aria-hidden>🐰</span>
          <span className="home-webtoon-copy">
            <strong>내 사주를 웹툰으로 읽어요</strong>
            <small>재물운 · 연애운 · 이별운 · 앞 장면은 무료</small>
          </span>
          <span className="home-webtoon-go" aria-hidden>›</span>
        </Link>
        */}

        {/* 세트 줄은 홈에서 뺐다 (2026-09-01 운영자). /set/[id] 판매 페이지와
             쿠폰 정산은 그대로 살아 있어 직접 링크는 여전히 열린다. */}

        {/* ── 필터 탭 + 상품 그리드 ── */}
        <section style={{ padding: "40px 8px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
            {([["all", "전체"], ["popular", "인기"], ["new", "신규"]] as const).map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
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
                        <b>{readingCost}</b>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: "0.82rem" }}>
            <div>
              <strong style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>지원</strong>
              {/* 문의 기능은 이미 있다(InquiryButton) — 가짜 alert 대신 그것을 연다. */}
              {/* 문의는 한 곳이다 — "고객센터"와 "자주 묻는 질문"을 따로 두면
                  같은 창을 여는 버튼이 셋이 된다. 이름 하나로 합친다. */}
              <p style={{ marginTop: 6 }}><button onClick={() => window.dispatchEvent(new Event("loverabbit:inquiry"))} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, font: "inherit" }}>문의하기</button></p>
            </div>
            <div>
              <strong style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>법적 고지</strong>
              {/* 문서는 실제로 있다 — 가짜 alert 을 걷고 링크로 잇는다 (2026-09-01).
                  돈을 받는 화면에서 약관으로 가는 길이 없으면 안 된다. */}
              <p style={{ marginTop: 6 }}><Link href="/terms" style={{ color: "var(--text)" }}>이용약관</Link></p>
              <p><Link href="/privacy" style={{ color: "var(--text)" }}>개인정보처리방침</Link></p>
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
