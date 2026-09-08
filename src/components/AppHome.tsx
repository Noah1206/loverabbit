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
import {
  GRID_HIDDEN,
  PRODUCTS,
  TOPIC_LABEL,
  TOPIC_ORDER,
  type Product,
  type ProductTopic,
} from "@/lib/products";
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
        src={`/cards-pastel/${p.id}.jpg?v=2`}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%" }}
      />
    </div>
  );
}

/**
 * 상품 카드 하나. 주제 줄(rail)과 한 판(grid)이 같은 카드를 쓴다 — 두 벌로
 * 나누면 값·링크·아트가 두 곳에서 갈라진다.
 */
function ProductCard({ p, cost, variant }: { p: Product; cost: number; variant: "rail" | "grid" }) {
  return (
    /* 카드는 상세 판매 페이지로 간다 (2026-09-01 운영자 결정) — 무엇을 사는지
       먼저 읽고 나서 폼으로 간다. */
    <Link
      href={`/product/${p.id}`}
      className={`card fortune-grid-card${variant === "rail" ? " home-topic-card" : ""}`}
      data-tone={p.tone}
      data-product={p.id}
    >
      <div className="fortune-grid-media">
        <CardArt p={p} className="fortune-grid-art" />
      </div>
      <div className="fortune-grid-body">
        <strong>{p.title}</strong>
        <p>{p.cardCopy}</p>
        <span className="fortune-grid-foot">
          <span className="fortune-grid-price">
            {/* 러빗 코인 — 동그라미 안의 토끼 로고가 화폐 기호다 */}
            <i className="rabbit-coin" aria-hidden>
              <Image src={loveRabbitLogo} alt="" width={12} height={12} />
            </i>
            <b>{cost}</b>
            <small>러빗</small>
          </span>
          <span className="fortune-grid-go" aria-hidden>›</span>
        </span>
      </div>
    </Link>
  );
}

// 사주지도를 홈에서 볼 수 있는 계정. BottomNav 의 DEV_EMAILS 와 같은 목록이다 —
// 전체 공개할 때 두 곳을 같이 지운다.
const SAJU_MAP_EMAILS = ["ab40905045@gmail.com"];

