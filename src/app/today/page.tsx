"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import RabbitLoader from "@/components/RabbitLoader";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import {
  buildFlagAction,
  DOMAIN_LABEL,
  DOMAINS,
  GREETING_RABBIT_ART,
  RELATION_FLOW,
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
import { PRODUCTS } from "@/lib/products";
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
  /** 프로필 별명. 없으면 null — 화면은 "안녕"으로 부른다. */
  name: string | null;
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

/** 오늘 뽑은 오방기의 오행. 안 뽑았거나 저장이 막혔으면 null. */
function flaggedOhaeng(today: string): Ohaeng | null {
  try {
    const v = sessionStorage.getItem(FLAG_KEY);
    if (!v?.startsWith(`${today}:`)) return null;
    const o = v.slice(today.length + 1);
    return (["목", "화", "토", "금", "수"] as Ohaeng[]).includes(o as Ohaeng) ? (o as Ohaeng) : null;
  } catch {
    return null;
  }
}

/** 오방기 손잡이 든 토끼 — 첫 화면 전용 */
const OBANG_RABBIT_ART = "/assets/today/rabbit-obanggi.webp";

/** 뽑은 깃발의 오행이 내 일간에게 무엇인가 — 전제 한 줄.
    관계는 saju-profile 의 상생상극 산식이 정하고, 여기는 말만 입힌다. */
const PICKED_PREMISE: Record<keyof typeof RELATION_FLOW, string> = {
  생받음: "너를 채워주는 기운이야. 인성의 자리.",
  생해줌: "네 기운을 밖으로 꺼내는 깃발이야. 식상의 자리.",
  "내가 이김": "네가 다룰 수 있는 기운이야. 재성의 자리.",
  "나를 누름": "너를 단단히 붙드는 기운이야. 관성의 자리.",
  "같은 편": "너와 같은 결의 기운이야. 비겁의 자리.",
};

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

/**
 * 뽑는 소리 — 나무가 딱 걸리고, 천이 스르륵 풀린다.
 *
 * 파일 없이 WebAudio 로 합성한다. 클릭 안에서 부르므로 자동재생 정책에
 * 걸리지 않고, 소리가 막힌 환경에서는 조용히 지나간다.
 */
function playDrawSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    // 딱 — 짧은 타격음
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
    // 스르륵 — 대역 거른 잡음이 부풀었다 잦아든다 (천 펼쳐지는 소리)
    const len = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1500;
    f.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t + 0.4);
    ng.gain.exponentialRampToValueAtTime(0.16, t + 0.6);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    n.connect(f).connect(ng).connect(ctx.destination);
    n.start(t + 0.4);
  } catch {
    /* 소리가 막혀도 뽑기는 간다 */
  }
}

/**
 * 이름을 부르는 호격 — "현웅아", "수야". 마지막 글자에 받침이 있으면 "아",
 * 없으면 "야". 한글이 아닌 이름(영문 등)은 조사 없이 이름만 부른다.
 */
