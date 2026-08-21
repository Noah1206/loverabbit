"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BrandMark from "@/components/BrandMark";
import SajuChart from "@/components/SajuChart";
import { saveToArchive } from "@/lib/archive";
import { computeSaju } from "@/lib/saju";
import { lunarToSolar } from "@/lib/lunar";
import { PRODUCT_MAP } from "@/lib/products";
import {
  clearReadingDraft,
  parsePerson,
  saveReadingDraft,
  takeReadingDraft,
  type ReadingDraft,
} from "@/lib/reading-draft";
import { landingTypeForProduct, trackPreviewGenerated } from "@/lib/meta-events";
import { getUser } from "@/lib/user";

// 단계 문구. 실제 파이프라인(명식 계산 -> 규칙 매칭 -> 문장 생성)을 닮게 적되,
// 마지막 항목이 "기다리는 자리"다 - 응답이 올 때까지 이 줄에서 점이 돈다.
const STAGES = [
  "네 기둥을 세웠어요",
  "일간의 기질을 읽는 중",
  "합과 충을 맞춰보는 중",
  "흐름을 문장으로 옮기는 중",
  "마지막 정리",
] as const;

// 사주 생성 대기 화면.
// 폼에서 18초를 붙잡아두는 대신 제출 즉시 이 화면으로 넘어와, 여기서 리딩을 만들고
// 완료되면 곧바로 기사형 리포트(/reading/{id})로 교체한다(replace — 뒤로가기로 다시 오지 않게).
export default function ReadingGeneratingPage() {
  const router = useRouter();
  const started = useRef(false);
  // 이 화면이 아직 떠 있는가. 사용자가 뒤로가기로 나간 뒤 생성이 끝났을 때,
  // 보고 있던 화면에서 리딩으로 잡아채 가지 않기 위해 본다.
  const alive = useRef(true);

  const [draft, setDraft] = useState<ReadingDraft | null>(null);
  const [error, setError] = useState("");
  const [needSignup, setNeedSignup] = useState(false);

  /*
    기다림의 화면 구성 (2026-08-22 운영자 방향).

    92%에서 멈추는 가짜 진행바를 버렸다. 멈춘 숫자는 "죽었나?"를 부른다.
    대신 두 가지 진짜를 보여준다:

    1. 유저 본인의 명식. 생년월일은 이미 손에 있으니 명식은 클라이언트에서
       바로 계산된다. 네 기둥이 년주부터 하나씩 떠오른다 - 장식이 아니라
       자기 데이터라서, 읽는 것 자체가 기다림의 콘텐츠가 된다.

    2. 단계 체크리스트. 시간 배분으로 하나씩 체크되고, 마지막 단계는 응답이
       올 때까지 점을 찍으며 기다린다. 응답이 늦어도 "마무리 중"으로 읽히지
       "멈춤"으로 읽히지 않는다. 도착하면 전부 체크하고 400ms 뒤에 넘어간다.
  */
  const [stage, setStage] = useState(0);
  const [runId, setRunId] = useState(0);

  // 단계 전환 시각표. 실제 소요 15~20초에 맞춘 배분이고, 마지막 단계는 멈춰서
  // 응답을 기다린다 - 그래서 시각표는 단계 수보다 하나 적다.
  useEffect(() => {
    const timers = [2000, 5500, 10000, 15000].map((at, index) =>
      setTimeout(() => setStage((now) => Math.max(now, index + 1)), at)
    );
    return () => timers.forEach(clearTimeout);
  }, [runId]);

  // 명식은 초안에서 바로 계산한다. 음력이면 양력으로 바꾸고, 시각 모름이면
  // 시주 자리가 "모름"으로 비는 것까지 확인 화면과 같은 규칙이다.
  const chart = useMemo(() => {
    const me = draft?.me;
    if (!me) return null;
    const year = parseInt(me.year, 10);
    const month = parseInt(me.month, 10);
    const day = parseInt(me.day, 10);
    if ([year, month, day].some(Number.isNaN)) return null;
    const solar =
      me.calendar === "lunar"
        ? lunarToSolar({ year, month, day, leapMonth: me.leapMonth === true })?.solar ?? null
        : { year, month, day };
    if (!solar) return null;
    try {
      return computeSaju({
        year: solar.year,
        month: solar.month,
        day: solar.day,
        hour: !me.hour || me.hour === "unknown" ? null : parseInt(me.hour, 10),
      });
    } catch {
      return null;
    }
  }, [draft]);

  const generate = useCallback(
    async (job: ReadingDraft) => {
      setError("");
      setStage(0);
      setRunId((now) => now + 1);
      const user = getUser();
      if (!user) {
        // 로그인이 없을 때만 초안을 되돌려 둔다. 폼으로 돌아가면 입력값이 복원되고,
        // 자동 재개는 로그인 상태에서만 걸리므로 되돌이표가 생기지 않는다.
        saveReadingDraft(job);
        setNeedSignup(true);
        setError("로그인이 풀렸어요. 다시 로그인하면 입력한 정보로 이어서 풀어드릴게요.");
        return;
      }
      try {
        const res = await fetch("/api/reading", {
          method: "POST",
          // 상한 없이 기다리면 네트워크가 멈췄을 때 92%에서 영원히 멈춘다.
          // 실제 소요는 15~20초라 90초면 실패가 확실하다.
          signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(90_000) : undefined,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: job.category,
            offerId: job.offerId,
            me: parsePerson(job.me),
            partner: job.withPartner && job.partner.year ? parsePerson(job.partner) : null,
            question: job.question ?? "",
            occupation: job.occupation ?? "",
            userToken: user.token,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.needSignup) setNeedSignup(true);
          throw new Error(data.error ?? "리딩 생성에 실패했어요.");
        }
        saveToArchive({
          readingId: data.readingId,
          blob: data.blob,
          category: job.category,
          offerId: data.offerId ?? job.offerId,
          label: PRODUCT_MAP[job.category]?.shortLabel ?? job.category,
          characterId: "",
          teaser: data.teaser,
          full: null,
          chart: data.chart,
          price: data.price,
          createdAt: Date.now(),
          previewSections: data.previewSections ?? [],
          lockedSectionTitles: data.lockedSectionTitles ?? [],
          scoreLabel: data.scoreLabel ?? null,
          score: null,
          demo: data.demo === true,
          summaryCards: data.summaryCards ?? [],
          disclaimer: data.disclaimer ?? "",
          confidenceNote: data.confidenceNote ?? "",
        });
        clearReadingDraft();
        const landing = landingTypeForProduct(job.category, data.offerId ?? job.offerId);
        if (landing) trackPreviewGenerated(landing);
        // 전부 체크된 것을 잠깐 보여준다. 마지막 줄이 도는 중에 화면이 확 바뀌면
        // 끝났다는 감각 없이 끊긴다. 400ms 는 체크 전환이 눈에 들어오는 최소치다.
        setStage(STAGES.length);
        // 리딩은 이미 보관함에 앉았다. 화면을 떠난 사람은 잡아채지 않는다 —
        // 홈에서 딴 걸 보고 있는데 갑자기 리딩으로 끌려가면 그게 더 놀랍다.
        // 떠난 경우 리딩은 내 상담에서 기다린다.
        setTimeout(() => {
          if (alive.current) router.replace(`/reading/${data.readingId}`);
        }, 400);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "TimeoutError") {
          setError("서버 응답이 너무 늦어요. 네트워크를 확인하고 다시 시도해주세요.");
          return;
        }
        setError(reason instanceof Error ? reason.message : "오류가 발생했습니다.");
      }
    },
    [router],
  );

  useEffect(() => {
    // cleanup 은 어느 경로에서든 등록돼야 한다. 조기 return 뒤에 두면 개발 모드의
    // 이중 실행이나 초안 없는 진입에서 cleanup 이 빠져 alive 추적이 깨진다.
    alive.current = true;
    if (!started.current) {
      started.current = true;
      // 초안은 여기서 한 번만 소비하되, 곧바로 자동 재개 없는 사본을 되돌려 둔다.
      // 소비만 하고 끝내면 생성 중 뒤로가기·새로고침에 입력값이 통째로 사라진다 —
      // 생년월일 넷에 고민 한 줄까지 다 적은 사람이 빈 폼을 다시 만난다.
      // autoResume: false 라서 폼은 값만 복원하고 멈춘다. 되돌이표는 안 생긴다.
      const job = takeReadingDraft();
      if (!job) {
        router.replace("/reading");
      } else {
        saveReadingDraft({ ...job, autoResume: false });
        setDraft(job);
        void generate(job);
      }
    }
    return () => {
      alive.current = false;
    };
  }, [generate, router]);

  const label = draft ? (PRODUCT_MAP[draft.category]?.shortLabel ?? "마음 리딩") : "마음 리딩";

  return (
    <main className="container reading-generating" style={{ paddingTop: 64, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <BrandMark size={56} />
      </div>

      {error ? (
        <>
          <h1 style={{ marginBottom: 8 }}>사주를 풀지 못했어요</h1>
          <p style={{ color: "var(--text-dim)", marginBottom: 20 }} role="alert">{error}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
            {draft && !needSignup && (
              <button className="btn" onClick={() => void generate(draft)}>다시 시도하기</button>
            )}
            <Link className="btn btn-ghost" href="/reading">입력 화면으로 돌아가기</Link>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ marginBottom: 8 }}>{label} 사주를 푸는 중이에요</h1>
          <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>20초쯤 걸려요.</p>

          {chart && (
            <div className="reading-generating-chart" key={runId}>
              <SajuChart chart={chart} />
            </div>
          )}

          {/* role=status: 단계가 바뀔 때 보조기기가 활성 줄을 읽는다 */}
          <ol className="reading-generating-stages" role="status" aria-label="사주 푸는 단계">
            {STAGES.map((text, index) => {
              const state = index < stage ? "done" : index === stage ? "active" : "pending";
              return (
                <li key={text} data-state={state}>
                  <span className="reading-generating-stage-mark" aria-hidden>
                    {state === "done" ? "✓" : state === "active" ? "" : ""}
                  </span>
                  <span className="reading-generating-stage-text">
                    {text}
                    {state === "active" && (
                      <span className="reading-generating-dots" aria-hidden>
                        <i /><i /><i />
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          <p style={{ color: "var(--text-dim)", marginTop: 18, fontSize: "0.88rem" }}>
            창을 닫지 말고 잠시만 기다려주세요.
          </p>
        </>
      )}
    </main>
  );
}