export default function AppHome() {
  const { theme } = useTheme();
  const [notice, setNotice] = useState(0);
  /* 주제 탭 (2026-09-08 운영자: "종목이 적다"). 21종이 세로 한 판에 쏟아지면
     스크롤에 지친 만큼만 본 것이 전부가 된다. products.ts 의 topic 이 이미
     다섯으로 갈라 두었는데 화면이 그걸 안 쓰고 있었다 — 데이터는 그대로 두고
     화면만 그 축으로 세운다. "전체"는 주제별 줄로, 주제 하나를 고르면 그것만
     한 판으로 편다. */
  const [topic, setTopic] = useState<ProductTopic | "all">("all");
  const [user, setUser] = useState<User | null>(null);
  // localStorage 를 읽기 전에는 배너를 그리지 않는다 — 로그인한 사람에게
  // "로그인하세요" 가 한 순간 번쩍이는 것을 막는다.
  const [showSignup, setShowSignup] = useState(false);
  /* 그리드에 적는 사주 한 장 값. 사람마다 다르다 (2·4·10러빗 — 지금까지
     열어본 장수를 탄다). 로그인 전에는 첫 장 값을 적는다: 아직 아무것도
     열지 않은 사람이 실제로 낼 값이다. */
  const [readingCost, setReadingCost] = useState(READING_SALE_CREDITS);
  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
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

  const visible = PRODUCTS.filter((p) => !GRID_HIDDEN.has(p.id));
  const byTopic = (t: ProductTopic) => visible.filter((p) => p.topic === t);
  const list = topic === "all" ? visible : byTopic(topic);

  return (
    <div className={`theme-${theme}`} style={{ margin: "0 auto" }}>
      <div className="app-home-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* ── 상단바 ── */}
        <header className="app-header">
          {/* 로고 대신 영문 이름을 굵게 (2026-09-06 운영자). 9/1 에 글자를 걷고
              로고만 뒀던 것을 되돌린 셈인데, 이번엔 그림 없이 글자만이다. */}
          <strong className="app-header-brand" lang="en">
            LoveRabbit
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

        {/* 헤더 밑 로그인·사주 배너는 뺐다 (2026-09-06 운영자). 9/4 이후 처음 온
            424명 중 297명이 이 화면만 보고 나갔다 — 첫 요구가 로그인이었다. */}

        {/* ── 처음 온 사람의 문 ── 인사하는 토끼가 실려 있는 카드. */}
        <Link href="/guide" className="home-guide-card">
          <span className="home-guide-copy">
            <strong>
              러브레빗에
              <br />
              처음 오셨다면?
            </strong>
            <small>리딩 받는 법 · 러빗</small>
            <span className="home-guide-cta">3분 가이드 보기 <i aria-hidden>›</i></span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="home-guide-art" src="/assets/today/rabbit-hello-hanbok.webp" alt="" loading="lazy" />
        </Link>

        {/* ── 오늘의 운세 ── 엔진(daily-action.ts)과 /today 는 이미 있었는데
             홈에서 들어가는 줄이 없었다 (2026-09-08). 매일 바뀌는 유일한
             화면이라 재방문이 여기 걸린다 — 그래서 상품 위에 둔다. */}
        <Link href="/today" className="home-today-card">
          <span className="home-today-copy">
            <small>오늘의 운세</small>
            <strong>오늘 나에게 맞는 한 걸음</strong>
            <span className="home-today-cta">지금 확인하기 <i aria-hidden>›</i></span>
          </span>
          <span className="home-today-art" aria-hidden>🌙</span>
        </Link>

        {/* ── 사주지도 ── 무료·NEW 진입점 (2026-09-08).

             상품 카드 사이에 끼우지 않는다. 이건 파는 물건이 아니라 친구를
             데려오는 기능이고, 값이 없다는 것이 가장 큰 정보다 — 그래서
             유료 상품 줄보다 위에, 오늘의 운세 바로 아래에 둔다.

             아직 만드는 중이라 탭과 같은 계정에서만 보인다(BottomNav 의
             DEV_EMAILS 와 같은 규칙). 열 때 두 곳을 같이 푼다. */}
        {user?.email && SAJU_MAP_EMAILS.includes(user.email) && (
          <Link href="/guin" className="home-map-card">
            <span className="home-map-copy">
              <span className="home-map-tags">
                <b>NEW</b>
                <i>무료</i>
              </span>
              <strong>
                내 주변 사람 중
                <br />
                누가 진짜 내 귀인일까?
              </strong>
              <small>친구·연인·동료를 등록하고 인연 지도를 만들어봐요.</small>
              <span className="home-map-cta">사주지도 만들기 <i aria-hidden>›</i></span>
            </span>
            <span className="home-map-art" aria-hidden>🗺️</span>
          </Link>
        )}

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

        {/* ── 주제 탭 + 상품 ── */}
        <section style={{ padding: "40px 0 0" }}>
          {/* 탭은 옆으로 민다 — 다섯이 한 줄에 다 안 들어가는 폭이 있다 */}
          <div className="home-topic-tabs">
            <button
              className={`chip${topic === "all" ? " on" : ""}`}
              onClick={() => setTopic("all")}
            >
              전체
            </button>
            {/* 상품이 하나도 없는 주제는 탭도 세우지 않는다 — 삶의 자리 셋
                (건강·가족·이사)이 GRID_HIDDEN 에 들어 있어, 탭만 있으면
                눌렀을 때 빈 화면이 나온다. 그 셋을 다시 열면 탭도 같이 선다. */}
            {TOPIC_ORDER.filter((t) => byTopic(t).length > 0).map((t) => (
              <button
                key={t}
                className={`chip${topic === t ? " on" : ""}`}
                onClick={() => setTopic(t)}
              >
                <span aria-hidden>{TOPIC_LABEL[t].emoji}</span> {TOPIC_LABEL[t].title}
              </button>
            ))}
          </div>

          {topic === "all" ? (
            /* 주제마다 한 줄. 옆으로 밀어 보게 두면 한 화면에서 다섯 주제가
               다 눈에 들어온다 — 세로 한 판일 때보다 "많다"가 먼저 읽힌다. */
            TOPIC_ORDER.map((t) => {
              const items = byTopic(t);
              if (!items.length) return null;
              return (
                <div key={t} className="home-topic-row">
                  <div className="home-topic-head">
                    <strong>
                      <span aria-hidden>{TOPIC_LABEL[t].emoji}</span> {TOPIC_LABEL[t].title}
                    </strong>
                    <small>{TOPIC_LABEL[t].desc}</small>
                  </div>
                  <div className="home-topic-scroller">
                    {items.map((p) => (
                      <ProductCard key={p.id} p={p} cost={readingCost} variant="rail" />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="fortune-grid">
              {list.map((p) => (
                <ProductCard key={p.id} p={p} cost={readingCost} variant="grid" />
              ))}
            </div>
          )}
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
