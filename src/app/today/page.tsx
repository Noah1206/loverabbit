"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import SocialLoginButtons from "@/components/SocialLoginButtons";
import {
  DOMAIN_LABEL,
  DOMAINS,
  GREETING_RABBIT_ART,
  GREETING_RABBIT_VIDEO,
  type DailySajuAction,
  type FortuneDomain,
} from "@/lib/daily-action";
import {
  ELEMENT_ART,
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

export default function TodayPage() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [step, setStep] = useState<Step>("hello");
  const [account, setAccount] = useState<User | null>(null);
  const [picked, setPicked] = useState<FortuneDomain | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
        setScreen({ kind: "error", message: body?.error ?? "오늘의 액션을 불러오지 못했어요." });
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
      setScreen({ kind: "error", message: "연결이 불안정해요. 다시 시도해주세요." });
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

  const complete = async (domain: FortuneDomain) => {
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
        setSaveError(body?.error ?? "완료를 저장하지 못했어요. 다시 눌러주세요.");
        return;
      }
      setScreen((prev) =>
        prev.kind === "ready"
          ? { ...prev, data: { ...prev.data, completedToday: [...prev.data.completedToday, domain] } }
          : prev
      );
    } catch {
      setSaveError("연결이 불안정해요. 다시 눌러주세요.");
    } finally {
      setSaving(false);
    }
  };

  // ── 걸음 밖의 화면들 ──────────────────────────────────────

  if (screen.kind === "loading") {
    return (
      <main className="today">
        <p className="today-waiting">오늘의 흐름을 읽고 있어요…</p>
      </main>
    );
  }

  if (screen.kind === "guest" || screen.kind === "needsProfile" || screen.kind === "error") {
    return (
      <main className="today">
        <div className="today-stage">
          <RabbitArt video={GREETING_RABBIT_VIDEO} art={GREETING_RABBIT_ART} alt="" />
          {screen.kind === "guest" && (
            <>
              <h1 className="today-title">안녕! 오늘 뭐 하면 좋을지 같이 볼까?</h1>
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
              <h1 className="today-title">아직 네 사주를 몰라.</h1>
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
              <h1 className="today-title">잠깐, 뭔가 어긋났어.</h1>
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
        <div className="today-stage">
          <RabbitArt video={GREETING_RABBIT_VIDEO} art={GREETING_RABBIT_ART} alt="" />
          <p className="today-eyebrow">오늘의 사주 액션</p>
          <h1 className="today-title">안녕! 오늘도 왔구나.</h1>
          <p className="today-sub">
            {data.yesterdayDomain
              ? `어제는 ${DOMAIN_LABEL[data.yesterdayDomain]} 액션을 해냈지. 오늘은 어떤 걸 볼까?`
              : "오늘의 흐름을 가장 잘 쓰는 방법, 하나만 알려줄게."}
          </p>
          <button
            type="button"
            className="btn today-cta"
            onClick={() => {
              rememberGreeted(data.today);
              setStep("pick");
            }}
          >
            오늘의 사주 보기
          </button>
        </div>
      </main>
    );
  }

  // ── 둘째 걸음: 고르기 ────────────────────────────────────

  if (step === "pick") {
    return (
      <main className="today">
        <div className="today-stage">
          <RabbitArt video={GREETING_RABBIT_VIDEO} art={GREETING_RABBIT_ART} alt="" small />
          <h1 className="today-title today-title-sm">어떤 게 궁금해?</h1>
          <p className="today-sub">하나만 골라줘. 오늘의 흐름으로 읽어줄게.</p>
        </div>

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
        <div className="today-stage">
          <RabbitArt video={GREETING_RABBIT_VIDEO} art={GREETING_RABBIT_ART} alt="" small />
          <h1 className="today-title today-title-sm">깃발을 하나 뽑아봐</h1>
          <p className="today-sub">오늘의 기운이 네게 어느 자리인지 알려줄게.</p>
        </div>
        <div className="today-flag-row is-step">
          {FLAGS.map((flag, i) => (
            <button
              key={flag.ohaeng}
              type="button"
              className="today-flag"
              style={{ ["--i" as string]: i }}
              onClick={() => {
                rememberFlag(data.today, flag.ohaeng);
                setStep("reveal");
              }}
              aria-label={`${flag.color}색 깃발`}
            >
              <Image src={flag.art} alt="" width={200} height={200} />
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ── 넷째 걸음: 결과 ──────────────────────────────────────
  //
  // 위계는 하나다: 전제(너의 결·오늘의 기운) → 선언(오늘 할 것) → 상세.
  // 굵은 글자는 선언 하나에만 준다 — 전부 굵으면 아무것도 안 굵다.

  const done = data.completedToday.includes(shown.domain);
  const flagResult = flipFlag(data.flow.myElement, data.flow.todayElement);
  const wonFlag = flagOf(flagResult.todayElement);

  return (
    <main className="today">
      <div className="today-stage is-compact">
        <RabbitArt video={shown.rabbit.video} art={shown.rabbit.art} alt="" small />
      </div>

      {/* 전제 → 선언. "너가 이러니까(칩) → 오늘은 이런 날이니(전제) →
          이걸 해(선언)" 이 한 호흡이 화면의 축이다. */}
      <header className="today-hero">
        <div className="today-chips">
          <span className="today-chip is-domain">{DOMAIN_LABEL[shown.domain]}</span>
          <span className="today-chip">일간 {data.flow.dayMaster}</span>
          <span className="today-chip">오늘 {data.flow.dayGanji}일</span>
        </div>
        <p className="today-hero-premise">
          <span className={`today-hero-flag ${wonFlag.className}`}>
            <Image src={wonFlag.art} alt="" width={80} height={80} />
          </span>
          {flagResult.title.replace("입니다", "")} — {shown.rabbit.line}
        </p>
        <h1 className="today-hero-action">{shown.action}</h1>
        {shown.durationMinutes && (
          <p className="today-minutes">약 {shown.durationMinutes}분이면 돼요</p>
        )}

        {/* 내 수치 한 줄 — 자세한 것은 아래 "수치로 보기"가 연다 */}
        {data.me && (
          <div className="today-stats">
            {data.me.elements.map((e) => (
              <span
                key={e.ohaeng}
                className={`today-stat ${e.className}${e.count === 0 ? " is-zero" : ""}`}
              >
                <Image src={ELEMENT_ART[e.ohaeng]} alt={e.ohaeng} width={44} height={44} />
                <span className="today-stat-dots" aria-label={`${e.ohaeng} ${e.count}`}>
                  {Array.from({ length: e.count }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              </span>
            ))}
            <span className="today-stat-str">
              {data.me.strength.label} <b>{data.me.strength.score}</b>
            </span>
          </div>
        )}
      </header>

      <section className="card today-card">
        <p className="today-label today-label-first">왜 이 행동인가</p>
        <p className="today-body">{shown.reason}</p>

        <p className="today-label">오늘 피할 행동</p>
        <p className="today-body">{shown.avoidAction}</p>

        {shown.disclaimer && <p className="today-fine">{shown.disclaimer}</p>}

        <div className="today-do">
          {done ? (
            <p className="today-done">오늘의 흐름을 잘 사용했어요.</p>
          ) : (
            <button
              type="button"
              className="btn today-cta"
              disabled={saving}
              onClick={() => complete(shown.domain)}
            >
              {saving ? "저장하는 중…" : "지금 실행하기"}
            </button>
          )}
          {saveError && <p className="today-error">{saveError}</p>}
        </div>
      </section>

      <p className="today-fine today-footnote">
        오늘의 일진 {data.flow.dayGanji} · {flagResult.relation}의 자리 — 어느 깃발을
        골라도 오늘의 답은 하나예요.
        {data.birthTimeUnknown && " 태어난 시각은 몰라도 오늘의 흐름은 달라지지 않아요."}
        {" "}예언이 아니라 오늘을 돌아보는 참고 가이드입니다.
      </p>

      {data.me && <MyChart me={data.me} />}

      <button type="button" className="today-skip" onClick={() => setStep("pick")}>
        다른 운세 보기
      </button>
    </main>
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
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="today-skip" onClick={() => setOpen(true)}>
        내 사주 수치로 보기
      </button>
    );
  }

  return (
    <section className="card today-me">
      <div className="today-me-head">
        <p className="today-label today-label-first">내 사주</p>
        <button type="button" className="today-me-close" onClick={() => setOpen(false)}>
          접기
        </button>
      </div>
      <p className="today-basis-label">일간 {me.dayMaster}</p>

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
              <Image src={ELEMENT_ART[e.ohaeng]} alt="" width={120} height={120} />
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
  small = false,
}: {
  /** 없으면 정지 그림만 (bob 으로 대신 움직인다) */
  video?: string;
  art: string;
  alt: string;
  small?: boolean;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = Boolean(video) && !videoFailed;

  return (
    <div
      className={`today-rabbit${small ? " is-small" : ""}${
        showVideo ? " has-video" : " is-bob"
      }`}
    >
      <Image
        src={art}
        alt={alt}
        width={512}
        height={512}
        priority
        sizes="(max-width: 480px) 62vw, 280px"
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
