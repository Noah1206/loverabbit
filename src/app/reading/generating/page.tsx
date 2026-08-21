"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import BrandMark from "@/components/BrandMark";
import { saveToArchive } from "@/lib/archive";
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
  const [progress, setProgress] = useState(8);

  // 실제 소요는 15~20초. 완료 전까지 92%에서 멈춰 기다린다.
  useEffect(() => {
    const timer = setInterval(() => setProgress((p) => (p >= 92 ? 92 : p + 2)), 400);
    return () => clearInterval(timer);
  }, []);

  const generate = useCallback(
    async (job: ReadingDraft) => {
      setError("");
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
        setProgress(100);
        // 리딩은 이미 보관함에 앉았다. 화면을 떠난 사람은 잡아채지 않는다 —
        // 홈에서 딴 걸 보고 있는데 갑자기 리딩으로 끌려가면 그게 더 놀랍다.
        // 떠난 경우 리딩은 내 상담에서 기다린다.
        if (alive.current) router.replace(`/reading/${data.readingId}`);
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
          <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
            일주와 오행을 교차 분석하고 있어요. 20초쯤 걸려요.
          </p>

          <div
            className="reading-generating-bar"
            role="progressbar"
            aria-label="사주 푸는 중"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <p className="pulse" style={{ color: "var(--text-dim)", marginTop: 18, fontSize: "0.88rem" }}>
            창을 닫지 말고 잠시만 기다려주세요.
          </p>
        </>
      )}
    </main>
  );
}
