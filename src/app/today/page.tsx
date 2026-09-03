"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import SocialLoginButtons from "@/components/SocialLoginButtons";
import {
  DOMAIN_LABEL,
  DOMAINS,
  GREETING_RABBIT_ART,
  type DailySajuAction,
  type FortuneDomain,
} from "@/lib/daily-action";
import {
  ELEMENT_ART,
  ELEMENT_VIDEO,
  FLAGS,
  flagOf,
  flipFlag,
  type SajuProfileView,
} from "@/lib/saju-profile";
import type { Ohaeng } from "@/lib/saju";
import { getUser, type User } from "@/lib/user";

// 오늘의 사주 액션 — 토끼가 데리고 가는 세 걸음.
//
//   인사  →  고르기  →  들려주기
//
// 왜 세 걸음인가. 결과를 한 번에 펼치면 정보가 먼저 오고 사람이 나중에 온다.
// 토끼가 먼저 인사하고, 사용자가 무엇을 물을지 고르고, 그 다음에 답을 듣는
// 순서로 두면 같은 내용이 대화가 된다. 고르는 걸음이 하는 일이 하나 더
// 있다 — 답을 듣기 전에 잠깐 뜸을 들이게 해서, 뒤에 나오는 한 줄이 더
// 무겁게 읽힌다.
//
// 화면의 뼈대 (2026-09-03 개편): 밤하늘 무대가 위에 늘 떠 있고, 그 아래
// 밝은 바닥에 걸음별 내용이 온다. 토끼는 언덕 능선 위에 산다 — 걸음이
// 바뀌어도 하늘과 언덕은 그대로라, 같은 밤 같은 자리에서 이야기가 이어진다.
//
// 하루에 한 번만 인사한다. 세 번째 열 때도 손을 흔들면 그건 인사가 아니라
// 관문이다. sessionStorage 에 오늘 날짜를 남겨 그 다음부터는 결과로 바로
// 간다 — 탭을 닫으면 초기화되는 편이 "오늘 처음"의 감각에 가깝다.

interface DailyActionResponse {
  today: string;
  action: DailySajuAction;
  others: DailySajuAction[];
  completedToday: string[];
  yesterdayDomain: FortuneDomain | null;
  birthTimeUnknown: boolean;
  flow: {
    dayGanji: string;
    dayMaster: string;
    tenGod: string;
    myElement: Ohaeng;
    todayElement: Ohaeng;
  };
  /** 내 명식의 수치. 성별이 없으면 null — 십성 해석이 갈려서 추측하지 않는다. */
  me: SajuProfileView | null;
}

type Screen =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "needsProfile" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DailyActionResponse };

/** 지금 어느 걸음에 있는가 */
type Step = "hello" | "pick" | "flags" | "reveal";

const GREETED_KEY = "lr_today_greeted";

/** 오늘 뽑은 깃발 — 같은 날 다시 뽑는 화면을 주지 않으려고 남긴다 */
const FLAG_KEY = "lr_today_flag";

function hasFlaggedToday(today: string): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY)?.startsWith(`${today}:`) ?? false;
  } catch {
    return false;
  }
}

function rememberFlag(today: string, ohaeng: string): void {
  try {
    sessionStorage.setItem(FLAG_KEY, `${today}:${ohaeng}`);
  } catch {
    /* 기억 못 해도 흐름은 간다 */
  }
}

function alreadyGreetedToday(today: string): boolean {
  try {
    return sessionStorage.getItem(GREETED_KEY) === today;
  } catch {
    // 저장이 막힌 브라우저에서는 매번 인사한다. 인사가 한 번 더 나오는 것은
    // 사고가 아니다 — 여기서 막으면 화면 자체가 안 뜬다.
    return false;
  }
}

function rememberGreeted(today: string): void {
  try {
    sessionStorage.setItem(GREETED_KEY, today);
  } catch {
    /* 기억 못 해도 흐름은 그대로 간다 */
  }
}

