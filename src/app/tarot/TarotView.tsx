"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import RabbitLoader from "@/components/RabbitLoader";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { TAROT_COST } from "@/lib/credits";
import { GENRES } from "@/lib/genres";
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

/* 주제마다 그림 한 장 (2026-09-10 운영자).

   처음에는 78장 중에서 골라 썼다. 카드 그림은 세로라 96x72 칸에서 위아래가
   잘렸고, 무엇보다 사주 목록의 3D 토끼들 사이에서 혼자 결이 달랐다 — 같은
   목록 모양을 쓰기로 한 이상 그림도 같은 결이어야 한다.

   그래서 주제마다 토끼를 한 장씩 새로 뽑았다(Higgsfield, 상품 카드와 같은
   레퍼런스). 뽑히는 카드와는 상관없다: 여기 그림은 "무엇을 묻는 자리인가" 를
   말할 뿐이다. */
const TOPIC_ART: Record<TarotTopic, string> = {
  love: "love",
  relationship: "relationship",
  work: "work",
  money: "money",
  choice: "choice",
};

/* 줄 아래 해시태그. 사주 목록의 #주제 #배지 와 같은 자리다. */
const TOPIC_TAGS: Record<TarotTopic, string[]> = {
  love: ["타로", "연애운"],
  relationship: ["타로", "인간관계"],
  work: ["타로", "직업운"],
  money: ["타로", "재물운"],
  choice: ["타로", "선택"],
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
      <main className="container tr" style={{ paddingTop: 32, paddingBottom: 110 }}>
        {/* 로그인 전에도 목록을 보여준다 (2026-09-09 운영자). 배너 한 장으로는
            무엇을 파는지 글자로만 설명하게 된다 — 다섯 줄을 그대로 펴 두면
            처음 온 사람도 고를 것을 먼저 보고, 로그인은 그 아래에서 묻는다.
            줄은 누를 수 없다: 눌러도 뽑을 수 없는 상태라 누르는 시늉만 하면
            고장난 것처럼 보인다. */}
        <header className="genre-head">
          <Link href="/" className="genre-back" aria-label="홈으로">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="genre-head-copy">
            <h1>타로</h1>
          </div>
        </header>

        <nav className="genre-tabs" aria-label="종목">
          {GENRES.map((g) => (
            <Link
              key={g.id}
              href={g.href}
              className="genre-tab"
              aria-current={g.id === "tarot" ? "page" : undefined}
            >
              {g.label}
            </Link>
          ))}
        </nav>

        <p className="genre-count">{TOPICS.length}가지</p>

        <ul className="genre-list tr-topic-list">
          {TOPICS.map((t) => (
            <li key={t}>
              <span className="genre-item">
                <span className="genre-item-copy">
                  <strong>{TOPIC_LABEL[t].title} 타로</strong>
                  {/* 무엇을 묻는 자리인지 한 줄로 (2026-09-10 운영자). 물음은
                      새로 쓰지 않는다 — TOPIC_LABEL 이 이미 들고 있고, 뽑고
                      나면 결과 화면 머리에 같은 문장이 다시 선다. */}
                  <small className="tr-topic-q">{TOPIC_LABEL[t].question}</small>
                  <span className="genre-tags">
                    {TOPIC_TAGS[t].map((tag) => (
                      <i key={tag}>#{tag}</i>
                    ))}
                  </span>
                </span>
                <span className="genre-item-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/tarot-topic/${TOPIC_ART[t]}.jpg`} alt="" loading="lazy" />
                </span>
              </span>
            </li>
          ))}
        </ul>

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
                  {/* 카드 그림 (2026-09-09). 파일 이름이 카드 id 라 표에 경로를
                      따로 두지 않는다 — 두 곳에 적으면 한 곳이 뒤처진다.
                      그림 안에 글자를 넣지 않았으므로 이름과 번호는 아래가 적는다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="tr-card-art" src={`/tarot/${c.card.id}.jpg`} alt="" loading="lazy" />
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
      {/* 사주 종목과 같은 머리 (2026-09-09 운영자) — 배너를 걷고 제목과 탭을
          세운다. 타로만 다른 모양이면 두 화면이 서로 다른 앱처럼 읽힌다. */}
      <header className="genre-head">
        <Link href="/" className="genre-back" aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="genre-head-copy">
          <h1>타로</h1>
        </div>
      </header>

      <nav className="genre-tabs" aria-label="종목">
        {GENRES.map((g) => (
          <Link
            key={g.id}
            href={g.href}
            className="genre-tab"
            aria-current={g.id === "tarot" ? "page" : undefined}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      <p className="genre-count">{TOPICS.length}가지</p>

      {busy && <RabbitLoader message="카드를 뽑고 있어요" sub="당신 결에 겹쳐 읽는 중이에요." />}

      {!busy && (
        /* 사주 목록과 같은 줄이다 (genre-list). 다만 여기서는 누르는 것이
           페이지 이동이 아니라 그 자리에서 카드를 뽑는 일이라 a 가 아니라
           button 이다 — 모양은 같고 하는 일만 다르다. */
        <ul className="genre-list tr-topic-list">
          {TOPICS.map((t) => (
            <li key={t}>
              <button type="button" className="genre-item" onClick={() => void draw(t)}>
                <span className="genre-item-copy">
                  <strong>{TOPIC_LABEL[t].title} 타로</strong>
                  {/* 무엇을 묻는 자리인지 한 줄로 (2026-09-10 운영자). 물음은
                      새로 쓰지 않는다 — TOPIC_LABEL 이 이미 들고 있고, 뽑고
                      나면 결과 화면 머리에 같은 문장이 다시 선다. */}
                  <small className="tr-topic-q">{TOPIC_LABEL[t].question}</small>
                  <span className="genre-tags">
                    {TOPIC_TAGS[t].map((tag) => (
                      <i key={tag}>#{tag}</i>
                    ))}
                  </span>
                </span>
                <span className="genre-item-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/tarot-topic/${TOPIC_ART[t]}.jpg`} alt="" loading="lazy" />
                </span>
              </button>
            </li>
          ))}
        </ul>
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