function vocative(name: string): string {
  const last = name.charCodeAt(name.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return name;
  return name + ((last - 0xac00) % 28 === 0 ? "야" : "아");
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
  /** 방금 손이 닿은 깃발 — 색이 열리는 연출에만 쓴다. 정본은 sessionStorage. */
  const [drawn, setDrawn] = useState<Ohaeng | null>(null);
  /** 깃대 자리 — 자리가 색을 누설하지 않게 섞어 세운다. 다시 뽑을 때도 섞는다. */
  const [shuffled, setShuffled] = useState(() => [...FLAGS].sort(() => Math.random() - 0.5));
  /** 들어가는 중 — 데이터가 빨리 와도 끄덕이는 토끼를 잠깐은 보여준다.
      문이 벌컥 열리는 것보다 한 박자 있다 열리는 쪽이 들어가는 기분이 든다. */
  const [entering, setEntering] = useState(true);
  /** AI 가 내 명식으로 다시 쓴 문구. key 는 "오행:영역" — 조합이 바뀌면 다시 받는다.
      null 이면(생성 실패·키 없음) 표 문구가 그대로 나간다. */
  const [ai, setAi] = useState<{ key: string; text: { action: string; reason: string; avoidAction: string; rabbitLine: string } | null; needCredits?: boolean } | null>(null);

  /** 개인화 요청 — 같은 조합은 다시 부르지 않는다. 뽑기 연출 2.6초 사이에
      미리 불러 두면 결과가 열릴 때쯤 도착해 있다. */
  const aiKeyRef = useRef<string | null>(null);
  const requestAi = useCallback(
    (token: string, ohaeng: Ohaeng | null, domain: FortuneDomain) => {
      const key = `${ohaeng ?? "일진"}:${domain}`;
      if (aiKeyRef.current === key) return;
      aiKeyRef.current = key;
      fetch("/api/daily-action/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: token, ohaeng: ohaeng ?? undefined, domain }),
      })
        .then((res) => res.json())
        .then((body) => setAi({ key, text: body?.text ?? null, needCredits: body?.needCredits === true }))
        .catch(() => setAi({ key, text: null }));
    },
    []
  );

  useEffect(() => {
    const t = window.setTimeout(() => setEntering(false), 1600);
    return () => window.clearTimeout(t);
  }, []);

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

  // 결과로 들어오는 다른 길들(어제 인사 완료 → 바로 결과, 영역 바꾸기)에서도
  // 개인화를 받는다. 뽑기 클릭 경로는 onClick 에서 먼저 쏜다 — 연출 2.6초를
  // 대기 시간으로 쓰기 위해서다.
  useEffect(() => {
    if (step !== "reveal" || screen.kind !== "ready" || !account) return;
    const d = screen.data;
    const ohaeng = flaggedOhaeng(d.today);
    const fr = flipFlag(d.flow.myElement, ohaeng ?? d.flow.todayElement);
    const domain = ohaeng
      ? buildFlagAction(RELATION_FLOW[fr.relation], picked ?? undefined, d.completedToday as FortuneDomain[]).domain
      : (picked ?? d.action.domain);
    requestAi(account.token, ohaeng, domain);
  }, [step, screen, picked, account, requestAi]);

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

  if (entering || screen.kind === "loading") {
    return <RabbitLoader message="오늘의 흐름을 읽는 중이야" sub="오늘의 일진과 네 사주를 맞대어 보고 있어" />;
  }

  if (screen.kind === "guest" || screen.kind === "needsProfile" || screen.kind === "error") {
    return (
      <main className="today" key={screen.kind}>
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
                오늘의 일진과 네 사주를 맞대어 봐야 해서,
                <br />
                먼저 로그인이 필요해.
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

  // 뽑은 오방기가 있으면 그 오행이 흐름을 정하고, 없으면(저장이 막힌
  // 브라우저 등) 오늘의 일진 흐름으로 돌아간다 — 어느 쪽이든 표에서 나온다.
  const pickedOhaeng = flaggedOhaeng(data.today);
  const flagResult = flipFlag(data.flow.myElement, pickedOhaeng ?? data.flow.todayElement);
  const shown = pickedOhaeng
    ? buildFlagAction(RELATION_FLOW[flagResult.relation], picked ?? undefined, data.completedToday as FortuneDomain[])
    : picked
      ? [data.action, ...data.others].find((a) => a.domain === picked) ?? data.action
      : data.action;

  // ── 첫 걸음: 인사 ────────────────────────────────────────

  if (step === "hello") {
    return (
      <main className="today" key="hello">
        <Sky date={dateLabel(data.today)} rabbitArt={OBANG_RABBIT_ART}>
          <p className="today-sky-eyebrow">오늘의 사주 액션</p>
          <h1 className="today-sky-title">
            {data.name ? `${vocative(data.name)},` : "안녕,"}
            <br />
            오늘의 운세를
            <br />
            알려줄게.
          </h1>
          <p className="today-sky-sub">
            {data.yesterdayDomain
              ? `어제는 ${DOMAIN_LABEL[data.yesterdayDomain]} 액션을 해냈지. 뭐가 궁금해? 네가 뽑는 오방기로 풀어줄게.`
              : "뭐가 궁금해? 네가 뽑는 오방기의 기운으로 풀어줄게."}
          </p>
          <button
            type="button"
            className="today-sky-more"
            onClick={() => {
              rememberGreeted(data.today);
              setStep(hasFlaggedToday(data.today) ? "reveal" : "flags");
            }}
          >
            오방기 뽑으러 가기 <span aria-hidden>→</span>
          </button>
        </Sky>
        <div className="today-content">
          <TodayShelf />
        </div>
      </main>
    );
  }

  // ── 둘째 걸음: 고르기 ────────────────────────────────────

  if (step === "pick") {
    return (
      <main className="today" key="pick">
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

  // ── 셋째 걸음: 오방기 뽑기 ───────────────────────────────
  //
  // 뽑은 깃발이 답을 정한다 (2026-09-03). 다섯 깃발은 색을 감춘 채
  // 서 있고, 손이 닿은 하나만 색을 드러낸다 — 뽑은 오행이 내 일간을
  // 어떻게 대하는지(상생상극)가 그대로 오늘의 흐름이 된다.

  if (step === "flags") {
    return (
      <main className="today" key="flags">
        <div className={`today-draw${flipping ? " is-flipping" : ""}`}>
          <p className="today-draw-quote" aria-live="polite">
            {flipping ? (
              "뽑은 깃발을 펼치는 중이야…"
            ) : (
              <>
                &ldquo;마음이 가는 깃발,
                <br />
                하나만 뽑아봐.&rdquo;
              </>
            )}
          </p>
          {/* 오방기 다발을 든 토끼가 어둠 속에 흐릿하게 서 있다 — 뽑는 손의 상대 */}
          <div className="today-draw-rabbit" aria-hidden>
            <Image src={OBANG_RABBIT_ART} alt="" width={512} height={512} priority />
          </div>
          <div className="today-draw-row">
            {shuffled.map((flag, i) => (
              <button
                key={flag.ohaeng}
                type="button"
                className={`today-pole${drawn === flag.ohaeng ? " is-drawn" : ""}`}
                style={{ ["--i" as string]: i }}
                onClick={() => {
                  if (flipping) return;
                  rememberFlag(data.today, flag.ohaeng);
                  setDrawn(flag.ohaeng);
                  playDrawSound();
                  // 깃발이 펼쳐지는 사이에 AI 개인화를 미리 받아 둔다
                  if (account) {
                    const fr = flipFlag(data.flow.myElement, flag.ohaeng);
                    const dom = buildFlagAction(
                      RELATION_FLOW[fr.relation],
                      picked ?? undefined,
                      data.completedToday as FortuneDomain[]
                    ).domain;
                    requestAi(account.token, flag.ohaeng, dom);
                  }
                  // 뽑자마자 답을 주지 않는다. 깃발이 크게 펼쳐지는 것을 본 뒤에 넘어간다.
                  setFlipping(true);
                  setTimeout(() => {
                    setStep("reveal");
                    setFlipping(false);
                  }, 2600);
                }}
                aria-label="말려 있는 깃발"
              >
                <span className="today-pole-body">
                  <PoleArt />
                </span>
              </button>
            ))}
          </div>

          {/* 뽑힌 깃발은 슬롯 안이 아니라 방 한가운데에서 크게 펼쳐진다 —
              작은 칸 안의 깃발은 결과가 아니라 아이콘으로 읽혔다. */}
          {drawn && (
            <div className="today-draw-reveal" aria-hidden>
              <AlphaMotion
                video={flagOf(drawn).video}
                art={flagOf(drawn).art}
                alt=""
                width={512}
                height={512}
              />
              <p className="today-draw-reveal-name">
                {flagOf(drawn).color}기 · {drawn}
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── 넷째 걸음: 결과 ──────────────────────────────────────
  //
  // 위계는 하나다: 전제(너의 결·오늘의 기운) → 선언(오늘 할 것) → 상세.
  // 선언이 밤하늘의 큰 글이 된다 — 스크린샷의 "당신의 능력을…" 자리다.

  const done = data.completedToday.includes(shown.domain);
  const wonFlag = flagOf(pickedOhaeng ?? flagResult.todayElement);
  // AI 가 내 명식으로 다시 쓴 문구가 도착해 있으면 그것을, 아니면 표 문구를.
  // 조합(key)이 지금 화면과 다르면 남의 조합 문구라 쓰지 않는다.
  const aiText =
    ai?.key === `${pickedOhaeng ?? "일진"}:${shown.domain}` ? ai.text : null;
  const shownAction = aiText?.action ?? shown.action;
  const shownReason = aiText?.reason ?? shown.reason;
  const shownAvoid = aiText?.avoidAction ?? shown.avoidAction;
  /** 전제 — 뽑은 깃발이 있으면 그 깃발이 말하고, 없으면 오늘의 일진이 말한다 */
  const premise = pickedOhaeng
    ? `네가 뽑은 ${wonFlag.color}기(${pickedOhaeng}) — ${PICKED_PREMISE[flagResult.relation]}`
    : flagResult.premise;

  /** 저장하기를 누르면 클립보드에 담기는 오늘 몫 */
  const shareText = [
    `[${DOMAIN_LABEL[shown.domain]}] 일간 ${data.flow.dayMaster} · 오늘 ${data.flow.dayGanji}일`,
    premise,
    shownAction,
    shown.durationMinutes ? `약 ${shown.durationMinutes}분이면 돼` : "",
    "",
    `왜 이 행동인가 — ${shownReason}`,
    `오늘 피할 행동 — ${shownAvoid}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="today" key="reveal">
      <Sky date={dateLabel(data.today)} rabbitArt={shown.rabbit.art}>
        <p className="today-sky-premise">
          <span className={`today-hero-flag ${wonFlag.className}`}>
            <AlphaMotion video={wonFlag.video} art={wonFlag.art} alt="" width={80} height={80} />
          </span>
          {premise}
        </p>
        <h1 className="today-sky-title is-action">{shownAction}</h1>
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
          <p className="today-body">{shownReason}</p>

          <p className="today-label">오늘 피할 행동</p>
          <p className="today-body">{shownAvoid}</p>

          {shown.disclaimer && <p className="today-fine">{shown.disclaimer}</p>}

          {ai?.needCredits && (
            <p className="today-fine">
              러빗이 있으면 네 사주 수치로 더 깊게 풀어줘.{" "}
              <Link href="/credits">러빗 충전하기</Link>
            </p>
          )}

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

        {data.birthTimeUnknown && (
          <p className="today-fine today-footnote">태어난 시각은 몰라도 결과는 안 달라져.</p>
        )}

        <div className="today-again">
          <button type="button" className="today-skip" onClick={() => setStep("pick")}>
            다른 운세 보기
          </button>
          <button
            type="button"
            className="today-skip"
            onClick={() => {
              // 오늘의 깃발을 무르고 다시 뽑는다 (2026-09-03 운영자).
              try {
                sessionStorage.removeItem(FLAG_KEY);
              } catch {
                /* 지우기가 막혀도 화면은 뽑기로 간다 */
              }
              setDrawn(null);
              setShuffled([...FLAGS].sort(() => Math.random() - 0.5));
              setStep("flags");
            }}
          >
            오방기 다시 뽑기
          </button>
        </div>

        <TodayShelf />
      </div>
    </main>
  );
}

/**
 * 오늘 화면 아래의 사주 진열대 — 포스텔러 투데이 피드의 카드 문법.
 *
 * 연한 머리면에 작은 소개와 큰 후킹 질문, 그 아래 상품 일러스트.
 * 카드는 상세 판매 페이지(/product/[id])로 간다 — 들어온 사람이 오늘
 * 화면에서 바로 사주로 흘러갈 수 있게. 목록은 인기 태그 상위 넷이다.
 */
const SHELF = PRODUCTS.filter((p) => p.tags.includes("popular")).slice(0, 4);

function TodayShelf() {
  return (
    <section className="today-shelf">
      <p className="today-shelf-label">지금 바로 보는 사주</p>
      {SHELF.map((p) => (
        <Link key={p.id} href={`/product/${p.id}`} className="today-promo">
          <span
            className="today-promo-head"
            style={{
              background: `color-mix(in srgb, ${p.grad[0]} 10%, var(--bg-card))`,
            }}
          >
            <span className="today-promo-eyebrow">{p.ctaHook}</span>
            <strong className="today-promo-title">
              {p.emoji} {p.headline}
            </strong>
          </span>
          <span
            className="today-promo-art"
            aria-hidden
            style={{ background: `linear-gradient(160deg, ${p.grad[0]}, ${p.grad[1]})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/cards-pastel/${p.id}.jpg?v=2`} alt="" loading="lazy" />
          </span>
        </Link>
      ))}
    </section>
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

/**
 * 말려 있는 오방기 하나 — 색을 감춘 나무 깃대.
 *
 * 천이 감겨 있어 무슨 색인지 보이지 않는다. 뽑히면 이 자리에 진짜 깃발
 * (AlphaMotion)이 펼쳐진다. 그림 파일 없이 코드로 그린다.
 */
function PoleArt() {
  return (
    <svg viewBox="0 0 88 300" aria-hidden>
      <defs>
        <linearGradient id="pole-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d7c60" />
          <stop offset="0.45" stopColor="#c9b894" />
          <stop offset="0.5" stopColor="#cdbd98" />
          <stop offset="1" stopColor="#7c6c52" />
        </linearGradient>
      </defs>
      {/* 아래로 뷰박스를 넘겨 그린다 — 바닥이 평평하게 잘려 화면 끝(탭바)에
          맞닿는다. 둥근 밑동이 보이면 기둥이 아니라 막대 사탕이 된다. */}
      <rect x="8" y="16" width="72" height="300" rx="8" fill="url(#pole-wood)" />
      <ellipse cx="44" cy="18" rx="36" ry="12" fill="#e3d4ad" />
      <path d="M20 60 q30 26 0 60 M64 120 q-26 30 0 62 M28 200 q24 24 0 52" stroke="rgba(90,74,52,0.35)" stroke-width="3" fill="none" />
    </svg>
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
