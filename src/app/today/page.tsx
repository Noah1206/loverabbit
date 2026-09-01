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
//
// ── 아직 검수 중이라 관리자에게만 보인다 (2026-09-01) ──
//
// 진짜 관문은 /api/daily-action 에 있다. 여기서 하는 일은 그 관문에 키를
// 실어 보내고, 없으면 화면을 안 그리는 것뿐이다 — 화면만 가리면 라우트를
// 직접 부르는 길이 남는다.
//
// 열 때 지울 것: ADMIN_KEY 상수, adminKey 상태, 아래 "준비 중" 화면,
// fetch 의 Authorization 헤더, 그리고 라우트의 verifyAdminApprovalKey 블록.

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
  | { kind: "locked" }
  | { kind: "guest" }
  | { kind: "needsProfile" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DailyActionResponse };

/** 지금 어느 걸음에 있는가 */
type Step = "hello" | "pick" | "reveal";

const GREETED_KEY = "lr_today_greeted";

/** 다른 관리자 화면과 같은 자리 — 한쪽에서 열어두면 여기도 열린다 */
const ADMIN_KEY = "loverabbit_admin_approval_key";

function storedAdminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY) ?? "";
  } catch {
    return "";
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
  const [adminKey, setAdminKey] = useState("");
  const [account, setAccount] = useState<User | null>(null);
  const [picked, setPicked] = useState<FortuneDomain | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (token: string, key: string) => {
    setScreen({ kind: "loading" });
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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
    const key = storedAdminKey();
    setAdminKey(key);
    if (!key) {
      setScreen({ kind: "locked" });
      return;
    }
    const stored = getUser();
    setAccount(stored);
    if (!stored) {
      setScreen({ kind: "guest" });
      return;
    }
    void load(stored.token, key);
  }, [load]);

  const complete = async (domain: FortuneDomain) => {
    if (!account || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
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

  // 검수 중 — 키를 아는 사람만 들어온다.
  //
  // "준비 중"이라고만 말하고 무엇을 준비하는지는 적지 않는다. 열쇠 구멍은
  // 있지만 안에 무엇이 있는지는 밖에서 안 보이는 편이 낫다.
  if (screen.kind === "locked") {
    return (
      <main className="today">
        <div className="today-stage">
          <h1 className="today-title today-title-sm">준비 중인 기능이에요.</h1>
          <p className="today-sub">조금만 기다려 주세요.</p>
          <form
            className="today-unlock"
            onSubmit={(event) => {
              event.preventDefault();
              const key = new FormData(event.currentTarget).get("key");
              if (typeof key !== "string" || !key.trim()) return;
              try {
                sessionStorage.setItem(ADMIN_KEY, key.trim());
              } catch {
                /* 저장이 막혀도 이번 세션은 연다 */
              }
              setAdminKey(key.trim());
              const stored = getUser();
              setAccount(stored);
              if (!stored) {
                setScreen({ kind: "guest" });
                return;
              }
              void load(stored.token, key.trim());
            }}
          >
            <input
              name="key"
              type="password"
              autoComplete="off"
              placeholder="운영 키"
              aria-label="운영 키"
            />
            <button type="submit" className="btn">열기</button>
          </form>
        </div>
      </main>
    );
  }

  if (screen.kind === "guest" || screen.kind === "needsProfile" || screen.kind === "error") {
    return (
      <main className="today">
        <div className="today-stage">
          <RabbitArt art={GREETING_RABBIT_ART} alt="" />
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
                onClick={() => account && void load(account.token, adminKey)}
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
          <RabbitArt art={GREETING_RABBIT_ART} alt="" small />
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
        <RabbitArt video={shown.rabbit.video} art={shown.rabbit.art} alt="" />
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
    <div className={`today-rabbit${small ? " is-small" : ""}${showVideo ? "" : " is-bob"}`}>
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