/** "9/3 목" — 밤하늘 왼쪽 위의 오늘. 서버가 준 날짜가 있으면 그 날을 쓴다. */
function dateLabel(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00+09:00`) : new Date();
  return `${d.getMonth() + 1}/${d.getDate()} ${"일월화수목금토"[d.getDay()]}`;
}

export default function TodayPage() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [step, setStep] = useState<Step>("hello");
  const [account, setAccount] = useState<User | null>(null);
  const [picked, setPicked] = useState<FortuneDomain | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /** 깃발을 뽑고 답이 열리기까지의 뜸. 바로 열면 뽑은 손이 무의미해진다 */
  const [flipping, setFlipping] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (token: string) => {
    setScreen({ kind: "loading" });
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setScreen({ kind: "error", message: body?.error ?? "오늘의 액션을 못 불러왔어. 다시 해보자." });
        return;
      }
      if (body?.needsProfile) {
        setScreen({ kind: "needsProfile" });
        return;
      }
      const data = body as DailyActionResponse;
      setScreen({ kind: "ready", data });
      // 오늘 이미 인사를 봤으면 결과로 바로 간다.
      setStep(alreadyGreetedToday(data.today) ? "reveal" : "hello");
    } catch {
      setScreen({ kind: "error", message: "연결이 불안정해. 다시 해보자." });
    }
  }, []);

  useEffect(() => {
    const stored = getUser();
    setAccount(stored);
    if (!stored) {
      setScreen({ kind: "guest" });
      return;
    }
    void load(stored.token);
  }, [load]);

  const complete = async (domain: FortuneDomain, text?: string) => {
    if (!account || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: account.token, intent: "complete", domain }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // 저장 실패는 조용히 넘기지 않는다 — 눌렀는데 아무 일도 안 일어난
        // 것처럼 보이면 사용자는 같은 자리를 계속 누른다.
        setSaveError(body?.error ?? "저장이 안 됐어. 다시 눌러줘.");
        return;
      }
      setScreen((prev) =>
        prev.kind === "ready"
          ? { ...prev, data: { ...prev.data, completedToday: [...prev.data.completedToday, domain] } }
          : prev
      );
      // 저장이 끝나면 오늘 몫을 클립보드에 담아 둔다. 복사가 막힌 브라우저에서도
      // 저장 자체는 이미 끝났으니 흐름을 막지 않는다.
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2400);
        } catch {
          /* 클립보드가 막혀도 저장은 됐다 */
        }
      }
    } catch {
      setSaveError("연결이 불안정해. 다시 눌러줘.");
    } finally {
      setSaving(false);
    }
  };

  // ── 걸음 밖의 화면들 ──────────────────────────────────────

  if (screen.kind === "loading") {
    return (
      <main className="today">
        <Sky date={dateLabel()}>
          <p className="today-sky-sub">오늘의 흐름을 읽는 중이야…</p>
        </Sky>
      </main>
    );
  }

  if (screen.kind === "guest" || screen.kind === "needsProfile" || screen.kind === "error") {
    return (
      <main className="today">
        <Sky date={dateLabel()}>
          {screen.kind === "guest" && (
            <h1 className="today-sky-title">
              안녕!
              <br />
              오늘 뭐 하면 좋을지
              <br />
              같이 볼까?
            </h1>
          )}
          {screen.kind === "needsProfile" && (
            <h1 className="today-sky-title">
              아직 네 사주를
              <br />
              몰라.
            </h1>
          )}
          {screen.kind === "error" && <h1 className="today-sky-title">잠깐, 뭔가 어긋났어.</h1>}
        </Sky>
        <div className="today-content">
          {screen.kind === "guest" && (
            <>
              <p className="today-sub">
                오늘의 일진과 네 사주를 맞대어 봐야 해서, 먼저 로그인이 필요해.
              </p>
              <div className="today-gate">
                <SocialLoginButtons nextPath="/today" />
              </div>
            </>
          )}
          {screen.kind === "needsProfile" && (
            <>
              <p className="today-sub">
                생년월일만 알려주면 매일 오늘의 흐름을 읽어줄게. 한 번만 입력하면 돼.
              </p>
              <Link href="/reading" className="btn today-cta">
                사주 정보 입력하기
              </Link>
            </>
          )}
          {screen.kind === "error" && (
            <>
              <p className="today-sub">{screen.message}</p>
              <button
                type="button"
                className="btn today-cta"
                onClick={() => account && void load(account.token)}
              >
                다시 시도
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  const { data } = screen;
  const shown = picked
    ? [data.action, ...data.others].find((a) => a.domain === picked) ?? data.action
    : data.action;

  // ── 첫 걸음: 인사 ────────────────────────────────────────

  if (step === "hello") {
    return (
      <main className="today">
        <Sky date={dateLabel(data.today)}>
          <p className="today-sky-eyebrow">오늘의 사주 액션</p>
          <h1 className="today-sky-title">
            안녕!
            <br />
            오늘도 왔구나.
          </h1>
          <p className="today-sky-sub">
            {data.yesterdayDomain
              ? `어제는 ${DOMAIN_LABEL[data.yesterdayDomain]} 액션을 해냈지. 오늘은 어떤 걸 볼까?`
              : "오늘의 흐름을 가장 잘 쓰는 방법, 하나만 알려줄게."}
          </p>
          <button
            type="button"
            className="today-sky-more"
            onClick={() => {
              rememberGreeted(data.today);
              setStep("pick");
            }}
          >
            자세히 보기 <span aria-hidden>→</span>
          </button>
        </Sky>
      </main>
    );
  }

  // ── 둘째 걸음: 고르기 ────────────────────────────────────

  if (step === "pick") {
    return (
      <main className="today">
        <Sky date={dateLabel(data.today)}>
          <h1 className="today-sky-title">어떤 게 궁금해?</h1>
          <p className="today-sky-sub">하나만 골라줘. 오늘의 흐름으로 읽어줄게.</p>
        </Sky>

        <div className="today-content">
          <div className="today-domains">
            {DOMAINS.map((domain) => (
              <button
                key={domain}
                type="button"
                className="today-domain"
                onClick={() => {
                  setPicked(domain);
                  setStep(hasFlaggedToday(data.today) ? "reveal" : "flags");
                }}
              >
                <span>{DOMAIN_LABEL[domain]}</span>
                {data.completedToday.includes(domain) && <span className="today-domain-done">완료</span>}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="today-skip"
            onClick={() => {
              setPicked(null);
              setStep(hasFlaggedToday(data.today) ? "reveal" : "flags");
            }}
          >
            오늘 흐름에 맞는 걸로 골라줘
          </button>
        </div>
      </main>
    );
  }

  // ── 셋째 걸음: 깃발 뽑기 ─────────────────────────────────
  //
  // 운세를 고른 뒤, 답을 듣기 전에 손을 한 번 쓰게 한다. 어느 깃발을
  // 골라도 답은 오늘의 일진이 정해 둔 하나지만, 고르는 행위가 뒤에 오는
  // 선언을 "내가 뽑은 것"으로 만든다.

  if (step === "flags") {
    return (
      <main className="today">
        <Sky date={dateLabel(data.today)}>
          <h1 className="today-sky-title">깃발을 하나 뽑아봐</h1>
          <p className="today-sky-sub" aria-live="polite">
            {flipping ? "뽑은 깃발을 읽는 중이야…" : "오늘의 기운이 네게 어느 자리인지 알려줄게."}
          </p>
        </Sky>
        <div className="today-content">
          <div className={`today-flag-row is-step${flipping ? " is-flipping" : ""}`}>
            {FLAGS.map((flag, i) => (
              <button
                key={flag.ohaeng}
                type="button"
                className="today-flag"
                style={{ ["--i" as string]: i }}
                onClick={() => {
                  if (flipping) return;
                  rememberFlag(data.today, flag.ohaeng);
                  // 뽑자마자 답을 주지 않는다. 잠깐 멈췄다 열려야 뽑은 것이 된다.
                  setFlipping(true);
                  setTimeout(() => {
                    setStep("reveal");
                    setFlipping(false);
                  }, 1400);
                }}
                aria-label={`${flag.color}색 깃발`}
              >
                <AlphaMotion video={flag.video} art={flag.art} alt="" width={200} height={200} />
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── 넷째 걸음: 결과 ──────────────────────────────────────
  //
  // 위계는 하나다: 전제(너의 결·오늘의 기운) → 선언(오늘 할 것) → 상세.
  // 선언이 밤하늘의 큰 글이 된다 — 스크린샷의 "당신의 능력을…" 자리다.

  const done = data.completedToday.includes(shown.domain);
  const flagResult = flipFlag(data.flow.myElement, data.flow.todayElement);
  const wonFlag = flagOf(flagResult.todayElement);

  /** 저장하기를 누르면 클립보드에 담기는 오늘 몫 */
  const shareText = [
    `[${DOMAIN_LABEL[shown.domain]}] 일간 ${data.flow.dayMaster} · 오늘 ${data.flow.dayGanji}일`,
    flagResult.premise,
    shown.action,
    shown.durationMinutes ? `약 ${shown.durationMinutes}분이면 돼` : "",
    "",
    `왜 이 행동인가 — ${shown.reason}`,
    `오늘 피할 행동 — ${shown.avoidAction}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="today">
      <Sky
        date={dateLabel(data.today)}
        rabbitArt={shown.rabbit.art}
        rabbitVideo={shown.rabbit.video}
      >
        <p className="today-sky-premise">
          <span className={`today-hero-flag ${wonFlag.className}`}>
            <AlphaMotion video={wonFlag.video} art={wonFlag.art} alt="" width={80} height={80} />
          </span>
          {flagResult.premise}
        </p>
        <h1 className="today-sky-title is-action">{shown.action}</h1>
        {shown.durationMinutes && (
          <p className="today-sky-sub">약 {shown.durationMinutes}분이면 돼</p>
        )}
      </Sky>

      <div className="today-content">
        <section className="card today-card today-feature">
          <p className="today-feature-eyebrow">
            {DOMAIN_LABEL[shown.domain]} · 일간 {data.flow.dayMaster} · 오늘 {data.flow.dayGanji}일
          </p>

          <p className="today-label">왜 이 행동인가</p>
          <p className="today-body">{shown.reason}</p>

          <p className="today-label">오늘 피할 행동</p>
          <p className="today-body">{shown.avoidAction}</p>

          {shown.disclaimer && <p className="today-fine">{shown.disclaimer}</p>}

          <div className="today-do">
            {done ? (
              <p className="today-done">
                오늘 몫은 했다. 잘했어.
                {copied && <span className="today-copied">복사됐어</span>}
              </p>
            ) : (
              <button
                type="button"
                className="btn today-cta"
                disabled={saving}
                onClick={() => complete(shown.domain, shareText)}
              >
                {saving ? "저장하는 중…" : "저장하기"}
              </button>
            )}
            {saveError && <p className="today-error">{saveError}</p>}
          </div>
        </section>

        {data.me && <MyChart me={data.me} />}

        <p className="today-fine today-footnote">
          어느 깃발을 골라도 답은 하나야. 예언이 아니라 참고 가이드다.
          {data.birthTimeUnknown && " 태어난 시각은 몰라도 결과는 안 달라져."}
        </p>

        <button type="button" className="today-skip" onClick={() => setStep("pick")}>
          다른 운세 보기
        </button>
      </div>
    </main>
  );
}

