"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SignupModal from "@/components/SignupModal";
import { getUser, logoutUser, type User } from "@/lib/user";
import { useTheme } from "@/components/ThemeProvider";

/*
  앱형 홈 — 무엇이 있는지 보여주는 자리다. 파는 자리가 아니다.

  상품 카드 그리드를 걷었다 (2026-09-09 운영자). 스무 종을 홈에 늘어놓으면
  들어온 사람이 스무 개를 훑는 일부터 해야 하는데, 그 앞에서 무엇을 고를지
  정한 사람은 거의 없다. 종목(사주·타로·궁합…)을 먼저 고르고 그 목록에서
  사주를 고르는 순서로 바꿨다 — 고르는 일을 두 번으로 나누면 한 번에 볼
  가짓수가 스무 개에서 여섯 개로 줄어든다.

  홈에 남은 것: 이벤트, 종목 여섯, 배너 슬라이드, 오늘의 사주, 공지.
  상품 데이터(products.ts)는 이제 홈에서 하나도 읽지 않는다 — 무엇을 파는지는
  종목 목록이 말하고, 홈은 어디로 갈지만 고르게 한다.
*/
import GenreIcon from "@/components/GenreIcon";
import IdolPicker from "@/components/IdolPicker";
import WorryPicker from "@/components/WorryPicker";
import { CREDIT_EVENT } from "@/lib/credits";
import { GENRES } from "@/lib/genres";
import { seoulYear, yearLabelOf } from "@/lib/year-label";
import InquiryButton from "@/components/InquiryButton";


