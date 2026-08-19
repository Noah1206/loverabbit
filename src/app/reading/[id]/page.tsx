"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ChatSection from "@/components/ChatSection";
import PaymentModal from "@/components/PaymentModal";
import SignupModal from "@/components/SignupModal";
import { listArchive, updateArchive, type ArchiveEntry } from "@/lib/archive";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/products";
import { savePendingReading, takePendingReading } from "@/lib/pending-reading";
import { parseReportSections, readingMinutes, summaryPoints } from "@/lib/reading-report";
import { getUser, saveUser, type User } from "@/lib/user";
import BrandMark from "@/components/BrandMark";

interface ReferralStatus {
  referralCode: string;
  chatCredits: number;
  readingUnlocked: boolean;
}

// 리딩 결과 전용 기사 페이지.
// 폼(/reading)에서 결과가 나오면 이 주소로 이동해, 카드 안에 눌러 담지 않고
// 제목 - 한눈에 보기 - 목차 - 본문 순서로 길게 읽히도록 편집한다.
export default function ReadingReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    const found = listArchive().find((item) => item.readingId === id) ?? null;
    setEntry(found);
    setStatus(found ? "ready" : "missing");

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "approved") {
      setNotice("결제가 승인됐어요. 아래에서 전문을 확인하세요.");
    }

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

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [status]);

  const unlocked = Boolean(entry?.full);
  const sections = useMemo(
    () => (entry?.full ? parseReportSections(entry.full) : []),
    [entry?.full]
  );
  const points = useMemo(() => summaryPoints(entry?.teaser ?? ""), [entry?.teaser]);

  // 다음 리딩 추천 — 방금 본 것보다 비싼 상품 중에서,
  // 혼자 본 리딩 뒤에는 '그 사람'이 필요한 리딩을 먼저 올린다.
  const nextReadings = useMemo(() => {
    const current = PRODUCT_MAP[entry?.category ?? ""];
    if (!current) return [];
    // 혼자 본 리딩 뒤에는 상대가 필요한 리딩을 앞세우고,
    // 이미 상대까지 본 리딩 뒤에는 인기·가격 순서만 따른다.
    const rank = (p: (typeof PRODUCTS)[number]) => [
      current.needsPartner || p.needsPartner ? 0 : 1,
      p.tags.includes("popular") ? 0 : 1,
      p.price,
    ];
    return PRODUCTS.filter((p) => p.id !== current.id && p.price > current.price)
      .sort((a, b) => {
        const [ra, rb] = [rank(a), rank(b)];
        return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
      })
      .slice(0, 3);
  }, [entry?.category]);
  const summaryCards = entry?.summaryCards ?? [];
  const previewSections = entry?.previewSections ?? [];
  const lockedTitles = entry?.lockedSectionTitles ?? [];

  // 미리보기는 첫 대목만 읽히고, 그 아래는 흐려지며 끊긴다.
  // 섹션별로 군데군데 가리는 것보다, 한 번에 잘리는 쪽이 "여기서부터 전문"이라는 경계가 분명하다.
  const [openSection, ...tailSections] = previewSections;
  const cutoffSections = [
    ...tailSections.map((section) => ({ title: section.title, excerpt: section.excerpt })),
    ...lockedTitles.map((title) => ({ title, excerpt: "" })),
  ];

  // 목차 앵커는 본문 섹션의 실제 순번을 그대로 따라간다(제목 없는 리드 문단이 있어도 어긋나지 않게)
  const toc = unlocked
    ? sections
        .map((section, index) => ({ title: section.title, index, locked: false }))
        .filter((item) => item.title)
    : [
        ...previewSections.map((section, index) => ({ title: section.title, index, locked: false })),
        ...lockedTitles.map((title) => ({ title, index: -1, locked: true })),
      ];

  const depositorCode = entry ? `레빗-${entry.readingId.slice(0, 4).toUpperCase()}` : "";

  const startUnlock = () => {
    if (!entry) return;
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
          previewSections,
          lockedSectionTitles: lockedTitles,
          scoreLabel: entry.scoreLabel ?? null,
          demo: entry.demo === true,
        },
      });
      setShowSignup(true);
      return;
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><BrandMark size={52} /></div>
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

  return (
    <main className="report-page">
      <div className="report-progress" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <article className="report-article">
        <nav className="report-crumbs">
          <Link href="/my">‹ 내 상담</Link>
          <span>{unlocked ? "전문 공개" : "무료 미리보기"}</span>
        </nav>

        <header className="report-head">
          <span className="report-kicker">{entry.label}</span>
          <h1>{points[0] ?? entry.label}</h1>
          <p className="report-dek">
            {entry.chart.partner
              ? "두 사람의 명식을 교차로 읽고, 흐름이 갈라지는 지점을 정리했어요."
              : "당신의 명식에서 반복되는 패턴과 다음 흐름을 정리했어요."}
          </p>
          <div className="report-meta">
            <span>{createdAt.toLocaleDateString("ko-KR")}</span>
            <span>·</span>
            <span>약 {minutes}분 분량</span>
            <span>·</span>
            <span className={unlocked ? "report-state on" : "report-state"}>
              {unlocked ? "🔓 전문" : entry.pendingOrderId ? "⏳ 입금 승인 대기" : "🔒 미리보기"}
            </span>
          </div>
          <dl className="report-chart">
            <div>
              <dt>내 사주</dt>
              <dd>{entry.chart.me}</dd>
            </div>
            {entry.chart.partner && (
              <div>
                <dt>그 사람</dt>
                <dd>{entry.chart.partner}</dd>
              </div>
            )}
          </dl>
        </header>

        {notice && <p className="report-notice">{notice}</p>}

        <section className="report-summary" aria-label="한눈에 보기">
          <h2>한눈에 보기</h2>
          {summaryCards.length > 0 ? (
            <div className="report-cards">
              {summaryCards.map((card, index) => (
                <div key={index} className="report-card">
                  <small>{card.label}</small>
                  <strong>{card.value}</strong>
                  {card.detail && <p>{card.detail}</p>}
                </div>
              ))}
            </div>
          ) : (
            <ul>
              {points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}
          {entry.scoreLabel && (
            <div className="report-score">
              <span>🔮 {entry.scoreLabel}</span>
              {typeof entry.score === "number" ? (
                <strong>상위 {100 - entry.score}%</strong>
              ) : (
                <strong className="locked">상위 ??% 🔒</strong>
              )}
            </div>
          )}
        </section>

        {toc.length > 0 && (
          <nav className="report-toc" aria-label="목차">
            <strong>목차</strong>
            <ol>
              {toc.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  {unlocked ? (
                    <a href={`#section-${item.index}`}>{item.title}</a>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {unlocked ? (
          <div className="report-body">
            {sections.map((section, index) => (
              <section key={`${section.title}-${index}`} id={`section-${index}`}>
                {section.title && (
                  <h2>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    {section.title}
                  </h2>
                )}
                {section.paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="report-body report-body-locked">
            {openSection && (
              <section id="section-0">
                <h2>
                  <small>01</small>
                  {openSection.title}
                </h2>
                <p>{openSection.excerpt}</p>
              </section>
            )}

            {/* 여기서부터 끊긴다 — 읽히지 않게 흐려지고, 아래로 갈수록 사라진다 */}
            {cutoffSections.length > 0 && (
              <div className="report-cutoff" aria-hidden>
                {cutoffSections.map((section, index) => (
                  <section key={`${section.title}-${index}`}>
                    <h2>
                      <small>{String(index + 2).padStart(2, "0")}</small>
                      {section.title}
                    </h2>
                    {section.excerpt ? (
                      <p>{section.excerpt}</p>
                    ) : (
                      <div className="preview-blur-lines">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}

            <div className="report-paywall">
              <strong>결론·정확한 시기·행동 가이드는 전문에 있어요</strong>
              <p>점집 1회 5만원보다 가볍게, 한 번 결제로 계속 보관돼요.</p>
              {entry.pendingOrderId ? (
                <Link className="btn" href={`/payment/pending?orderId=${entry.pendingOrderId}`}>
                  입금 승인 상태 확인 →
                </Link>
              ) : (
                <button className="btn" onClick={startUnlock} disabled={paying}>
                  {paying
                    ? "결제 준비 중…"
                    : user
                      ? `결제하고 전문 보기 — ${entry.price.toLocaleString()}원`
                      : `로그인 후 전문 보기 — ${entry.price.toLocaleString()}원`}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="report-error" role="alert">{error}</p>}

        {!unlocked && user && (
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
            {shareNotice && <p className="referral-notice">{shareNotice}</p>}
          </div>
        )}

        {unlocked && nextReadings.length > 0 && (
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

        {unlocked && <ChatSection readingId={entry.readingId} blob={entry.blob} />}

        {(entry.disclaimer || entry.confidenceNote || entry.demo) && (
          <footer className="report-footer">
            {entry.confidenceNote && <p className="report-note">{entry.confidenceNote}</p>}
            {entry.disclaimer && <p className="report-note">{entry.disclaimer}</p>}
            {entry.demo && (
              <p className="report-demo">⚙️ 데모 모드로 생성된 리딩이에요 (.env에 API 키를 넣으면 실제 AI 리딩이 생성됩니다)</p>
            )}
          </footer>
        )}
      </article>

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
    </main>
  );
}
