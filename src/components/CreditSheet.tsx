"use client";

import { useEffect, useMemo, useState } from "react";

import { CREDIT_PACKS, bonusOf, type CreditPack } from "@/lib/credits";
import { useEscape } from "@/lib/use-escape";

/*
  충전 시트 — 모자란 만큼만 그 자리에서.

  전에는 러빗이 모자라면 /credits 로 보냈다. 그 화면은 충전만 하는 곳이라,
  사고 나서 원래 보려던 것으로 **돌아와야** 한다 — 그 사이에 한 번 더 결심할
  자리가 생기고 거기서 사람이 빠진다.

  여기는 시트다. 보려던 것과 값이 그대로 보이는 채로 결제하고, 끝나면 그
  자리에서 열린다.

  **모자란 만큼을 채우는 가장 작은 팩이 미리 골라져 있다.** 고르는 일을 시키지
  않는다 — 어차피 지금 필요한 것은 정해져 있고, 사람이 고를 여지는 "더 살까"
  뿐이다. 그래서 나머지 팩은 접어 두고 "다른 충전량 보기" 로 편다.
*/

export interface CreditSheetProps {
  open: boolean;
  onClose: () => void;
  /** 무엇을 보려고 하는가 — 시트 맨 위에 그대로 적는다 */
  itemLabel: string;
  /** 그것에 드는 러빗 */
  cost: number;
  /** 지금 가진 러빗 */
  balance: number;
  userEmail: string;
  userToken: string;
  /** 결제를 마치고 돌아올 곳 */
  redirectPath: string;
}

export default function CreditSheet({
  open,
  onClose,
  itemLabel,
  cost,
  balance,
  userEmail,
  userToken,
  redirectPath,
}: CreditSheetProps) {
  const short = Math.max(0, cost - balance);

  /**
   * 모자란 만큼을 채우는 가장 작은 팩. 그것도 모자라면 가장 큰 팩을 고른다 —
   * 한 번에 다 못 채우는 경우가 있어도 화면이 비지 않게 한다.
   */
  const suggested = useMemo(() => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.price - b.price);
    return sorted.find((p) => p.credits >= short) ?? sorted[sorted.length - 1];
  }, [short]);

  const [pack, setPack] = useState<CreditPack>(suggested);
  const [expanded, setExpanded] = useState(false);

  // 필요한 양이 달라지면 추천도 다시 고른다 (다른 상품을 열려 할 때)
  useEffect(() => setPack(suggested), [suggested]);

  useEscape(onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const others = CREDIT_PACKS.filter((p) => p.id !== pack.id);

  return (
    <div className="cs-backdrop" role="dialog" aria-modal="true" aria-label="러빗 충전" onClick={onClose}>
      <div className="cs-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cs-close" onClick={onClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <h2 className="cs-title">러빗이 조금 모자라요</h2>

        <div className="cs-lines">
          <div>
            <span>{itemLabel}</span>
            <b>{cost}러빗</b>
          </div>
          <div>
            <span>내 러빗</span>
            <b>{balance}러빗</b>
          </div>
          <div className="cs-short">
            <span>모자란 만큼</span>
            <b>{short}러빗</b>
          </div>
        </div>

        {/* 고른 팩 — 모자란 만큼을 채우는 가장 작은 것이 미리 서 있다 */}
        <div className="cs-pack is-on">
          <span className="cs-pack-name">
            {pack.name}
            <i>{pack.credits}러빗</i>
            {bonusOf(pack) > 0 && <b className="cs-pack-bonus">+{bonusOf(pack)}</b>}
          </span>
          <span className="cs-pack-price">{pack.price.toLocaleString()}원</span>
        </div>

        {!expanded ? (
          <button type="button" className="cs-more" onClick={() => setExpanded(true)}>
            다른 충전량 보기 <i aria-hidden>⌄</i>
          </button>
        ) : (
          <div className="cs-others">
            {others.map((p) => (
              <button key={p.id} type="button" className="cs-pack" onClick={() => setPack(p)}>
                <span className="cs-pack-name">
                  {p.name}
                  <i>{p.credits}러빗</i>
                  {bonusOf(p) > 0 && <b className="cs-pack-bonus">+{bonusOf(p)}</b>}
                </span>
                <span className="cs-pack-price">{p.price.toLocaleString()}원</span>
              </button>
            ))}
          </div>
        )}

        <div className="cs-pay">
          {/* 충전은 충전 화면에서 한다 — 시트는 길만 낸다. */}
          <a className="btn" href={`/credits?next=${encodeURIComponent(redirectPath)}`}>
            충전하러 가기
          </a>
        </div>

        <p className="cs-note">충전한 러빗은 사주·타로 어디에나 쓸 수 있어요.</p>
      </div>
    </div>
  );
}
