"use client";

import Link from "next/link";

import RabbitLoader from "@/components/RabbitLoader";

import type { FortuneType } from "@/lib/webtoon-saju";
import { buildShareText, FORTUNE_TYPES, WEBTOON_FORTUNE_CONFIG } from "@/lib/webtoon-saju";
import type { WebtoonReadingState } from "./hooks";

// 웹툰 사주 화면의 카드 모음 — 탭, 토끼 해설, 미리보기 분석, 잠금 CTA,
// 해금 모달, 공유, 안내문. 화면 하나에서만 쓰는 조각이라 한 파일에 둔다.

export function FortuneTabBar({
  value,
  onChange,
}: {
  value: FortuneType;
  onChange: (next: FortuneType) => void;
}) {
  return (
    <div className="webtoon-tabbar" role="tablist" aria-label="운세 선택">
      {FORTUNE_TYPES.map((type) => (
        <button
          key={type}
          role="tab"
          aria-selected={value === type}
          className={`webtoon-tab${value === type ? " is-active" : ""}`}
          onClick={() => onChange(type)}
        >
          {WEBTOON_FORTUNE_CONFIG[type].label}
        </button>
      ))}
    </div>
  );
}

export function RabbitNarrationCard({ text }: { text: string }) {
  return (
    <section className="webtoon-narration" aria-label="토끼 해설">
      <img src="/logo.png" alt="" aria-hidden="true" className="webtoon-narration-face" />
      <div>
        <p className="webtoon-narration-name">러브레빗</p>
        <p className="webtoon-narration-text">{text}</p>
      </div>
    </section>
  );
}

export function PreviewAnalysisCard({ reading }: { reading: WebtoonReadingState }) {
  return (
    <section className="webtoon-card" aria-label="핵심 분석">
      <h2>이번 {WEBTOON_FORTUNE_CONFIG[reading.fortuneType].label}의 핵심</h2>
      <ul className="webtoon-points">
        {reading.previewPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}

export function FullAnalysisSection({ reading }: { reading: WebtoonReadingState }) {
  if (!reading.fullText?.length) return null;
  return (
    <section className="webtoon-card webtoon-full" aria-label="상세 분석">
      <h2>{WEBTOON_FORTUNE_CONFIG[reading.fortuneType].label} 상세 분석</h2>
      {reading.fullText.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </section>
  );
}

export function LockedFullAnalysisCard({ cost, onUnlock }: { cost: number; onUnlock: () => void }) {
  return (
    <section className="webtoon-card webtoon-locked-card" aria-label="상세 분석 잠금">
      <h2>전체 웹툰과 상세 분석</h2>
      <p>남은 패널과 흐름별 상세 분석이 기다리고 있어요.</p>
      <button className="webtoon-cta" onClick={onUnlock}>
        {cost}러빗으로 전체 보기
      </button>
    </section>
  );
}

export function LuvitUnlockDialog({
  open,
  balance,
  cost,
  pending,
  error,
  onCancel,
  onConfirm,
  onCharge,
}: {
  open: boolean;
  balance: number;
  cost: number;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onCharge: () => void;
}) {
  if (!open) return null;
  const enough = balance >= cost;
  return (
    <div className="webtoon-dialog-backdrop" role="dialog" aria-modal="true" aria-label="러빗으로 해금">
      <div className="webtoon-dialog">
        <h3>전체 웹툰 열기</h3>
        <p className="webtoon-dialog-cost">
          {cost}러빗 <span>· 내 잔액 {balance}러빗</span>
        </p>
        {!enough && <p className="webtoon-dialog-warn">러빗이 부족해요. 충전 후 이어서 볼 수 있어요.</p>}
        {error === "INSUFFICIENT_LUVIT" && (
          <p className="webtoon-dialog-warn">잔액이 부족해요. 충전 후 다시 시도해 주세요.</p>
        )}
        {error && error !== "INSUFFICIENT_LUVIT" && (
          <p className="webtoon-dialog-warn">해금하지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        )}
        <div className="webtoon-dialog-actions">
          <button className="webtoon-btn-soft" onClick={onCancel} disabled={pending}>
            다음에
          </button>
          {enough ? (
            <button className="webtoon-cta" onClick={onConfirm} disabled={pending}>
              {pending ? "여는 중…" : `${cost}러빗으로 열기`}
            </button>
          ) : (
            <button className="webtoon-cta" onClick={onCharge}>
              러빗 충전하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShareWebtoonCard({ fortuneType }: { fortuneType: FortuneType }) {
  // 공유에는 리딩 id·생년월일이 안 들어간다 — 결과는 본인만 열 수 있어 링크는 홈으로.
  const share = async () => {
    const { text, path } = buildShareText(fortuneType);
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title: "러브레빗 웹툰 사주", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {
      /* 사용자가 공유 시트를 닫음 */
    }
  };
  return (
    <section className="webtoon-card webtoon-share" aria-label="공유">
      <p>내 {WEBTOON_FORTUNE_CONFIG[fortuneType].label} 웹툰, 친구에게도 보여줄까요?</p>
      <button className="webtoon-btn-soft" onClick={share}>
        공유하기
      </button>
    </section>
  );
}

export function WebtoonDisclaimer() {
  return (
    <p className="webtoon-disclaimer">
      이 콘텐츠는 재미와 마음 돌봄을 위한 이야기예요. 중요한 결정은 언제나 스스로의 판단으로 내려 주세요.
    </p>
  );
}

export function WebtoonLoadingState({ onTimeout }: { onTimeout?: () => void }) {
  /* 예전에는 여기 갇혔다 — 응답이 안 오면 스피너만 돌고 나갈 버튼이 없었다.
     20초가 지나면 부르는 쪽이 에러 화면으로 넘긴다(거기엔 재시도·홈이 있다). */
  return (
    <main className="webtoon-saju-page">
      <RabbitLoader
        message="토끼가 이야기를 펼치는 중이에요"
        sub="잠시만 기다려 주세요."
        timeoutMs={onTimeout ? 20_000 : 0}
        onTimeout={onTimeout}
      />
    </main>
  );
}

export function WebtoonErrorState({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  return (
    <main className="webtoon-saju-page">
      <div className="webtoon-state" role="alert">
        <p>{error ?? "웹툰을 불러오지 못했어요."}</p>
        <button className="webtoon-cta" onClick={onRetry}>
          다시 시도
        </button>
        <Link className="webtoon-btn-soft" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
