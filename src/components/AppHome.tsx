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
import { FIRST_READING_PRICE } from "@/lib/coupons";
import { BUNDLES, bundleListPrice } from "@/lib/bundles";
import { PRODUCTS, PRODUCT_MAP, type Product } from "@/lib/products";
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
  const [showSignup, setShowSignup] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNotice((n) => (n + 1) % NOTICES.length), 4500);
    setUser(getUser());
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
              alt="러브레빗 토끼 로고"
              width={30}
              height={30}
              priority
              sizes="30px"
            />
            LOVE<span style={{ color: "var(--accent)" }}>RABBIT</span>
          </strong>
          <div className="app-header-actions">
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
              borderRadius: 0, padding: "11px 16px", textAlign: "center", cursor: "default",
              // 색으로 눈길을 끌던 자리다. 흰 카드 + 얇은 선으로 구분만 짓는다.
              background: "var(--bg-card)",
              border: "1px solid var(--line)",
              boxShadow: "0 1px 2px rgba(36, 29, 38, 0.04), 0 10px 26px rgba(36, 29, 38, 0.05)",
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
                    width: i === notice ? 16 : 6, height: 6, borderRadius: 0, border: "none", cursor: "pointer",
                    background: i === notice ? "var(--accent)" : "var(--tint-line)", transition: "width 0.25s",
                  }}
                />
              ))}
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
            {/* 세트 카드 — 전체 보기에서만, 맨 앞에. 세 번 사게 하는 것보다
                한 번에 셋을 파는 쪽이 이 규모에선 현실적이다 (2026-08-28). */}
            {filter === "all" &&
              BUNDLES.map((b) => (
                <Link key={b.id} href={`/set/${b.id}`} className="card fortune-grid-card fortune-grid-set" data-product={b.first}>
                  {/* 세 상품 그림을 나란히 — 단품 카드와 같은 그림이라 "저 셋이 묶였다"가 한눈에 읽힌다 */}
                  <div className="fortune-grid-set-art" aria-hidden>
                    {b.items.map((id) => PRODUCT_MAP[id] && <CardArt key={id} p={PRODUCT_MAP[id]} />)}
                  </div>
                  <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,6,16,0.05) 30%, rgba(10,6,16,0.7) 62%, rgba(10,6,16,0.97) 90%)" }} />
                  <span className="fortune-grid-badge fortune-grid-badge-sale">
                    {Math.round((1 - b.price / bundleListPrice(b)) * 100)}% 할인
                  </span>
                  <div className="fortune-grid-copy">
                    <span className="fortune-grid-kicker">{b.emoji} 세트</span>
                    <strong>{b.title}</strong>
                    <p>{b.items.map((id) => PRODUCT_MAP[id]?.title).join(" + ")}</p>
                    <span className="fortune-grid-price">
                      <s>{bundleListPrice(b).toLocaleString("ko-KR")}원</s>
                      <b>{b.price.toLocaleString("ko-KR")}원</b>
                      <small>세 장</small>
                    </span>
                    <span className="fortune-grid-cta">
                      <span aria-hidden>{b.emoji}</span>
                      <span className="fortune-grid-cta-label">세 장 한 번에 열기</span>
                      <b aria-hidden>→</b>
                    </span>
                  </div>
                </Link>
              ))}
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
                    <span className="fortune-grid-badge fortune-grid-badge-popular">
                      <span aria-hidden>🔥</span>인기
                    </span>
                  )}
                  {/* 첫 리딩 값 — 어떤 카드든 가입 쿠폰으로 이 값에 산다. 할인율은
                      정가에서 계산하므로 값이 바뀌면 여기도 따라온다. */}
                  <span className="fortune-grid-badge fortune-grid-badge-sale">
                    {Math.round((1 - FIRST_READING_PRICE / p.price) * 100)}% 할인
                  </span>
                  <div className="fortune-grid-copy">
                    <span className="fortune-grid-kicker">{p.emoji} {p.badge}</span>
                    <strong>{p.title}</strong>
                    <p>{p.cardCopy}</p>
                    <span className="fortune-grid-price">
                      <s>{p.price.toLocaleString("ko-KR")}원</s>
                      <b>{FIRST_READING_PRICE.toLocaleString("ko-KR")}원</b>
                      <small>첫 리딩</small>
                    </span>
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
