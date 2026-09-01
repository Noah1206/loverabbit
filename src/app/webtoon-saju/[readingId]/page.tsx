"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import SajuChart from "@/components/SajuChart";
import SignupModal from "@/components/SignupModal";
import {
  FortuneTabBar,
  FullAnalysisSection,
  LockedFullAnalysisCard,
  LuvitUnlockDialog,
  PreviewAnalysisCard,
  RabbitNarrationCard,
  ShareWebtoonCard,
  WebtoonDisclaimer,
  WebtoonErrorState,
  WebtoonLoadingState,
} from "@/components/webtoon-saju/WebtoonCards";
import { WebtoonPanelViewer } from "@/components/webtoon-saju/WebtoonPanels";
import { useWebtoonReading, useWebtoonUnlock } from "@/components/webtoon-saju/hooks";
import { isFortuneType, WEBTOON_FORTUNE_CONFIG, type FortuneType } from "@/lib/webtoon-saju";

// 웹툰 사주 결과 — form·로그인·계산이 끝난 리딩(readingId)을 웹툰으로 읽는 화면.
//
//   표지·앞 2패널·토끼 해설·핵심 분석은 무료.
//   전체 패널·상세 분석은 운세별 29러빗 — 차감은 서버 원장만 한다.
//   잔액이 부족하면 unlock API 를 부르지 않고 /credits?next=… 로 보낸다.
//   충전을 마치고 돌아오면 ?unlock=운세 로 해금 모달이 다시 열린다.
//
// 주인공은 사용자, 화자는 러브레빗 토끼. 생년월일·시각은 이 화면 어디에도 없다.