/**
 * 밤하늘 무대 — 모든 걸음이 이 위에서 논다.
 *
 * 스크린샷(포스텔러 투데이)의 뼈대를 옮겼다: 왼쪽 위 날짜, 큰 흰 글,
 * 아래로 가을 언덕과 달, 능선 위의 토끼, 그리고 밝은 바닥으로 넘어가는
 * 흰 곡선. 하늘·언덕·달은 인라인 SVG 하나다 — 그림 파일이 없어도 되고,
 * 테마가 바뀌어도 밤은 밤이다. 바닥 곡선만 var(--bg) 를 물려받아
 * 라이트·다크 어느 쪽에서도 콘텐츠 면과 이어진다.
 */
function Sky({
  date,
  children,
  rabbitArt = GREETING_RABBIT_ART,
  rabbitVideo,
}: {
  date: string;
  children: ReactNode;
  rabbitArt?: string;
  rabbitVideo?: string;
}) {
  return (
    <section className="today-sky">
      <p className="today-sky-date">{date}</p>
      <div className="today-sky-text">{children}</div>
      <div className="today-scene" aria-hidden>
        <SceneArt />
        <div className="today-scene-rabbit">
          <RabbitArt video={rabbitVideo} art={rabbitArt} alt="" />
        </div>
      </div>
    </section>
  );
}

