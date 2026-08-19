"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ChatSection from "@/components/ChatSection";
import PaymentModal from "@/components/PaymentModal";
import {
  landingTypeForProduct,
  trackInitiateCheckout,
  trackResultUnlockClicked,
} from "@/lib/meta-events";
import SignupModal from "@/components/SignupModal";
import { listArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/products";
import { savePendingReading, takePendingReading } from "@/lib/pending-reading";
import { parseReportSections, readingMinutes, summaryPoints } from "@/lib/reading-report";
import { buildChapters, previewPieces, type ReadingChapter } from "@/lib/reading-chapters";
import { conceptFor } from "@/lib/reading-concepts";
import {
  ChapterBody,
  ChapterIndex,
  ChapterNavBar,
  ChapterPanel,
  ChapterShell,
  ChapterTopBar,
  ChartPanel,
  IndexDrawer,
  ScoreBreakdown,
  Seal,
  type IndexItem,
} from "@/components/ReadingChapters";
import { getUser, saveUser, type User } from "@/lib/user";

interface ReferralStatus {
  referralCode: string;
  chatCredits: number;
  readingUnlocked: boolean;
}

// 리딩 결과 뷰어 — 웹툰처럼 장(章)마다 한 페이지씩 넘겨 읽는다.
//   0쪽: 표지 + 명식 + 한눈에 보기 + 목차
//   1..N쪽: 각 장 (화자 컷 -> 절별 본문)
//   마지막 쪽: 화자의 마지막 편지 + 다음 리딩 + 추가 상담
// 분야별로 달라지는 것은 화자·인장·색·장 제목뿐이고(reading-concepts.ts),
// 구조와 잠금 규칙은 모든 리딩이 똑같이 쓴다.
export default function ReadingReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    const found = listArchive().find((item) => item.readingId === id) ?? null;
    setEntry(found);
    setStatus(found ? "ready" : "missing");

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "approved") {
      setNotice("결제가 승인됐어요. 첫 장부터 끝 장까지 전부 열렸어요.");
    }
    // 주소에 쪽 번호가 있으면 그 장부터 — 공유한 링크가 같은 자리를 연다
    const wanted = Number(params.get("p"));
    if (Number.isInteger(wanted) && wanted > 0) setPage(wanted);

    // 결제하려다 로그인으로 빠졌던 경우, 돌아오자마자 결제창을 다시 띄운다
    const pending = takePendingReading();
    if (found && stored && !found.full && pending?.result.readingId === id) {
      setShowPay(true);
    }
    if (stored?.referralCode) {
      setReferralStatus({
        referralCode: stored.referralCode,
        chatCredits: stored.chatCredits ?? 0,
        readingUnlocked: false,
      });
    }
  }, [id]);

  const unlocked = Boolean(entry?.full);
  const product = PRODUCT_MAP[entry?.category ?? ""];
  const concept = conceptFor(entry?.category);
  const points = useMemo(() => summaryPoints(entry?.teaser ?? ""), [entry?.teaser]);

  const chapters: ReadingChapter[] = useMemo(() => {
    if (!entry) return [];
    const pieces = entry.full
      ? parseReportSections(entry.full).map((section) => ({
          title: section.title,
          paragraphs: section.paragraphs,
        }))
      : previewPieces(entry.previewSections ?? [], entry.lockedSectionTitles ?? []);
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
    return PRODUCTS.filter((p) => p.id !== product.id && p.price > product.price)
      .sort((a, b) => {
        const [ra, rb] = [rank(a), rank(b)];
        return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
      })
      .slice(0, 3);
  }, [product]);

  const depositorCode = entry ? `레빗-${entry.readingId.slice(0, 4).toUpperCase()}` : "";

  const startUnlock = () => {
    if (!entry) return;
    // 잠금 해제 CTA 클릭 — 광고 랜딩에서 온 상품일 때만 landing_type을 붙인다.
    const unlockLanding = landingTypeForProduct(entry.category, entry.offerId);
    if (unlockLanding) trackResultUnlockClicked(unlockLanding);
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
      setShowSignup(true);
      return;
    }
    const checkoutLanding = landingTypeForProduct(entry.category, entry.offerId);
    if (checkoutLanding) {
      trackInitiateCheckout({ value: entry.price, landingType: checkoutLanding });
    }
    setShowPay(true);
  };

  const confirmTransfer = async () => {
    if (!entry) return;
    setPaying(true);
    setError("");
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
    const nextUser = { ...user, referralCode: next.referralCode, chatCredits: next.chatCredits };
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
      const params = new URLSearchParams({ ref: state.referralCode, reward: "chat_credits" });
      const url = `${window.location.origin}/reading?${params.toString()}`;
      const text = "러브레빗 캐릭터챗 같이 해보자. 가입하면 무료 사주 10문장도 볼 수 있어 🐰";
      if (navigator.share) {
        await navigator.share({ title: "러브레빗 무료 사주", text, url });
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
    return (
      <main className="container report-page">
        <div className="auth-loader" aria-label="리딩 불러오는 중" />
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

  const minutes = readingMinutes(entry.teaser, entry.full);
  const createdAt = new Date(entry.createdAt);
  const summaryCards = entry.summaryCards ?? [];

  const paywall = !unlocked && (
    <div className="rv-paywall">
      <strong>
        {entry.offerId ? "무료 운명 미리보기는 여기까지예요" : "결론·정확한 시기·행동 가이드는 전문에 있어요"}
      </strong>
      <p>
        {entry.offerId
          ? "결론·정확한 시기·행동 가이드까지 끝까지 보고 싶을 때만 990원을 결제하세요."
          : `${total}개 장 전부가 한 번의 결제로 열리고, 이 기기에 계속 보관돼요.`}
      </p>
      {entry.pendingOrderId ? (
        <Link className="btn" href={`/payment/pending?orderId=${entry.pendingOrderId}`}>
          입금 승인 상태 확인 →
        </Link>
      ) : (
        <button className="btn" onClick={startUnlock} disabled={paying}>
          {paying
            ? "결제 준비 중…"
            : user
              ? `${entry.price.toLocaleString()}원으로 끝까지 보기`
              : `로그인 후 ${entry.price.toLocaleString()}원으로 끝까지 보기`}
        </button>
      )}
    </div>
  );

  return (
    <ChapterShell concept={concept}>
      <ChapterTopBar
        concept={concept}
        kicker={page === 0 ? `${concept.shrine} · ${concept.narrator}` : `${entry.label} · ${concept.shrine}`}
        title={current ? `${current.label}. ${current.title}` : entry.label}
        onOpenIndex={() => setShowIndex(true)}
        onShare={() => void shareReading()}
      />

      <div className="rv-scroll">
        {notice && <p className="rv-notice">{notice}</p>}

        {page === 0 ? (
          <>
            {/* 표지 — 어떤 리딩을 손에 쥐었는지 한 화면에 담는다 */}
            <section className="rv-cover">
              <div className="rv-cover-art" style={{ backgroundImage: `url(${concept.portrait})` }} aria-hidden />
              <div className="rv-cover-copy">
                <Seal concept={concept} size={46} />
                <small>{concept.cover}</small>
                <h1>{entry.label}</h1>
                <p>{points[0] ?? concept.shrine}</p>
                <span className="rv-cover-meta">
                  {createdAt.toLocaleDateString("ko-KR")} · 약 {minutes}분 · {total}개 장
                  {unlocked ? " · 🔓 전문" : entry.pendingOrderId ? " · ⏳ 승인 대기" : " · 🔒 미리보기"}
                </span>
              </div>
            </section>

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
                <small>{concept.narrator}가 읽어주는 {total}개 장</small>
              </h2>
              <ChapterIndex items={indexItems} current={page} onJump={goto} />
            </section>

            {paywall}

            <button type="button" className="btn rv-start" onClick={() => goto(1)}>
              1장부터 읽기 →
            </button>
          </>
        ) : current ? (
          <>
            <ChapterPanel
              concept={concept}
              chapter={current}
              hook={
                current.kind === "epilogue"
                  ? concept.outro
                  : (concept.hooks[page - 1] ?? concept.outro)
              }
            />
            <ChapterBody chapter={current} />

            {paywall}

            {unlocked && page === total && (
              <>
                {nextReadings.length > 0 && (
                  <section className="report-crosssell">
                    <span className="badge">이 리딩 다음에</span>
                    <h2>여기까지 봤다면, 다음은 이거예요</h2>
                    <div className="report-crosssell-list">
                      {nextReadings.map((p) => (
                        <Link key={p.id} href={`/product/${p.id}`} className="report-crosssell-item" data-tone={p.tone}>
                          <span className="report-crosssell-emoji" aria-hidden>{p.emoji}</span>
                          <span className="report-crosssell-copy">
                            <strong>{p.title}</strong>
                            <small>{p.ctaHook}</small>
                          </span>
                          <span className="report-crosssell-price">{p.price.toLocaleString()}원</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
                <ChatSection readingId={entry.readingId} blob={entry.blob} />
              </>
            )}
          </>
        ) : null}

        {error && <p className="report-error" role="alert">{error}</p>}
        {shareNotice && <p className="rv-notice">{shareNotice}</p>}

        {!unlocked && user && page === 0 && (
          <div className="referral-reward-card">
            <span className="badge">친구 초대 보상</span>
            <h2>친구가 가입하면 추가 상담권을 드려요</h2>
            <p>전문 리딩은 결제 후 열리고, 친구 초대 보상은 추가 질문에 사용할 수 있어요.</p>
            <div className="referral-reward-options referral-reward-options-single">
              <button onClick={() => void shareReward()}>
                <strong>캐릭터챗 질문권 10장</strong>
                <span>친구 1명 가입 시 바로 적립</span>
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
          onDone={(nextUser) => {
            setUser(nextUser);
            setShowSignup(false);
            setShowPay(true);
          }}
          onClose={() => setShowSignup(false)}
          reason="전문 리딩을 열려면 로그인이 필요해요"
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
          onTransferSubmitted={confirmTransfer}
          onClose={() => setShowPay(false)}
        />
      )}
    </ChapterShell>
  );
}
