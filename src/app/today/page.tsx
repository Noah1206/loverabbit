"use client";

import { useCallback, useEffect, useState } from "react";
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
  flow: { dayGanji: string; dayMaster: string; tenGod: string };
}

type Screen =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "needsProfile" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DailyActionResponse };

/** 지금 어느 걸음에 있는가 */
type Step = "hello" | "pick" | "reveal";

const GREETED_KEY = "lr_today_greeted";

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
          <RabbitArt src={GREETING_RABBIT_ART} alt="" />
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
          <RabbitArt src={GREETING_RABBIT_ART} alt="" bob />
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
          <RabbitArt src={GREETING_RABBIT_ART} alt="" small />
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
                setStep("reveal");
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
            setStep("reveal");
          }}
        >
          오늘 흐름에 맞는 걸로 골라줘
        </button>
      </main>
    );
  }

  // ── 셋째 걸음: 들려주기 ──────────────────────────────────

  const done = data.completedToday.includes(shown.domain);

  return (
    <main className="today">
      {/* 토끼가 오늘의 흐름에 맞는 얼굴로 나와 한마디 건넨다 */}
      <div className="today-stage">
        <RabbitArt src={shown.rabbit.art} alt="" bob />
        <p className="today-speech">{shown.rabbit.line}</p>
      </div>

      <section className="card today-card">
        <span className="badge">{DOMAIN_LABEL[shown.domain]}</span>

        <p className="today-action">{shown.action}</p>

        {shown.durationMinutes && <p className="today-minutes">약 {shown.durationMinutes}분</p>}

        <p className="today-label">왜 이 행동인가</p>
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

      <section className="card today-basis">
        <p className="today-label today-label-first">오늘의 사주 근거</p>
        <p className="today-basis-label">{shown.sajuBasis.label}</p>
        <p className="today-body">{shown.sajuBasis.description}</p>
        {data.birthTimeUnknown && (
          <p className="today-fine">
            태어난 시각을 모르는 것으로 두고 계산했어요. 오늘의 흐름은 태어난 날로 정해지니 결과는 달라지지 않아요.
          </p>
        )}
        <p className="today-fine">
          이 결과는 미래를 확정하는 예언이 아니라, 오늘을 돌아보는 사주 기반 참고 가이드입니다.
        </p>
      </section>

      <button type="button" className="today-skip" onClick={() => setStep("pick")}>
        다른 운세 보기
      </button>
    </main>
  );
}

/**
 * 토끼 그림 한 장.
 *
 * bob 은 위아래로 아주 조금 뜨는 움직임이다 — 살아 있다는 느낌만 주고 시선을
 * 뺏지는 않는다. prefers-reduced-motion 에서는 CSS 가 멈춘다.
 */
function RabbitArt({
  src,
  alt,
  bob = false,
  small = false,
}: {
  src: string;
  alt: string;
  bob?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`today-rabbit${bob ? " is-bob" : ""}${small ? " is-small" : ""}`}>
      <Image
        src={src}
        alt={alt}
        width={512}
        height={512}
        priority
        sizes="(max-width: 480px) 60vw, 280px"
      />
    </div>
  );
}