/** 가을 언덕과 달 — 코드로 그린 밤 풍경. 아래 흰 면이 콘텐츠 바닥과 이어진다. */
function SceneArt() {
  return (
    <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMax slice">
      {/* 별 — 크기 둘, 흩뿌림 */}
      <g fill="#e8dcae" opacity="0.85">
        <circle cx="42" cy="18" r="1.6" />
        <circle cx="118" cy="44" r="1.2" />
        <circle cx="205" cy="12" r="1.4" />
        <circle cx="286" cy="38" r="1.1" />
        <circle cx="356" cy="10" r="1.5" />
        <circle cx="428" cy="30" r="1.2" />
        <circle cx="70" cy="66" r="1" />
        <circle cx="392" cy="60" r="1" />
        <circle cx="160" cy="76" r="1.2" />
        <circle cx="250" cy="58" r="0.9" />
      </g>
      {/* 달 */}
      <circle cx="172" cy="86" r="22" fill="#ded4a2" opacity="0.95" />
      {/* 뒷산 */}
      <path
        d="M0 158 Q60 108 128 140 Q180 96 248 138 Q318 100 380 142 Q430 118 480 146 V240 H0 Z"
        fill="#6d4a39"
      />
      {/* 앞 수풀 — 둥근 덤불 띠 */}
      <path
        d="M0 190 Q30 168 62 184 Q92 162 128 182 Q160 164 196 184 Q232 166 268 186 Q302 168 338 186 Q372 170 408 188 Q442 174 480 188 V240 H0 Z"
        fill="#54382f"
      />
      {/* 풀밭의 잔별 */}
      <g fill="#c9a24d" opacity="0.6">
        <circle cx="60" cy="206" r="1.4" />
        <circle cx="150" cy="214" r="1.2" />
        <circle cx="240" cy="206" r="1.4" />
        <circle cx="330" cy="216" r="1.2" />
        <circle cx="420" cy="208" r="1.4" />
      </g>
      {/* 콘텐츠 면으로 넘어가는 흰 능선 */}
      <path d="M0 236 Q240 200 480 232 V240 H0 Z" fill="var(--bg)" />
    </svg>
  );
}