export default function WebtoonSajuPage() {
  const params = useParams<{ readingId: string }>();
  const readingId = params?.readingId ?? "";
  const router = useRouter();

  const [fortuneType, setFortuneType] = useState<FortuneType>("money");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  const { reading, status, error, reload, applyServerState, giveUp } = useWebtoonReading(readingId, fortuneType);
  const { unlock, pending, error: unlockError } = useWebtoonUnlock(readingId);

  // 주소의 탭·복귀 상태. useSearchParams 는 Suspense 경계를 요구해서
  // 이 저장소의 다른 화면들처럼 window 에서 직접 읽는다 (credits 페이지와 같은 방식).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("fortune");
    if (isFortuneType(tab)) setFortuneType(tab);
    // 충전에서 돌아온 복귀 — ?unlock=운세 면 그 탭으로 가서 해금 모달을 다시 연다.
    const wanted = params.get("unlock");
    if (isFortuneType(wanted)) {
      setFortuneType(wanted);
      setUnlockOpen(true);
      router.replace(`/webtoon-saju/${readingId}?fortune=${wanted}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "signin") setSignupOpen(true);
  }, [status]);

  const selectFortune = (next: FortuneType) => {
    setFortuneType(next);
    setUnlockOpen(false);
    router.replace(`/webtoon-saju/${readingId}?fortune=${next}`, { scroll: false });
  };

  const goCharge = () => {
    const returnTo = `/webtoon-saju/${readingId}?fortune=${fortuneType}&unlock=${fortuneType}`;
    router.push(`/credits?next=${encodeURIComponent(returnTo)}`);
  };

  async function handleUnlock() {
    if (!reading) return;
    if (reading.luvitBalance < reading.luvitCost) {
      // 잔액 부족 — unlock API 를 부르지 않고 충전으로 보낸다
      goCharge();
      return;
    }
    const outcome = await unlock(fortuneType, reading.luvitCost);
    if (outcome.ok) {
      // 서버 응답의 잔액·패널·본문이 정본 — 클라이언트에서 차감하지 않는다
      applyServerState({
        ...reading,
        unlocked: true,
        luvitBalance: outcome.result.newBalance,
        panels: outcome.result.panels,
        fullText: outcome.result.fullText,
      });
      setUnlockOpen(false);
    } else if (outcome.error === "INSUFFICIENT_LUVIT") {
      goCharge();
    } else if (outcome.error === "SIGNIN_REQUIRED") {
      setSignupOpen(true);
    } else if (outcome.error === "PRICE_CHANGED") {
      void reload();
    }
  }

  if (status === "signin") {
    return (
      <main className="webtoon-saju-page">
        <div className="webtoon-state">
          <p>로그인하면 내 웹툰 사주를 볼 수 있어요.</p>
          <button className="webtoon-cta" onClick={() => setSignupOpen(true)}>
            로그인하고 보기
          </button>
        </div>
        {signupOpen && (
          <SignupModal
            onClose={() => setSignupOpen(false)}
            title="로그인하고 웹툰 보기"
            reason="내 사주 웹툰은 본인만 볼 수 있어요"
            nextPath={`/webtoon-saju/${readingId}?fortune=${fortuneType}`}
          />
        )}
      </main>
    );
  }
  if (status === "loading") return <WebtoonLoadingState onTimeout={giveUp} />;
  if (status === "error" || !reading) return <WebtoonErrorState error={error} onRetry={reload} />;

  const isUnlocked = reading.unlocked;
  const label = WEBTOON_FORTUNE_CONFIG[fortuneType].label;

  return (
    <main className="webtoon-saju-page">
      <header className="webtoon-header">
        <button onClick={() => router.back()} aria-label="뒤로 가기" className="webtoon-back">
          ←
        </button>
        <div className="webtoon-brand">
          <img src="/logo.png" alt="LoveRabbit" />
          <span>웹툰 사주</span>
        </div>
        <Link href="/credits" className="webtoon-balance">
          {reading.luvitBalance} 러빗
        </Link>
      </header>

      <div className="webtoon-main">
        <FortuneTabBar value={fortuneType} onChange={selectFortune} />

        <section className="webtoon-hero">
          <p className="webtoon-eyebrow">LOVERABBIT ORIGINAL READING</p>
          <h1>
            {reading.subjectNickname}님의 {label}이<br />한 편의 이야기로 펼쳐졌어요.
          </h1>
          <img
            className="webtoon-cover"
            src={reading.coverImageUrl}
            alt={`${reading.subjectNickname}님의 ${label} 웹툰 표지`}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        </section>

        {/* 내 명식 — 이 글이 무엇을 보고 쓰였는지 먼저 보인다. 폼에 넣은 값이
            실제로 쓰였다는 것을 표로 확인시킨다 (없으면 그리지 않는다). */}
        {reading.chart && (
          <SajuChart
            chart={reading.chart}
            name={`${reading.subjectNickname}님의 명식`}
            birthLine={reading.birthLine ?? undefined}
          />
        )}

        <RabbitNarrationCard text={reading.previewText} />
        <WebtoonPanelViewer panels={reading.panels} unlocked={isUnlocked} />
        <PreviewAnalysisCard reading={reading} />
        {!isUnlocked && <LockedFullAnalysisCard cost={reading.luvitCost} onUnlock={() => setUnlockOpen(true)} />}
        {isUnlocked && <FullAnalysisSection reading={reading} />}
        <ShareWebtoonCard fortuneType={fortuneType} />
        <WebtoonDisclaimer />
      </div>

      <LuvitUnlockDialog
        open={unlockOpen}
        balance={reading.luvitBalance}
        cost={reading.luvitCost}
        pending={pending}
        error={unlockError}
        onCancel={() => setUnlockOpen(false)}
        onConfirm={handleUnlock}
        onCharge={goCharge}
      />
      {signupOpen && (
        <SignupModal
          onClose={() => {
            setSignupOpen(false);
            void reload();
          }}
          title="로그인하고 웹툰 보기"
          reason="내 사주 웹툰은 본인만 볼 수 있어요"
          nextPath={`/webtoon-saju/${readingId}?fortune=${fortuneType}`}
        />
      )}
    </main>
  );
}
