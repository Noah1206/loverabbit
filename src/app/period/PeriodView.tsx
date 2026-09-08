"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import RabbitLoader from "@/components/RabbitLoader";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { DOMAIN_LABEL, type FortuneDomain } from "@/lib/daily-action";
import type { Period, PeriodFortune } from "@/lib/period-fortune";
import { getUser, type User } from "@/lib/user";

/*
  이번 주 · 이번 달.

  오늘의 사주가 "오늘 할 행동 하나" 라면 여기는 "이 기간의 결" 이다. 주와
  달은 행동 하나로 끝나는 단위가 아니라서, 무엇이 유리한 국면인지와 무엇을
  미루는 편이 나은지를 말한다.

  여덟 영역을 한 번에 펴 두고 접었다 폈다 하게 둔다 — 오늘의 사주처럼 하나를
  고르게 하면, 나머지 일곱을 보려고 매번 다시 고르는 화면이 된다. 기간 운세는
  훑는 것이 목적이다.
*/

const DOMAIN_EMOJI: Record<FortuneDomain, string> = {
  love: "💗",
  money: "🪙",
  study: "📚",
  career: "🧭",
  business: "🏭",
  relationship: "🤝",
  health: "🌿",
  growth: "🌱",
};

export default function PeriodView() {
  const [user, setUser] = useState<User | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [items, setItems] = useState<PeriodFortune[] | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<FortuneDomain | null>("love");

  useEffect(() => {
    setUser(getUser());
  }, []);

  const load = useCallback(
    async (p: Period, token: string) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/period-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: token, period: p }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          items?: PeriodFortune[];
          needsProfile?: boolean;
          error?: string;
        };
        if (data.needsProfile) {
          setNeedsProfile(true);
          setItems(null);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "운세를 불러오지 못했어요.");
        setItems(data.items ?? []);
        setNeedsProfile(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "운세를 불러오지 못했어요.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!user) return;
    void load(period, user.token);
  }, [user, period, load]);

  // ── 로그인 전 ──
  if (!user) {
    return (
      <main className="container pf" style={{ paddingTop: 40, paddingBottom: 110 }}>
        <span className="badge">무료</span>
        <h1 className="pf-h1">이번 주·이번 달 운세</h1>
        <p className="pf-lede">
          내 일간과 이 기간의 기운이 어떤 관계인지로 흐름을 읽어요. 연애·재물·일·건강까지
          여덟 영역을 한 번에 봅니다.
        </p>
        <div className="card" style={{ padding: 20, marginTop: 18 }}>
          <p style={{ marginBottom: 14, fontSize: "0.9rem", color: "var(--text-dim)" }}>
            사주 정보가 있어야 흐름을 잴 수 있어요. 로그인하면 저장된 정보로 바로 나와요.
          </p>
          <SocialLoginButtons nextPath="/period" />
        </div>
      </main>
    );
  }

  return (
    <main className="container pf" style={{ paddingTop: 32, paddingBottom: 110 }}>
      <span className="badge">무료</span>
      <h1 className="pf-h1">{period === "week" ? "이번 주" : "이번 달"} 운세</h1>

      {/* 주/달 전환 */}
      <div className="pf-tabs" role="tablist" aria-label="기간">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={period === p}
            className={`pf-tab${period === p ? " on" : ""}`}
            onClick={() => setPeriod(p)}
          >
            {p === "week" ? "이번 주" : "이번 달"}
          </button>
        ))}
      </div>

      {items && items[0] && (
        <p className="pf-range">
          {items[0].rangeLabel}
          {/* 무엇으로 잰 것인지 밝힌다 — 주를 대표하는 간지가 명리에 따로 없어
              첫날의 일진을 쓴다는 선택을 감추지 않는다 */}
          <small>
            {items[0].basis.dayMaster} 일간 · {items[0].basis.pillarLabel} {items[0].basis.pillar}
          </small>
        </p>
      )}

      {needsProfile && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <p style={{ fontSize: "0.92rem", marginBottom: 12 }}>
            사주 정보를 넣으면 이번 주 흐름을 만들 수 있어요.
          </p>
          <Link className="btn" href="/profile?next=/period">
            사주 정보 입력하기
          </Link>
        </div>
      )}

      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}

      {busy && !items && <RabbitLoader message="이 기간의 흐름을 보고 있어요" sub="잠시만요." />}

      {items && (
        <ul className="pf-list">
          {items.map((f) => {
            const isOpen = open === f.domain;
            return (
              <li key={f.domain} className={`pf-item${isOpen ? " on" : ""}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : f.domain)}
                >
                  <span className="pf-item-emoji" aria-hidden>
                    {DOMAIN_EMOJI[f.domain]}
                  </span>
                  <span className="pf-item-copy">
                    <small>{DOMAIN_LABEL[f.domain]}</small>
                    <strong>{f.copy.headline}</strong>
                  </span>
                  <span className="pf-item-go" aria-hidden>
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="pf-body">
                    <p className="pf-flow">{f.copy.flowNote}</p>
                    <p className="pf-focus">
                      <b>두면 좋은 것</b>
                      {f.copy.focus}
                    </p>
                    <p className="pf-hold">
                      <b>미뤄도 되는 것</b>
                      {f.copy.hold}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="pf-note">
        결과는 재미와 자기성찰을 위한 콘텐츠예요. 실제 판단을 대신하지 않아요.
      </p>

      <div className="pf-more">
        <Link href="/today">오늘 할 행동 하나 보기 ›</Link>
      </div>
    </main>
  );
}
