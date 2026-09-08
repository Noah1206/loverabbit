"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import RabbitLoader from "@/components/RabbitLoader";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { TAROT_COST } from "@/lib/credits";
import type { TarotReport } from "@/lib/tarot-guard";
import { TOPIC_LABEL, TOPICS, type TarotDraw, type TarotTopic } from "@/lib/tarot-reading";
import { getUser, type User } from "@/lib/user";

/*
  타로 — 고르기 → 뽑기 → 읽기.

  카드를 화면이 뽑지 않는다. 서버가 뽑아 내려준다 — 화면이 뽑으면 새로고침으로
  원하는 카드가 나올 때까지 다시 뽑을 수 있고, 그건 타로가 아니라 뽑기다.

  뽑고 나면 다시 뽑는 버튼을 바로 주지 않는다. 값이 드는 것도 이유지만, 더
  큰 이유는 마음에 안 드는 결과를 무를 수 있으면 결과가 의미를 잃기 때문이다.
  다른 물음으로는 갈 수 있게 두었다.
*/

const TOPIC_EMOJI: Record<TarotTopic, string> = {
  love: "💗",
  relationship: "🤝",
  work: "🧭",
  money: "🪙",
  choice: "🔀",
};

interface Result {
  draw: TarotDraw;
  report: TarotReport;
}

export default function TarotView() {
  const [user, setUser] = useState<User | null>(null);
  const [topic, setTopic] = useState<TarotTopic | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const draw = async (t: TarotTopic) => {
    if (!user) return;
    setBusy(true);
    setError("");
    setNeedsCredits(false);
    setNeedsProfile(false);
    try {
      const res = await fetch("/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token, topic: t }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        draw?: TarotDraw;
        report?: TarotReport;
        needsProfile?: boolean;
        needsCredits?: boolean;
        error?: string;
      };
      if (data.needsProfile) {
        setNeedsProfile(true);
        return;
      }
      if (data.needsCredits) {
        setNeedsCredits(true);
        return;
      }
      if (!res.ok || !data.draw || !data.report) {
        throw new Error(data.error ?? "카드를 읽지 못했어요.");
      }
      setResult({ draw: data.draw, report: data.report });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "카드를 읽지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  // ── 로그인 전 ──
  if (!user) {
    return (
      <main className="container tr" style={{ paddingTop: 40, paddingBottom: 110 }}>
        <span className="badge">{TAROT_COST}러빗</span>
        <h1 className="tr-h1">타로</h1>
        <p className="tr-lede">
          카드 세 장을 뽑고, 그 카드를 당신의 사주 결과 겹쳐 읽어요. 같은 카드라도 사람마다
          다르게 읽히는 이유예요.
        </p>
        <div className="card" style={{ padding: 20, marginTop: 18 }}>
          <p style={{ marginBottom: 14, fontSize: "0.9rem", color: "var(--text-dim)" }}>
            사주 정보가 있어야 카드를 당신 결에 겹칠 수 있어요.
          </p>
          <SocialLoginButtons nextPath="/tarot" />
        </div>
      </main>
    );
  }

  // ── 결과 ──
  if (result) {
    return (
      <main className="container tr" style={{ paddingTop: 32, paddingBottom: 110 }}>
        <p className="tr-question">{result.draw.question}</p>
        <h1 className="tr-h1">{result.draw.topicLabel} 타로</h1>

        <div className="tr-cards">
          {result.draw.cards.map((c, i) => {
            const read = result.report.cards[i];
            return (
              <section key={c.position} className="card tr-card">
                <header>
                  <small>{c.positionLabel}</small>
                  <strong>{c.card.name}</strong>
                  <i>{c.card.number}</i>
                </header>
                <p className="tr-card-keywords">
                  {c.card.keywords.map((k) => (
                    <b key={k}>{k}</b>
                  ))}
                </p>
                <p className="tr-card-read">{read?.read ?? c.card.meaning}</p>
              </section>
            );
          })}
        </div>

        <section className="card tr-closing">
          <small>세 장을 겹쳐 보면</small>
          <p>{result.report.closing}</p>
        </section>

        <p className="tr-note">
          결과는 재미와 자기성찰을 위한 콘텐츠예요. 실제 판단을 대신하지 않아요.
        </p>

        {/* 같은 물음을 다시 뽑는 버튼은 두지 않는다 — 무를 수 있는 결과는
            의미를 잃는다. 다른 물음으로는 갈 수 있다. */}
        <div className="tr-again">
          <p>다른 것도 물어볼까요?</p>
          <div className="tr-again-row">
            {TOPICS.filter((t) => t !== result.draw.topic).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setResult(null);
                  setTopic(t);
                  void draw(t);
                }}
              >
                <span aria-hidden>{TOPIC_EMOJI[t]}</span> {TOPIC_LABEL[t].title}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── 고르기 ──
  return (
    <main className="container tr" style={{ paddingTop: 32, paddingBottom: 110 }}>
      <span className="badge">{TAROT_COST}러빗</span>
      <h1 className="tr-h1">무엇을 물어볼까요?</h1>
      <p className="tr-lede">
        고르면 카드 세 장이 뽑혀요. 지나온 자리, 지금 자리, 가져갈 것 순서로 읽어요.
      </p>

      {busy && <RabbitLoader message="카드를 뽑고 있어요" sub="당신 결에 겹쳐 읽는 중이에요." />}

      {!busy && (
        <div className="tr-topics">
          {TOPICS.map((t) => (
            <button key={t} type="button" className="tr-topic" onClick={() => void draw(t)}>
              <span className="tr-topic-emoji" aria-hidden>
                {TOPIC_EMOJI[t]}
              </span>
              <span className="tr-topic-copy">
                <strong>{TOPIC_LABEL[t].title}</strong>
                <small>{TOPIC_LABEL[t].question}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {needsProfile && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <p style={{ fontSize: "0.92rem", marginBottom: 12 }}>
            사주 정보를 넣으면 카드를 당신 결에 겹쳐 읽어요.
          </p>
          <Link className="btn" href="/profile?next=/tarot">
            사주 정보 입력하기
          </Link>
        </div>
      )}

      {needsCredits && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <p style={{ fontSize: "0.92rem", marginBottom: 12 }}>
            러빗이 모자라요. 타로 한 번은 {TAROT_COST}러빗이에요.
          </p>
          <Link className="btn" href="/credits?next=/tarot">
            러빗 충전하기
          </Link>
        </div>
      )}

      {error && (
        <p className="tr-error" role="alert">
          {error}
        </p>
      )}

      {topic && !busy && !result && !error && !needsProfile && !needsCredits && (
        <p className="tr-note">잠시만요…</p>
      )}
    </main>
  );
}
