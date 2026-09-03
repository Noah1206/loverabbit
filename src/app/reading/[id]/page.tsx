"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readAttribution } from "@/lib/attribution";
import { hasMarketingConsent } from "@/lib/consent";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CardMotion from "@/components/CardMotion";
import ChatSection from "@/components/ChatSection";
import PaymentModal from "@/components/PaymentModal";
import { bundleOfReading } from "@/lib/bundles";
import { READING_PRICE_TIERS, REFERRAL_SIGNUP_CREDITS } from "@/lib/credits";
import ContinueSheet from "@/components/ContinueSheet";
import RabbitLoader from "@/components/RabbitLoader";
import {
  landingTypeForProduct,
  trackInitiateCheckout,
  trackResultUnlockClicked,
} from "@/lib/meta-events";
import { trackFunnel } from "@/lib/funnel";
import SignupModal from "@/components/SignupModal";
import { listArchive, saveToArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { DEMO_SOURCE_NOTE } from "@/lib/reading-demo";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/products";
import { savePendingReading, takePendingReading } from "@/lib/pending-reading";
import { parseReportSections, readingMinutes, summaryPoints } from "@/lib/reading-report";
import { buildChapters, previewPieces, reportPieces, type ReadingChapter } from "@/lib/reading-chapters";
import { conceptFor } from "@/lib/reading-concepts";
import { gateDecision } from "@/lib/reading-gate-redirect";
import {
  ChapterBody,
  ChapterIndex,
  ChapterNavBar,
  ChapterOutline,
  ChapterPanel,
  ChapterShell,
  ChapterTopBar,
  ChartPanel,
  IndexDrawer,
  MarkLegend,
  ScoreBreakdown,
  Seal,
  type IndexItem,
  Marked,
} from "@/components/ReadingChapters";
import { getUser, saveUser, type User } from "@/lib/user";
import { REFERRAL_REWARD_PARAM } from "@/lib/referral";
import { TALISMAN_SLOT, type ReadingImage } from "@/lib/reading-image-shape";
import Talisman from "@/components/Talisman";
import ReviewPrompt from "@/components/ReviewPrompt";

interface ReferralStatus {
  referralCode: string;
  readingUnlocked: boolean;
}

// 리딩 결과 뷰어 — 장(章)마다 한 페이지씩 넘겨 읽는다.
//
//   1쪽(들어오는 자리): 목차 + 강조 범례 + 1장 본문
//                       아직 안 산 사람에게는 그 위에 명식·요약 카드가 더 붙는다
//   2..N쪽:             각 장 (머리 -> 절 -> 지루해질 무렵 그림 한 장)
//   마지막 쪽:          다음 리딩 + 추가 상담
//   0쪽(표지):          명식·지수·요약·목차. 아래 바의 "표지" 로 언제든 돌아간다
//
// **표지가 아니라 1장으로 들어온다.** 목차에서 하나를 고르게 하면, 아직 무슨 내용인지
// 모르는 사람에게 선택을 시키는 셈이라 첫 화면에서 멈춘다.
//
// 분야마다 달라지는 것은 장 제목과 인장뿐이고(reading-concepts.ts),
// 구조와 잠금 규칙은 모든 리딩이 똑같이 쓴다.
export default function ReadingReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [user, setUser] = useState<User | null>(null);
  /* 다음 한 장에 낼 값. 사람마다 다르다 (2·4·10러빗 — 열어본 장수를 탄다).
     이 화면을 보는 사람은 이미 한 장을 읽었으므로 첫 장 값이 아니다. */
  const [nextCost, setNextCost] = useState<number | null>(null);
  const [showPay, setShowPay] = useState(false);
  // "이어서 보기" 창. 값보다 무엇을 못 보는지를 먼저 보여 준다(ContinueSheet).
  const [showContinue, setShowContinue] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  // 장마다 한 장씩 뒤따라 오는 그림. 한 장에 60초라 글보다 늦다.
  const [images, setImages] = useState<ReadingImage[]>([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // 결제(권리)는 확인됐는데 전문이 아직 만들어지는 중 — 로딩 화면을 띄우고
  // 다 되면 그 자리에서 이어서 보여준다. 수동 새로고침을 시키지 않는다.
  const [preparing, setPreparing] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [page, setPage] = useState(0);
  // 1쪽 위의 펼친 목차. 승인 직후에는 접어 두고 본문부터 보인다.
  const [outlineOpen, setOutlineOpen] = useState(true);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    const found = listArchive().find((item) => item.readingId === id) ?? null;
    setEntry(found);
    // 보관함에 없어도 바로 "찾을 수 없음"으로 보내지 않는다. 보관함은 기기
    // 하나에 갇혀 있어서, 폰으로 결제한 사람이 PC 에서 열면 여기가 비어 있다.
    // 로그인돼 있으면 DB 에서 복원을 시도하고, 그동안은 로딩으로 둔다.
    setStatus(found ? "ready" : stored ? "loading" : "missing");

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "approved") {
      setNotice("결제가 승인됐어요. 첫 장부터 끝 장까지 전부 열렸어요.");
      // 승인 직후 첫 화면은 목차가 아니라 본문이다. 결제한 29명 중 8명이 20초
      // 안에 닫았는데(2026-08-28), 그들이 본 첫 화면이 목차였다.
      setOutlineOpen(false);
    }
    // 주소에 쪽 번호가 있으면 그 장부터 — 공유한 링크가 같은 자리를 연다
    const wanted = Number(params.get("p"));

    let alive = true;
    const restore = async () => {
      try {
        const res = await fetch("/api/my-readings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: stored?.token, readingId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.reading) throw new Error(data.error ?? "복원 실패");
        const detail = data.reading as {
          readingId: string; category: string; label: string; teaser: string;
          chart: { me: string; partner: string | null }; price: number;
          scoreLabel: string | null; unlocked: boolean; createdAt: string;
        };
        const rebuilt: ArchiveEntry = {
          readingId: detail.readingId,
          // blob 은 이 기기에 없다. DB 가 붙은 운영에서는 서버가 정본이라 없어도 된다.
          blob: "",
          category: detail.category,
          label: detail.label,
          teaser: detail.teaser,
          full: null,
          chart: detail.chart,
          price: detail.price,
          createdAt: Date.parse(detail.createdAt) || Date.now(),
          previewSections: [],
          // 발급 때의 미리보기 조각은 DB 에 없다. 잠긴 장 제목은 상품 목차로 세운다 —
          // 목차가 곧 발급 때 쓴 윤곽이라 같은 제목이 나온다.
          lockedSectionTitles: detail.unlocked ? [] : (PRODUCT_MAP[detail.category]?.toc ?? []),
          scoreLabel: detail.scoreLabel,
        };
        if (detail.unlocked) {
          // 본문을 못 받더라도 권리는 확인됐다. 아래 튕겨내기가 이 값을 본다.
          setPaidUnlocked(true);
          // 전문은 해금 검증을 거치는 /api/unlock 으로만 받는다. 이미 해금된
          // 리딩이라 재결제 없이 전문이 온다.
          const unlockRes = await fetch("/api/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ readingId: id, userToken: stored?.token }),
          });
          const unlockData = await unlockRes.json().catch(() => ({}));
          if (unlockRes.ok && typeof unlockData.full === "string") {
            rebuilt.full = unlockData.full;
            rebuilt.score = unlockData.score ?? null;
            rebuilt.scoreBand = unlockData.scoreBand ?? null;
            rebuilt.scoreFactors = unlockData.scoreFactors ?? [];
            rebuilt.scoreAsOf = unlockData.scoreAsOf ?? null;
            rebuilt.report = unlockData.report ?? null;
          } else if (!alive) {
            return;
          } else {
            // 결제는 돼 있는데 전문을 못 받았다(준비 중 등). 리딩 자체는 세우고
            // 로딩 화면으로 넘긴다 — 아래 폴링이 완성되는 대로 이어서 보여준다.
            setPreparing(true);
          }
        }
        if (!alive) return;
        saveToArchive(rebuilt);
        setEntry(rebuilt);
        setStatus("ready");
        setPage(Number.isInteger(wanted) && wanted > 0 ? wanted : 1);
      } catch {
        if (alive) setStatus("missing");
      }
    };
    if (!found && stored) void restore();

    // 잠긴 리딩을 열 때는 서버 해금 상태를 한 번 확인한다.
    //
    // 입금 확인 흐름의 구멍이었다: 승인 폴링은 /payment/pending 만 하는데,
    // 유저는 이체하러 은행 앱으로 떠났다가 그 페이지가 아니라 리딩으로 돌아온다.
    // 관리자가 승인해서 DB 는 열렸는데(lr_readings.unlocked) 이 기기 보관함의
    // full 은 null 그대로라, 돈 낸 사람이 잠긴 화면을 계속 봤다.
    const syncUnlock = async () => {
      try {
        const res = await fetch("/api/my-readings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: stored?.token, readingId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.reading?.unlocked) return; // 아직 승인 전 - 그대로 둔다
        // 승인은 확인됐다. 아래에서 본문을 못 받아 빠져나가더라도 이건 남긴다 —
        // 이 표시가 없으면 돈 낸 사람이 결제 화면으로 튕겨 나간다.
        if (alive) setPaidUnlocked(true);
        const unlockRes = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readingId: id, blob: found?.blob || undefined, userToken: stored?.token }),
        });
        const unlockData = await unlockRes.json().catch(() => ({}));
        if (!alive) return;
        if (!unlockRes.ok || typeof unlockData.full !== "string") {
          // 승인은 났는데 본문이 아직이다. 로딩 화면을 띄우고 폴링에 맡긴다.
          setPreparing(true);
          return;
        }
        const patch = {
          full: unlockData.full as string,
          score: unlockData.score ?? null,
          scoreBand: unlockData.scoreBand ?? null,
          scoreFactors: unlockData.scoreFactors ?? [],
          scoreAsOf: unlockData.scoreAsOf ?? null,
          report: unlockData.report ?? null,
          pendingOrderId: undefined,
        };
        updateArchive(id, patch);
        setEntry((now) => (now ? { ...now, ...patch } : now));
        setNotice("입금이 확인됐어요. 전문이 모두 열렸어요.");
      } catch {
        // 확인에 실패한 것뿐이다. 다음에 열 때 다시 확인한다.
      }
    };
    /*
      서버 해금 확인이 끝나기 전에는 이 주소를 잠그지 않는다.

      승인받은 사람이 승인 대기 화면이 아니라 리딩 주소로 바로 돌아오는 일이
      있다 — 은행 앱에 갔다가 돌아오는 길이 그렇다. 그때 이 기기 보관함의 full 은
      아직 null 이라, 확인을 기다리지 않고 튕겨내면 이미 돈을 낸 사람이 결제
      화면을 다시 본다.
    */
    if (found && !found.full && stored) {
      void syncUnlock().finally(() => {
        if (alive) setUnlockChecked(true);
      });
    } else {
      setUnlockChecked(true);
    }

    if (Number.isInteger(wanted) && wanted > 0) {
      setPage(wanted);
    } else if (found) {
      // 표지가 아니라 **1장으로 바로 들어간다.** 목차에서 하나를 고르게 하면,
      // 아직 무슨 내용인지 모르는 사람에게 선택을 시키는 셈이라 첫 화면에서 멈춘다.
      // 목차는 1장 맨 위에 펼쳐 두고, 표지는 아래 바의 '표지'로 언제든 돌아간다.
      //
      // 결제 전에도 마찬가지다. 그래서 파는 데 필요한 것(지수·요약 카드·결제)은
      // 표지에만 두지 않고 1장에도 함께 세운다 — 아래 lockedPitch 참조.
      setPage(1);
    }

    // 결제하려다 로그인으로 빠졌던 경우, 돌아오자마자 결제창을 다시 띄운다
    const pending = takePendingReading();
    if (found && stored && !found.full && pending?.result.readingId === id) {
      setShowPay(true);
    }
    if (stored?.referralCode) {
      setReferralStatus({
        referralCode: stored.referralCode,
        readingUnlocked: false,
      });
    }
    return () => {
      alive = false;
    };
  }, [id]);

  const unlocked = Boolean(entry?.full);

  /**
   * 삽화 — 해금된 뒤에 뒤따라 온다.
   *
   * 한 장에 60초라 다섯 장이면 5분이다. 그동안 글은 이미 읽히고 있고, 그림은
   * 도착하는 대로 자리에 앉는다. 다 오면 묻기를 멈춘다 — 완성된 리딩을 다시 열 때
   * 쓸데없이 계속 두드리지 않기 위해서다.
   */
  useEffect(() => {
    if (!unlocked || !id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 서버 작업이 소리 없이 죽으면 pending 이 영영 남는다. 그림 전체가 길어야
    // 5분이므로, 7분을 넘긴 대기는 실패로 접는다 - 오지 않을 그림을 계속
    // 기다리게 두지 않는다.
    const startedAt = Date.now();
    const GIVE_UP_MS = 7 * 60 * 1000;

    const done = (list: ReadingImage[]) =>
      list.length > 0 && list.every((image) => image.status !== "pending");

    const tick = async (kick: boolean) => {
      if (stopped) return;
      try {
        const res = kick
          ? await fetch("/api/reading/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ readingId: id }),
            })
          : await fetch("/api/reading/images?readingId=" + id);
        const data = (await res.json()) as { images?: ReadingImage[] };
        const list = data.images ?? [];
        if (stopped) return;
        if (!done(list) && Date.now() - startedAt > GIVE_UP_MS) {
          setImages(list.map((image) => (image.status === "pending" ? { ...image, status: "failed" as const } : image)));
          return;
        }
        setImages(list);
        if (!done(list)) timer = setTimeout(() => void tick(false), 6000);
      } catch {
        // 그림은 덤이다. 못 물어봤다고 알릴 것까지는 없고, 조금 뒤에 다시 묻는다.
        if (!stopped) timer = setTimeout(() => void tick(false), 15000);
      }
    };

    void tick(true);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [unlocked, id]);

  const imageOf = useCallback(
    (chapter: number) => images.find((image) => image.chapter === chapter) ?? null,
    [images]
  );
  const product = PRODUCT_MAP[entry?.category ?? ""];
  const concept = conceptFor(entry?.category);
  // 리딩이 실제로 그려진 순간. 경로가 열린 것(page_view)과는 다르다 — 복원에
  // 실패해 "찾을 수 없음" 으로 끝난 방문은 여기까지 오지 않는다.
  // 서버에 해금 여부를 물어봤는가. 묻기 전에는 잠금 판단을 미룬다.
  const [unlockChecked, setUnlockChecked] = useState(false);
  /*
    DB 가 "이미 해금됨"이라고 답했는가.

    본문(full)과 권리(unlocked)는 다른 것이다. 승인은 났는데 본문이 아직 안
    끝난 구간이 실제로 있다 — 그때 /api/unlock 은 503(준비 중)을 낸다. 그것을
    "안 산 사람"으로 읽으면 돈 낸 사람을 결제 화면으로 돌려보내게 된다.
  */
  const [paidUnlocked, setPaidUnlocked] = useState(false);

  // 준비 중인 전문을 5초마다 다시 청한다. 서버는 완성돼 있으면 그대로 주고,
  // 아직이면 503 — 도착하는 순간 로딩을 걷고 이어서 보여준다.
  useEffect(() => {
    if (!preparing || !entry) return;
    let stopped = false;
    const readingId = entry.readingId;
    const blob = entry.blob || undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readingId, blob, userToken: user?.token }),
        });
        const data = await res.json().catch(() => ({}));
        if (stopped || !res.ok || typeof data.full !== "string") return;
        const patch = {
          full: data.full as string,
          score: data.score ?? null,
          scoreBand: data.scoreBand ?? null,
          scoreFactors: data.scoreFactors ?? [],
          scoreAsOf: data.scoreAsOf ?? null,
          report: data.report ?? null,
          pendingOrderId: undefined,
        };
        updateArchive(readingId, patch);
        setEntry((now) => (now ? { ...now, ...patch } : now));
        setPreparing(false);
        setNotice("");
      } catch {
        // 다음 주기에 다시
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [preparing, entry, user]);

  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "ready" || !entry) return;
    if (viewedRef.current === entry.readingId) return;
    viewedRef.current = entry.readingId;
    trackFunnel("reading_view", {
      product: entry.category,
      landing: landingTypeForProduct(entry.category, entry.offerId) ?? undefined,
    });
  }, [status, entry]);

  /*
    이 주소는 돈을 낸 사람만 들어온다 (2026-08-26 운영자 결정).

    전에는 여기가 표지 겸 결제 화면이었다 — 명식·지수·목차를 펼쳐 놓고 아래에
    결제 버튼을 두었다. 그 화면에서 하루 119명이 그만뒀다. 사기 전에 읽을 것을
    한 상 차려 두면, 결제는 그 상을 다 물린 뒤에 꺼내는 청구서가 된다.

    그래서 결제는 앞 칸(/reading/[id]/checkout)으로 옮기고 이 주소는 잠근다.
    입금 확인을 보낸 사람은 승인 대기 화면이 제자리다 — 결제 화면으로 돌려보내면
    두 번 내라는 말로 읽힌다.
  */
  useEffect(() => {
    if (status !== "ready" || !entry) return;
    // 판단은 reading-gate-redirect.ts 에 있다 — 돈 낸 사람을 결제 화면으로
    // 보내지 않기 위한 규칙이라 테스트가 붙어 있다.
    const decision = gateDecision({
      hasFull: unlocked,
      paidUnlocked,
      unlockChecked,
      pendingOrderId: entry.pendingOrderId,
    });
    if (decision.kind === "stay") return;
    router.replace(
      decision.kind === "pending"
        ? `/payment/pending?orderId=${encodeURIComponent(String(decision.orderId))}`
        : `/reading/${entry.readingId}/checkout`
    );
  }, [status, entry, unlocked, unlockChecked, paidUnlocked, router]);

  const points = useMemo(() => summaryPoints(entry?.teaser ?? ""), [entry?.teaser]);

  const chapters: ReadingChapter[] = useMemo(() => {
    if (!entry) return [];
    // 구조화 리포트가 남아 있으면 그쪽이 정확하다 — 근거와 주의점이 함께 온다.
    // 없으면(예전에 받은 리딩) 저장된 텍스트를 파싱해 같은 모양으로 세운다.
    const pieces = entry.report
      ? reportPieces(entry.report)
      : entry.full
        ? parseReportSections(entry.full).map((section) => ({
            title: section.title,
            paragraphs: section.paragraphs,
          }))
        : previewPieces(entry.previewSections ?? [], entry.lockedSectionTitles ?? [], product?.toc ?? []);
    return buildChapters(pieces, {
      toc: product?.toc ?? [],
      chapterTitles: concept.chapters,
      epilogueTitle: concept.epilogue,
    });
  }, [entry, product?.toc, concept.chapters, concept.epilogue]);

  const total = chapters.length;
  const current = page > 0 && page <= total ? chapters[page - 1] : null;
  const indexItems: IndexItem[] = chapters.map((chapter) => ({
    label: chapter.label,
    title: chapter.title,
    locked: chapter.locked,
  }));

  // 쪽을 넘길 때마다 맨 위로 올리고, 주소에도 남겨 새로고침·공유가 같은 자리를 연다
  const goto = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), Math.max(0, total));
      setPage(clamped);
      window.scrollTo({ top: 0, behavior: "auto" });
      const url = new URL(window.location.href);
      if (clamped > 0) url.searchParams.set("p", String(clamped));
      else url.searchParams.delete("p");
      window.history.replaceState(null, "", url.toString());
    },
    [total]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /input|textarea/i.test(event.target.tagName)) return;
      if (event.key === "ArrowLeft") goto(page - 1);
      if (event.key === "ArrowRight") goto(page + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, page]);

  // 다음 리딩 추천 — 방금 본 것보다 비싼 상품 중에서,
  // 혼자 본 리딩 뒤에는 '그 사람'이 필요한 리딩을 먼저 올린다.
  const nextReadings = useMemo(() => {
    if (!product) return [];
    const rank = (p: (typeof PRODUCTS)[number]) => [
      product.needsPartner || p.needsPartner ? 0 : 1,
      p.tags.includes("popular") ? 0 : 1,
      p.price,
    ];
    // 값이 더 비싼 것만 고르던 조건을 뺀다 — 크레딧 단일 화폐에서는 값 비교가 무의미하고,
    // 12,000원짜리를 본 사람에게 "더 비싼 것"은 없다.
    return PRODUCTS.filter((p) => p.id !== product.id)
      .sort((a, b) => {
        const [ra, rb] = [rank(a), rank(b)];
        return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
      })
      .slice(0, 2);
  }, [product]);

  const depositorCode = entry ? `레빗-${entry.readingId.slice(0, 4).toUpperCase()}` : "";

  const startUnlock = () => {
    if (!entry) return;
    // 잠금 해제 CTA 클릭 — 광고 랜딩에서 온 상품일 때만 landing_type을 붙인다.
    const unlockLanding = landingTypeForProduct(entry.category, entry.offerId);
    if (unlockLanding) trackResultUnlockClicked(unlockLanding);
    trackFunnel("unlock_clicked", {
      product: entry.category,
      landing: unlockLanding ?? undefined,
    });
    if (!user) {
      savePendingReading({
        source: "archive",
        category: entry.category,
        createdAt: Date.now(),
        result: {
          readingId: entry.readingId,
          teaser: entry.teaser,
          chart: entry.chart,
          price: entry.price,
          blob: entry.blob,
          previewSections: entry.previewSections ?? [],
          lockedSectionTitles: entry.lockedSectionTitles ?? [],
          scoreLabel: entry.scoreLabel ?? null,
          demo: entry.demo === true,
        },
      });
      // 로그인 관문이 폼에서 여기로 옮겨 왔다 (2026-08-25). 여기서 나간 사람이
      // 곧 로그인에서 잃은 사람이다 - unlock_clicked 와 checkout_opened 사이.
      trackFunnel("signup_required", { product: entry.category });
      setShowSignup(true);
      return;
    }
    const checkoutLanding = landingTypeForProduct(entry.category, entry.offerId);
    if (checkoutLanding) {
      trackInitiateCheckout({ value: entry.price, landingType: checkoutLanding });
    }
    // 전문 보기를 누른 사람과 결제창까지 연 사람은 다르다. 그 사이에 로그인
    // 관문이 있어서, 두 줄의 차이가 곧 로그인에서 잃은 사람 수다.
    trackFunnel("checkout_opened", {
      product: entry.category,
      landing: checkoutLanding ?? undefined,
    });
    setShowPay(true);
  };

  const confirmTransfer = async (couponId?: string) => {
    if (!entry) return;
    setPaying(true);
    setError("");
    // 결제창을 연 사람과 실제로 보낸 사람의 차이. 계좌번호를 보고 닫는 자리다.
    trackFunnel("checkout_submitted", { product: entry.category });
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId: entry.readingId,
          blob: entry.blob,
          method: "transfer",
          depositorCode,
          userToken: user?.token,
          // 결제창에서 고른 쿠폰. 서버가 다시 확인해 금액을 정한다.
          couponId,
          // 어느 광고가 팔았는지를 주문에 함께 남긴다. 이 기록이 정본이다 —
          // Meta 쪽 집계는 픽셀이 막히면 비고, 그럴수록 알 수 없어진다.
          attribution: readAttribution(),
          // 승인은 몇 시간 뒤에 나고 그때는 이 기기가 없다. 전환을 그때 보낼지
          // 말지는 지금 이 값으로 정해진다 — 동의하지 않았으면 나가지 않는다.
          marketingConsent: hasMarketingConsent(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "입금 확인 요청 실패");
      if (!Number.isSafeInteger(Number(data.orderId))) {
        throw new Error("승인 대기 주문 번호를 받지 못했어요.");
      }
      updateArchive(entry.readingId, { pendingOrderId: Number(data.orderId) });
      setShowPay(false);
      router.push(`/payment/pending?orderId=${encodeURIComponent(String(data.orderId))}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPaying(false);
    }
  };

  // 다음 장 값은 서버가 센다. 못 가져오면 숫자를 아예 안 적는다 — 틀린 값을
  // 적느니 없는 편이 낫다(결제창이 정본이고, 거기서 처음 보면 놀란다).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { readingCost?: number } | null) => {
        if (alive && typeof d?.readingCost === "number") setNextCost(d.readingCost);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const refreshReferralStatus = useCallback(async (): Promise<ReferralStatus | null> => {
    if (!user || !entry) return null;
    const res = await fetch("/api/referral/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token, readingId: entry.readingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "보상 정보를 확인하지 못했어요.");
    const next = data as ReferralStatus;
    setReferralStatus(next);
    const nextUser = { ...user, referralCode: next.referralCode };
    setUser(nextUser);
    saveUser(nextUser);
    return next;
  }, [entry, user]);

  const shareReward = async () => {
    if (!entry || !user) return;
    setShareNotice("");
    try {
      const state = referralStatus?.referralCode ? referralStatus : await refreshReferralStatus();
      if (!state?.referralCode) throw new Error("초대 코드를 만들지 못했어요.");
      const params = new URLSearchParams({ ref: state.referralCode, reward: REFERRAL_REWARD_PARAM });
      const url = `${window.location.origin}/reading?${params.toString()}`;
      const text = "러브레빗에서 연애 사주 봤어. 가입하면 첫 사주 1,900원이야 🐰";
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 사주", text, url });
        setShareNotice("공유했어요. 친구가 가입하면 보상이 자동 지급돼요.");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNotice("초대 링크를 복사했어요. 친구가 가입하면 보상이 자동 지급돼요.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setShareNotice(reason instanceof Error ? reason.message : "공유 링크를 만들지 못했어요.");
    }
  };

  // 상단 공유 버튼 — 리딩 자체가 아니라 서비스로 데려온다(본문은 본인 기기에만 있다)
  const shareReading = async () => {
    setShareNotice("");
    const url = `${window.location.origin}/product/${entry?.category ?? ""}`;
    const text = `${entry?.label ?? "러브레빗 사주"} — 나도 봤어. 너도 한번 봐 🐰`;
    try {
      if (navigator.share) await navigator.share({ title: entry?.label ?? "러브레빗", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNotice("링크를 복사했어요.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setShareNotice("공유하지 못했어요.");
    }
  };

  if (status === "loading") {
    /* 기다림에는 끝을 둔다 — 서버가 응답하지 않으면 catch 도 안 돌아 예전에는
       스피너가 영원히 돌았다. 20초가 지나면 나갈 길이 있는 화면으로 보낸다. */
    return (
      <main className="container report-page">
        <RabbitLoader
          message="사주를 불러오는 중이에요"
          sub="잠시만 기다려 주세요."
          timeoutMs={20_000}
          onTimeout={() => setStatus("missing")}
        />
      </main>
    );
  }

  if (status === "missing" || !entry) {
    return (
      <main className="container report-page" style={{ paddingTop: 60, textAlign: "center" }}>
        <h1 style={{ marginBottom: 8 }}>이 리딩을 찾지 못했어요</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
          리딩은 받은 기기에 보관돼요. 다른 기기·브라우저에서 받은 리딩은 여기서 열 수 없어요.
        </p>
        <Link className="btn" href="/reading">새 리딩 받기 →</Link>
      </main>
    );
  }

  /*
    아직 안 쓰인 리딩의 분량.

    결제 전에 만들지 않는 흐름에서는 표지에 셀 글이 없다. readingMinutes 는
    바닥이 1분이라 "약 1분" 이 찍히는데, 그건 1분짜리를 판다는 말로 읽힌다.
    글이 없을 때는 목차 길이로 어림한다 — 상품 상세가 "약 12,000자" 를 셀 때
    쓰는 것과 같은 절당 800자다.
  */
  const minutes = entry.teaser || entry.full
    ? readingMinutes(entry.teaser, entry.full)
    : Math.max(1, Math.round(((product?.toc?.length ?? 0) * 800) / 450));
  const createdAt = new Date(entry.createdAt);
  const summaryCards = entry.summaryCards ?? [];

  /**
   * 광고에서 들어온 사람에게는 표지가 곧 끝이다.
   *
   * 목차만 보여 주면 "무엇이 들었는지"는 알아도 "어떻게 쓰였는지"는 모른다. 그래서
   * 첫 절을 **두 덩어리까지** 보여 주고 거기서 흐린다. 요약 한 덩어리만으로는
   * 이 글이 어떤 결인지 전해지지 않고, 세 덩어리부터는 살 이유가 줄어든다.
   *
   * 아래로 더 내려갈 것이 없으니 스크롤이 그 자리에서 멈춘다 — 막는 것이 아니라
   * 없는 것이다. 가려 놓고 억지로 스크롤을 잠그면 화면을 읽는 도구가 먼저 부서진다.
   */
  const tasteBlocks = (() => {
    const first = entry.previewSections?.[0];
    if (!first) return [];
    const clean = (text: string) => text.replace(/\s+/g, " ").trim();
    return [first.excerpt, ...(first.paragraphs ?? [])].map(clean).filter(Boolean).slice(0, 2);
  })();

  const gated = !unlocked && Boolean(entry.offerId) && tasteBlocks.length > 0;

  const taste = gated && (
    <section className="rv-taste" aria-label="리딩 맛보기">
      <h2>{entry.previewSections?.[0]?.title ?? "첫 장"}</h2>
      <div className="rv-taste-body">
        {tasteBlocks.map((block, index) => (
          <p key={index}>
            <Marked text={block} />
          </p>
        ))}
      </div>
    </section>
  );

  /**
   * 잠금.
   *
   * 예전에는 글 아래에 상자 하나가 따로 서서 "무료 운명 미리보기는 여기까지예요"
   * 라고 알렸다. 사는 사람에게 파는 말을 먼저 들려주는 꼴이라 너무 곧았다.
   *
   * 지금은 글이 이어지다 흐려지고, 그 흐려진 자리에 버튼이 앉는다. 끊긴 자리를
   * 말로 알리지 않고 눈으로 보여 준다 — 무엇을 못 보는지가 보이면 파는 말이
   * 따로 필요 없다.
   *
   * 앞 글을 위로 겹쳐 덮으므로 표지에서도 본문에서도 같은 모양이 된다.
   */
  const paywall = !unlocked && (
    <div className="rv-gate">
      <div className="rv-gate-veil" aria-hidden />
      <div className="rv-gate-cta">
        {entry.pendingOrderId ? (
          <Link className="btn" href={`/payment/pending?orderId=${entry.pendingOrderId}`}>
            입금 승인 상태 확인 →
          </Link>
        ) : (
          <button className="btn" onClick={() => setShowContinue(true)} disabled={paying}>
            {paying ? "결제 준비 중…" : "이어서 보기 →"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ChapterShell>
      {preparing && (
        <div className="rv-preparing" role="status" aria-live="polite">
          <p className="reading-generating-kicker">{entry.label}</p>
          <h2>사주 전문을 준비하고 있어요</h2>
          <div className="reading-generating-dots" aria-hidden><i /><i /><i /></div>
          <p className="rv-preparing-sub">다 되면 바로 이어서 보여드려요. 창을 닫아도 돼요 — 다시 열면 이어져요.</p>
        </div>
      )}
      <ChapterTopBar
        concept={concept}
        // 표지에서는 제목이 곧 상품명이라 부제까지 같은 말을 반복할 이유가 없다.
        kicker={current ? entry.label : `${total}개 장 · 약 ${minutes}분`}
        title={current ? `${current.label}. ${current.title}` : entry.label}
        onOpenIndex={() => setShowIndex(true)}
        onShare={() => void shareReading()}
      />

      <div className="rv-scroll">
        {notice && (
          /* "잠시 후 다시 열어주세요" 라고만 하고 열 자리를 안 주면, 사용자는
             무엇을 해야 하는지 모른 채 결제한 글을 기다린다. 누를 자리를 준다. */
          <p className="rv-notice">
            {notice}
            <button type="button" className="rv-notice-retry" onClick={() => window.location.reload()}>
              지금 다시 확인하기
            </button>
          </p>
        )}

        {page === 0 ? (
          <>
            {/* 표지 — 어떤 리딩을 손에 쥐었는지 한 화면에 담는다 */}
            <section className="rv-cover">
              {/* 표지는 기다리게 하지 않는다. 홈 카드와 같은 사전 제작 일러스트를
                  즉시 깔고, 이 리딩만의 장면 컷은 본문에서 도착하는 대로 붙는다. */}
              <div className="rv-cover-art" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/cards-pastel/${entry.category}.jpg?v=2`}
                  alt=""
                  onError={(event) => {
                    // 일러스트가 없는 카테고리(내린 상품 등)는 조용히 접는다
                    event.currentTarget.parentElement?.style.setProperty("display", "none");
                  }}
                />
                <CardMotion category={entry.category} objectPosition="center 22%" />
              </div>
              <div className="rv-cover-copy">
                <Seal concept={concept} size={46} />
                <small>{concept.cover}</small>
                <h1>{entry.label}</h1>
                <p>{points[0] ?? concept.cover}</p>
                <span className="rv-cover-meta">
                  {createdAt.toLocaleDateString("ko-KR")} · 약 {minutes}분 · {total}개 장
                  {unlocked ? " · 🔓 전문" : entry.pendingOrderId ? " · ⏳ 승인 대기" : " · 🔒 미리보기"}
                </span>
              </div>
            </section>

            {/*
              글맛이 먼저다.

              전에는 명식 · 지수 · 요약 카드 · 목차를 다 지나야 본문 두 덩어리가
              나왔다. 그 순서로 읽으면 결제를 만나는 시점에 이미 "답을 받았다" 는
              느낌이 쌓여 있다 — 사주 여덟 글자도, 점수도, 한눈에 보기 카드도
              저마다 결론처럼 읽히기 때문이다. 정작 파는 것은 글인데 글은 맨 끝에
              조금 나오고 끊긴다.

              그래서 본문을 표지 바로 뒤로 올리고, 흐려지는 자리도 함께 올린다.
              명식과 요약은 사라지지 않고 그 아래에 남는다 — 결론이 아니라 근거의
              자리로 내려가는 것이다.
            */}
            {taste}
            {taste && paywall}

            <ChartPanel
              chart={entry.chart}
              scoreLabel={entry.scoreLabel}
              score={entry.score}
              scoreBand={entry.scoreBand}
            />

            <ScoreBreakdown
              scoreLabel={entry.scoreLabel}
              score={entry.score}
              factors={entry.scoreFactors ?? []}
              asOf={entry.scoreAsOf ?? null}
            />

            {summaryCards.length > 0 && (
              <section className="rv-summary">
                <h2>한눈에 보기</h2>
                <div className="rv-summary-cards">
                  {summaryCards.map((card, index) => (
                    <div key={index}>
                      <small>{card.label}</small>
                      <strong>{card.value}</strong>
                      {card.detail && <p>{card.detail}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rv-toc">
              <h2>
                <span>목차</span>
                <small>{total}개 장</small>
              </h2>
              <ChapterIndex items={indexItems} current={page} onJump={goto} />
            </section>

            {entry.demo && <p className="rv-demo-note">{DEMO_SOURCE_NOTE}</p>}
            {/* 맛보기가 없는 리딩(광고로 들어오지 않은 흐름)은 흐려질 본문이
                위에 없다. 그때는 예전처럼 목차 끝에서 끊는다. */}
            {!taste && paywall}

            {/*
              광고에서 들어온 사람에게는 이 버튼을 두지 않는다. 표지에서 끊기로 한
              흐름인데 "1장부터 읽기" 가 있으면 눌러 보고 잠긴 화면을 만나게 된다.
              막힌 문을 두 번 여는 경험은 한 번보다 나쁘다.
            */}
            {!gated && (
              <button type="button" className="btn rv-start" onClick={() => goto(1)}>
                1장부터 읽기 →
              </button>
            )}
          </>
        ) : current ? (
          <>
            {/*
              결제 전에 1장으로 바로 들어오면 표지를 지나치게 된다. 표지에는 명식·지수·
              요약 카드가 있고, 그게 "이 리딩이 내 얘기구나" 를 알려주는 자리다.
              그래서 아직 안 산 사람에게는 그 셋을 1장 맨 위에 세워 준다.
              이미 산 사람에게는 안 보인다 — 한 번 본 것을 매번 다시 지나칠 이유가 없고,
              표지는 아래 바의 '표지'로 언제든 돌아간다.
            */}
            {page === 1 && !unlocked && (
              <>
                <ChartPanel
                  chart={entry.chart}
                  scoreLabel={entry.scoreLabel}
                  score={entry.score}
                  scoreBand={entry.scoreBand}
                />
                {summaryCards.length > 0 && (
                  <section className="rv-summary">
                    <h2>한눈에 보기</h2>
                    <div className="rv-summary-cards">
                      {summaryCards.map((card, index) => (
                        <div key={index}>
                          <small>{card.label}</small>
                          <strong>{card.value}</strong>
                          {card.detail && <p>{card.detail}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* 읽기 시작하는 자리에만 목차를 펼친다. 다른 장에서는 상단 바의 ≡ 가 같은 일을 한다. */}
            {page === 1 && (
              <>
                {outlineOpen ? (
                  <ChapterOutline title={entry.label} items={indexItems} current={page} onJump={goto} />
                ) : (
                  <button type="button" className="rv-outline-toggle" onClick={() => setOutlineOpen(true)}>
                    목차 {total}개 장 펼치기
                  </button>
                )}
                {/* 색이 무슨 뜻인지 — 본문을 읽기 전에 한 번만 */}
                <MarkLegend />
              </>
            )}

            <ChapterPanel chapter={current} />
            <ChapterBody chapter={current} image={imageOf(current.number)} />

            {paywall}

            {unlocked && page === total && (
              <>
                {/* 마지막 장 끝 — 다 읽은 사람만 받는다 */}
                <Talisman image={imageOf(TALISMAN_SLOT)} label={entry.label} />

                {/* 후기는 다음 상품을 권하기 전에 묻는다. 다 읽은 직후가 할 말이
                    남아 있는 유일한 순간이고, 홈에 걸리는 후기는 전부 여기서 온다. */}
                <ReviewPrompt
                  readingId={entry.readingId}
                  userToken={user?.token ?? null}
                  productLabel={entry.label}
                />

                {/* 다음 질문 — 같은 명식에서 갈라지는 두 가지. 폼을 처음부터가
                    아니라 상대 생년월일 한 칸(?from=reading)만 남긴 채로 간다.
                    값은 러빗 하나로 말한다 (2026-08-31 단일 화폐). */}
                {nextReadings.length > 0 && (
                  <section className="report-crosssell">
                    <span className="badge">다음 질문</span>
                    <h2>이 명식으로, 다음은 이게 궁금할 거예요</h2>
                    <p className="report-crosssell-note">
                      내 생년월일은 저장돼 있어요. {nextReadings.some((p) => p.needsPartner) ? "상대 생년월일만 넣으면 바로 나와요." : ""}
                    </p>
                    <div className="report-crosssell-list">
                      {nextReadings.map((p) => (
                        <Link
                          key={p.id}
                          href={`/reading?c=${p.id}&from=reading`}
                          className="report-crosssell-item"
                          data-tone={p.tone}
                        >
                          <span className="report-crosssell-emoji" aria-hidden>{p.emoji}</span>
                          <span className="report-crosssell-copy">
                            <strong>{p.headline}</strong>
                            <small>{p.title} · {p.needsPartner ? "상대 생년월일 한 칸" : "바로 생성"}</small>
                          </span>
                          {nextCost !== null && (
                            <span className="report-crosssell-price">{nextCost}러빗</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
                <ChatSection readingId={entry.readingId} blob={entry.blob} userToken={user?.token ?? null} />
              </>
            )}
          </>
        ) : null}

        {error && <p className="report-error" role="alert">{error}</p>}
        {shareNotice && <p className="rv-notice">{shareNotice}</p>}

        {!unlocked && user && page === 0 && (
          <div className="referral-reward-card">
            <span className="badge">친구 초대 보상</span>
            <h2>친구가 가입하면 {REFERRAL_SIGNUP_CREDITS}러빗을 드려요</h2>
            <p>러빗은 다음 리딩에도, 오늘의 질문에도 바로 쓸 수 있어요.</p>
            <div className="referral-reward-options referral-reward-options-single">
              <button onClick={() => void shareReward()}>
                <strong>{REFERRAL_SIGNUP_CREDITS}러빗</strong>
                <span>친구 1명 가입 시 바로 지급</span>
              </button>
            </div>
            <small>링크 클릭이 아니라 친구의 실제 가입이 완료되어야 지급돼요.</small>
          </div>
        )}

        {page === total && (entry.disclaimer || entry.confidenceNote || entry.demo) && (
          <footer className="rv-footer">
            {entry.confidenceNote && <p>{entry.confidenceNote}</p>}
            {entry.disclaimer && <p>{entry.disclaimer}</p>}
            {entry.demo && <p>⚙️ 데모 모드로 생성된 리딩이에요 (.env에 API 키를 넣으면 실제 AI 리딩이 생성됩니다)</p>}
            <Link href="/my">‹ 내 상담으로</Link>
          </footer>
        )}
      </div>

      <ChapterNavBar
        page={page}
        total={total}
        onPrev={() => goto(page - 1)}
        onNext={() => goto(page + 1)}
        nextHint={page === 0 ? "1장 시작" : page === total ? "끝" : `${page + 1}장`}
      />

      <IndexDrawer
        open={showIndex}
        onClose={() => setShowIndex(false)}
        concept={concept}
        productLabel={entry.label}
        items={indexItems}
        current={page}
        onJump={goto}
      />

      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          reason="전문 리딩을 열려면 로그인이 필요해요"
        />
      )}

      {showContinue && !unlocked && (
        <ContinueSheet
          productId={entry.category}
          label={entry.label}
          price={entry.price}
          openLoop={entry.openLoop}
          seenTitles={(entry.previewSections ?? []).map((section) => section.title)}
          lockedTitles={entry.lockedSectionTitles ?? []}
          scoreLabel={entry.scoreLabel}
          cost={nextCost ?? READING_PRICE_TIERS[0]}
          onContinue={() => {
            setShowContinue(false);
            startUnlock();
          }}
          onClose={() => setShowContinue(false)}
        />
      )}

      {showPay && user && (
        <PaymentModal
          readingId={entry.readingId}
          price={entry.price}
          userToken={user.token}
          customerEmail={user.email}
          depositorCode={depositorCode}
          paying={paying}
          couponsAllowed={!bundleOfReading(entry.category, entry.price)}
          onTransferSubmitted={confirmTransfer}
          onClose={() => setShowPay(false)}
        />
      )}
    </ChapterShell>
  );
}