/**
 * 내 사주를 수치로.
 *
 * 오늘의 흐름과 성격이 다르다 — 저건 날마다 바뀌고 이건 안 바뀐다. 그래서
 * 접어 두고, 궁금한 사람만 편다. 첫 화면은 오늘 할 행동 하나여야 한다.
 *
 * 여기 나오는 숫자는 전부 명리 엔진이 이미 낸 값이다. 화면에서 새로 만들지
 * 않는다 — 산식 없는 숫자는 그럴듯할수록 위험하다.
 */
function MyChart({ me }: { me: SajuProfileView }) {
  return (
    <section className="card today-me">
      <div className="today-me-head">
        <p className="today-label today-label-first">내 사주</p>
        <p className="today-basis-label">일간 {me.dayMaster}</p>
      </div>

      {/* 오행 — 상징 다섯이 줄지어 선다. 개수가 크기와 숫자로 같이 읽히고,
          0 인 오행은 흐려져 "자리는 있는데 비었다"가 보인다. 고리 그래프는
          걷었다 — 구조 설명이 앞서서 정작 내 값이 안 읽혔다. */}
      <p className="today-label">오행의 균형</p>
      <div className="today-element-row">
        {me.elements.map((e) => (
          <div
            key={e.ohaeng}
            className={`today-element ${e.className}${e.count === 0 ? " is-zero" : ""}${
              e.tilt === "많음" ? " is-major" : ""
            }`}
          >
            <span className="today-element-art">
              <AlphaMotion
                video={ELEMENT_VIDEO[e.ohaeng]}
                art={ELEMENT_ART[e.ohaeng]}
                alt=""
                width={120}
                height={120}
              />
            </span>
            <span className="today-element-name">
              {e.ohaeng} <small>{e.trait}</small>
            </span>
            {/* 맨숫자 "3" 은 여덟 글자 중 셋이라는 뜻이 안 실린다.
                점 하나가 글자 하나 — 세는 단위가 눈에 보이고,
                상태 말이 그 양의 뜻을 준다. */}
            <span className="today-element-count">
              {e.count > 0 && (
                <span className="today-element-dots" aria-hidden>
                  {Array.from({ length: e.count }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              )}
              <span className="today-element-tilt">{e.tilt}</span>
            </span>
          </div>
        ))}
      </div>
      {/* 강약 — 0~100 한 줄 */}
      <p className="today-label">강약</p>
      <div className="today-strength">
        <div className="today-strength-track">
          <i style={{ left: `${me.strength.score}%` }} />
        </div>
        <div className="today-strength-scale">
          <span>신약</span>
          <span>중화</span>
          <span>신강</span>
        </div>
        <p className="today-strength-val">
          {me.strength.label} <b>{me.strength.score}</b>
        </p>
      </div>
      <p className="today-body">{me.strength.meaning}</p>

      {/* 십성 — 자리마다의 십성을 센 것 */}
      <p className="today-label">십성 분포</p>
      <div className="today-me-bars">
        {me.tenGods.map((t) => (
          <div key={t.tenGod} className="today-bar is-tengod">
            <span className="today-bar-name is-wide">{t.tenGod}</span>
            <span className="today-bar-track">
              <i
                style={{
                  width: `${Math.max(t.ratio, 4)}%`,
                  ["--w" as string]: `${Math.min(45 + t.ratio * 1.4, 95)}%`,
                }}
              />
            </span>
            <span className="today-bar-val">{t.count}</span>
          </div>
        ))}
      </div>

      {/* 행동강령 — 위 수치에서 나온 것. 어디서 나왔는지 같이 적는다. */}
      <p className="today-label">나의 행동강령</p>
      <ol className="today-rules">
        {me.guidelines.map((g) => (
          <li key={g.title}>
            <p className="today-rule-title">{g.title}</p>
            <p className="today-rule-body">{g.body}</p>
            <span className="today-rule-basis">{g.basis}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}


/**
 * 투명 배경 영상 한 점 — 그림 위에 영상을 덮는다.
 *
 * 토끼(RabbitArt)와 같은 원리다: 영상이 오면 그림이 가려지고, VP9 알파를
 * 못 트는 브라우저·자동재생이 막힌 환경에서는 그림이 그대로 남는다.
 * 깃발과 오행 엠블럼이 쓴다.
 */
function AlphaMotion({
  video,
  art,
  alt,
  width,
  height,
}: {
  video: string;
  art: string;
  alt: string;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`alpha-motion${failed ? "" : " has-video"}`}>
      <Image src={art} alt={alt} width={width} height={height} />
      {!failed && (
        <video
          src={video}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/**
 * 토끼 한 마리.
 *
 * 배경이 투명한 webm 을 페이지 위에 그대로 얹는다 — 카드도 액자도 없이
 * 토끼만 떠 있어야 화면 안에 사는 것처럼 보인다.
 *
 * 영상이 못 오는 경우가 실제로 있다. VP9 알파는 사파리 계열에서 재생이
 * 막히고, 데이터 절약 모드에서는 자동재생 자체가 꺼진다. 그래서 같은 자리에
 * 정지 그림을 깔아 두고 영상을 그 위에 덮는다 — 영상이 나오면 그림은 안
 * 보이고, 안 나오면 그림이 그대로 남는다. 어느 쪽이든 빈 자리는 없다.
 *
 * poster 를 쓰지 않는 이유: poster 는 영상이 재생 가능할 때만 그려지므로,
 * 코덱이 아예 안 되는 브라우저에서는 아무것도 안 남는다.
 *
 * **정지 그림도 배경이 투명해야 한다.** 처음에 영상만 투명하게 만들고
 * 그림은 연보라 배경 그대로 뒀더니, 영상이 안 나오는 자리마다 네모난
 * 판이 화면에 떠 있었다. 지금은 배경을 지운 영상의 첫 프레임에서 그림을
 * 뽑으므로 자세도 배경도 어긋나지 않는다.
 */
function RabbitArt({
  video,
  art,
  alt,
}: {
  /** 없으면 정지 그림만 (bob 으로 대신 움직인다) */
  video?: string;
  art: string;
  alt: string;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = Boolean(video) && !videoFailed;

  // 정지 그림일 때 둥둥 띄우지 않는다 (2026-09-03 운영자) — 언덕 위에 서
  // 있는 캐릭터가 떠다니면 땅이 거짓말이 된다.
  return (
    <div className={`today-rabbit${showVideo ? " has-video" : ""}`}>
      <Image
        src={art}
        alt={alt}
        width={512}
        height={512}
        priority
        sizes="(max-width: 480px) 46vw, 210px"
      />
      {showVideo && (
        <video
          src={video}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          onError={() => setVideoFailed(true)}
        />
      )}
    </div>
  );
}