export default function AppHome() {
  const { theme } = useTheme();
  /* 해 이름은 렌더 때 센다 — 모듈 바깥에서 계산하면 빌드 시각에 굳어,
     해가 바뀌어도 다시 배포할 때까지 지난해를 말한다. */
  const thisYear = seoulYear();
  const nextYear = yearLabelOf(thisYear + 1);
  /* 배너 슬라이드. 누르면 멈춘다 — 읽는 중에 넘어가면 안내가 아니라 방해다. */
  const [slide, setSlide] = useState(0);
  const [slideHeld, setSlideHeld] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // localStorage 를 읽기 전에는 배너를 그리지 않는다 — 로그인한 사람에게
  // "로그인하세요" 가 한 순간 번쩍이는 것을 막는다.
  const [showSignup, setShowSignup] = useState(false);
  useEffect(() => {
    if (slideHeld) return;
    const t = setInterval(() => setSlide((n) => (n + 1) % 3), 3000);
    return () => clearInterval(t);
  }, [slideHeld]);

  useEffect(() => {
    setUser(getUser());
  }, []);


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
            {/* 찾는 이름이 이미 있는 사람의 지름길 — 종목·고민을 지나지 않고
                바로 상품으로 간다. 돋보기는 설명이 필요 없는 몇 안 되는 모양이다. */}
            <Link href="/search" className="app-header-icon" aria-label="검색">
              <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.4 4.4" />
              </svg>
            </Link>
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

        {/*
          ── 이벤트 배너 ── (2026-09-09)

          값을 깎지 않고 러빗을 더 준다. 콘텐츠가 계속 늘어나는 단계라 가격을
          내리면 정가 인식을 다시 세우기 어렵다 — 할인은 한 번 하면 그 값이
          정가가 되고, "더 준다" 는 끝나도 값이 그대로다.

          헤더 바로 아래로 올렸다 (2026-09-09 운영자). 기간이 걸린 줄이라 —
          끝나면 사라진다 — 그동안은 가장 먼저 눈에 들어와야 한다. 종목은
          없어지지 않으므로 한 칸 밀려도 계속 그 자리에 있다.
          CREDIT_EVENT 를 null 로 두면 이 줄이 통째로 사라지고, 그때는 종목이
          다시 맨 위가 된다.
        */}
        {CREDIT_EVENT && (
          <Link href="/credits" className="home-event-card">
            <span className="home-event-copy">
              <b>{CREDIT_EVENT.title}</b>
              <strong>
                충전하면
                <br />
                러빗을 더 드려요
              </strong>
              <span className="home-event-cta">충전하러 가기 <i aria-hidden>›</i></span>
            </span>
          </Link>
        )}

        {/*
          ── 종목 ── (2026-09-08)

          "종목이 적다" 는 말이 20종을 팔고 있는데도 나왔다. 전부 사주 한
          갈래로만 보였기 때문이다 — 주제(연애·재물)로는 갈라 두었지만
          사용자가 세는 것은 주제가 아니라 **무엇을 보는가** 다.

          궁합이 특히 그랬다. 상대를 넣어야 하는 다른 종류의 일인데 연애 주제
          안에 상품 하나로 섞여 있어 있는 줄도 몰랐다. 열 개나 있는데도.

          새 데이터는 없다. 궁합인지 아닌지는 needsPartner 가 이미 정한다.
        */}
        {/* 종목 줄이 무엇인지 한 줄로 말한다 (2026-09-09 운영자). 아이콘 여섯만
            서 있으면 무엇을 고르는 자리인지 읽는 데 한 박자 걸린다. */}
        <h2 className="home-section-title">장르별 운세</h2>
        <nav className="home-genres" aria-label="종목">
          {GENRES.map((g) => (
            <Link key={g.id} href={g.href} className="home-genre">
              <span className="home-genre-art">
                {/* 캐릭터 그림에서 선 아이콘으로 (2026-09-08 운영자) — 종목
                    여섯에 얼굴 여섯이 서면 한 화면에 캐릭터가 너무 많다. */}
                <GenreIcon id={g.id} size={42} />
                {g.free && <b className="home-genre-tag">무료</b>}
              </span>
              <strong>{g.label}</strong>
            </Link>
          ))}
        </nav>

        {/*
          ── 배너 슬라이드 ── (2026-09-09 운영자)

          사주지도와 가이드 카드를 한 자리에 묶어 3초마다 넘긴다. 둘 다
          "무엇을 파는가" 가 아니라 "이런 것도 있다" 를 말하는 카드라, 세로로
          쌓으면 각자 한 화면을 먹으면서 정작 종목 줄을 아래로 밀어낸다.

          종목 줄 **아래**에 둔 이유: 들어온 사람이 먼저 할 일은 무엇을 볼지
          고르는 것이고, 이 둘은 그 다음에 눈에 들어와도 되는 것들이다.

          자동으로 넘기되 점을 눌러 세울 수 있게 두었다 — 읽는 중에 넘어가면
          그건 안내가 아니라 방해다.
        */}
        <div className="home-slide">
          {/* 둘을 다 그려 두고 트랙을 옆으로 민다 — 하나씩 갈아 끼우면
              움직임이 안 보이고, 넘어가는 방향도 알 수 없다. */}
          <div
            className="home-slide-track"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* 사주지도 (2026-09-09 운영자). 슬라이드 안으로 되돌렸다 —
                아래에 따로 세웠던 것을 여기로 옮긴다. */}
            <div className="home-slide-item">
              <Link href="/guin" className="gt">
                <span className="gt-copy">
                  <strong>
                    내 주변 사람 중
                    <br />
                    누가 진짜 내 귀인일까?
                  </strong>
                  <small>친구·연인·동료를 등록하면 인연 지도가 그려져요</small>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gt-art" src="/home/guin.jpg" alt="" loading="lazy" />
              </Link>
            </div>
            <div className="home-slide-item">
              <Link href="/product/idol" className="home-idol-card">
                <span className="home-idol-copy">
                  <span className="home-map-tags">
                    <b>NEW</b>
                  </span>
                  <strong>
                    내가 최애한테 끌린 이유,
                    <br />
                    사주에 있을까?
                  </strong>
                  <small>최애 생년월일만 알면 돼요. 두 명식이 만나는 자리를 봅니다.</small>
                  <span className="home-idol-cta">최애 궁합 보기 <i aria-hidden>›</i></span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="home-idol-art" src="/home/idol.jpg" alt="" loading="lazy" />
              </Link>
            </div>
            <div className="home-slide-item">
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
            </div>
          </div>
          <div className="home-slide-dots" role="tablist" aria-label="배너">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                role="tab"
                aria-selected={slide === i}
                aria-label={["사주지도", "최애 아이돌 궁합", "이용 가이드"][i]}
                className={`home-slide-dot${slide === i ? " on" : ""}`}
                onClick={() => {
                  setSlide(i);
                  setSlideHeld(true);
                }}
              />
            ))}
          </div>
        </div>

        {/*
          ── 연예인 궁합 ── (2026-09-09 운영자)

          배너 슬라이드 바로 아래다. 슬라이드의 아이돌 카드가 "이런 것도 있다"
          를 말하고, 여기서 최애 이름을 눌러 바로 들어간다 — 배너를 본 사람이
          다음 동작을 그 자리에서 할 수 있어야 한다.

          최애의 생일을 외우는 사람은 드물어서 상품 앞에서 돌아섰다. 이름을
          누르면 그 값을 들고 간다.
        */}
        <IdolPicker />

        {/*
          ── 고민 고르기 ── (2026-09-09 운영자)

          오늘의 사주 오각형 자리를 대신한다. 종목 줄이 "무엇을 볼까" 를
          묻는다면 여기는 "무엇이 걸리는가" 를 묻는다 — 아직 종목을 정하지
          않았지만 마음에 걸리는 게 있는 사람의 길이다.

          문구는 상품의 headline 을 그대로 쓴다. 여기서 새로 지으면 같은
          상품이 두 가지 말로 팔린다.
        */}
        <WorryPicker />

        {/*
          ── 신년운세 ── (2026-09-09 운영자)

          하반기와 한 줄에 나란히 두었던 것을 갈랐다. 둘은 같은 물음의 앞뒤라
          한 줄이 맞다고 봤는데, 실제로는 반쪽짜리 카드 둘이 되어 어느 쪽도
          제 이야기를 못 했다. 각자 제목을 갖고 서면 무엇을 파는지가 먼저 읽힌다.

          값은 적지 않는다. 홈은 products.ts 를 읽지 않기로 한 자리라(파일 첫
          주석), 값을 적으려면 그 결정을 깨야 한다. 값은 상세가 말한다.
        */}
        {/* 제목에 연도를 세운다 (2026-09-09 운영자). "신년운세" 만으로는 어느
            해 이야기인지 안 보인다 — 12월에 보는 사람과 3월에 보는 사람이 같은
            글자를 다르게 읽는다. 해 이름(정미년 · 붉은 양의 해)까지 계산해서
            적으면 그 해가 어떤 해인지가 제목에서 끝난다.

            손으로 안 적는다. year-label.ts 가 사주 엔진에서 간지를 뽑는다 —
            해가 바뀌면 홈도 저절로 바뀐다. */}
        <section className="home-sec home-year">
          <header className="home-year-head">
            <small>내년 인생 타이밍, 지금 미리 맞춰보세요!</small>
            <h2>
              <i aria-hidden>🔥</i>
              {nextYear.year} {nextYear.phrase}
            </h2>
          </header>
          <Link href="/product/sinnyeon" className="home-year-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home/sinnyeon.jpg" alt="" loading="lazy" />
            <span className="home-year-copy">
              <strong>{nextYear.ganji}년 정통사주 신년운세</strong>
              <small>다음 해 세운이 만드는 한 해의 결</small>
            </span>
          </Link>
        </section>

        {/* ── 하반기 총운 ── 신년과 같은 틀, 다른 철 */}
        <section className="home-sec home-year">
          <header className="home-year-head">
            <small>올해 마무리 잘하고 싶다면?</small>
            <h2>
              <i aria-hidden>✅</i>
              {thisYear} 하반기 운세
            </h2>
          </header>
          <Link href="/product/habangi" className="home-year-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home/habangi.jpg" alt="" loading="lazy" />
            <span className="home-year-copy">
              <strong>{thisYear} 하반기, 남은 달은 어떻게 흘러갈까?</strong>
              <small>몇 월에 밀고 몇 월에 다질지</small>
            </span>
          </Link>
        </section>

        {/* ── 푸터 ── */}
        <footer style={{ marginTop: 32, padding: "24px 20px 0", borderTop: "1px solid var(--line)" }}>
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
