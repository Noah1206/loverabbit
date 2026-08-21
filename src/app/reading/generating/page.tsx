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
        router.replace(`/reading/${data.readingId}`);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "오류가 발생했습니다.");
      }
    },
    [router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // 초안은 여기서 한 번만 소비한다. 실패 후 폼으로 돌아가도 되돌이표가 생기지 않는다.
    const job = takeReadingDraft();
    if (!job) {
      router.replace("/reading");
      return;
    }
    setDraft(job);
    void generate(job);
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
