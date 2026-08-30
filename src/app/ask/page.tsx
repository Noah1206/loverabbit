"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import SignupModal from "@/components/SignupModal";
import { QUESTION_COST, questionsLeft } from "@/lib/credits";
import { askBlock } from "@/lib/question-gate";
import { getUser, type User } from "@/lib/user";

/*
  오늘의 질문 — 크레딧 5장에 한 번.

  리딩 폼과 다르게 아무것도 묻지 않는다. 내 사주는 저장돼 있고(첫 리딩 때), 근거는
  이미 산 리딩 전문이다. 상대 생년월일은 여기서 받지도, 저장된 것을 꺼내지도 않는다.
*/

interface QuestionRow {
  id: string;
  question: string;
  answer: string | null;
  status: "pending" | "answered" | "failed";
  createdAt: string;
}

const PROMPTS = [
  "이번 달에 연락해도 될까?",
  "지금 이 관계, 내가 더 밀어붙여도 괜찮을까?",
  "요즘 자꾸 흔들리는 이유가 뭘까?",
];

export default function AskPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 내 사주가 저장돼 있는가. 없으면 물어도 명식 없이 답하게 되므로 서버가 막는다.
  const [hasProfile, setHasProfile] = useState(true);

  const load = useCallback(async (account: User) => {
    const res = await fetch("/api/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: account.token, list: true }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      balance: number;
      questions: QuestionRow[];
      hasProfile?: boolean;
    };
    setBalance(data.balance);
    setRows(data.questions);
    setHasProfile(data.hasProfile !== false);
  }, []);

  useEffect(() => {
    const stored = getUser();
    setUser(stored);
    setChecked(true);
    if (stored) void load(stored);
  }, [load]);

  const ask = async () => {
    const q = input.trim();
    if (!q || sending || !user) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token, question: q }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string; answer?: string; balance?: number; error?: string;
        insufficient?: boolean; demo?: boolean; needProfile?: boolean;
      };
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok) {
        if (data.insufficient) {
          setError("크레딧이 부족해요. 충전하고 다시 물어봐 주세요.");
          return;
        }
        if (data.needProfile) {
          setHasProfile(false);
          return;
        }
        throw new Error(data.error ?? "답을 만들지 못했어요.");
      }
      if (data.demo) {
        setError(data.answer ?? "");
        return;
      }
      setRows((prev) => [
        { id: data.id ?? String(Date.now()), question: q, answer: data.answer ?? "", status: "answered", createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setSending(false);
    }
  };

  if (!checked) return <main className="container" style={{ paddingTop: 48 }} />;

  const left = balance === null ? null : questionsLeft(balance);
  // 판단은 question-gate.ts 에 있다 — 서버(/api/question)와 같은 규칙이라
  // 한쪽만 고치지 않도록 한 곳에 뒀다.
  const block = askBlock({ signedIn: Boolean(user), hasProfile, balance: balance ?? 0 });
  const canAsk = block === null;

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>ASK LOVE RABBIT</p>
      <h1 style={{ marginBottom: 8 }}>오늘의 질문</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        내 사주와 이미 받은 리딩을 바탕으로 한 가지를 물어요. 한 번에 {QUESTION_COST}크레딧.
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <strong style={{ fontSize: "1.2rem" }}>{balance === null ? "—" : `${balance}크레딧`}</strong>
          <p style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>
            {left === null ? "로그인하면 잔액이 보여요" : `질문 ${left}회 남음`}
          </p>
        </div>
        <Link className="btn btn-ghost" href="/credits" style={{ whiteSpace: "nowrap" }}>충전 · 내역</Link>
      </div>

      {!user ? (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--text-dim)", marginBottom: 14 }}>로그인하면 첫 구매 할인가를 볼 수 있어요.</p>
          <button className="btn" style={{ width: "100%" }} onClick={() => setShowSignup(true)}>로그인 · 가입하기</button>
        </div>
      ) : !hasProfile ? (
        /*
          명식이 없으면 물을 수 없다. 화면이 "내 사주를 바탕으로" 라고 약속하는데
          그 사주가 없으면 크레딧만 나가고 일반론이 돌아온다.

          사주는 리딩을 만들 때 저장된다. 그래서 여기서 입력받지 않고 리딩으로
          보낸다 — 입력칸을 하나 더 두면 같은 값을 두 곳에서 받게 되고, 그 둘이
          어긋나는 날이 온다.
        */
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>내 사주가 아직 없어요</p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
            사주를 한 번 보고 나면 그 명식으로 답해 드려요. 크레딧은 쓰지 않았어요.
          </p>
          <Link className="btn" href="/reading" style={{ width: "100%" }}>내 사주 보러 가기</Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={PROMPTS[rows.length % PROMPTS.length]}
            disabled={sending}
            style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
          />
          <button className="btn" style={{ width: "100%" }} onClick={ask} disabled={!canAsk || sending || !input.trim()}>
            {sending ? "명식을 다시 보는 중…" : `${QUESTION_COST}크레딧으로 물어보기`}
          </button>
          {!canAsk && balance !== null && (
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 10 }}>
              크레딧이 모자라요. <Link href="/credits" style={{ color: "var(--accent)" }}>충전하기</Link>
            </p>
          )}
          {error && <p style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: 10 }} role="alert">{error}</p>}
        </div>
      )}

      {rows.length > 0 && (
        <section style={{ marginTop: 20, display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <article key={row.id} className="card" style={{ padding: 18 }}>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>Q. {row.question}</p>
              {row.status === "answered" ? (
                <p style={{ whiteSpace: "pre-wrap", fontSize: "0.94rem", lineHeight: 1.65 }}>{row.answer}</p>
              ) : (
                <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
                  {row.status === "failed" ? "답을 만들지 못했어요. 크레딧은 돌려드렸어요." : "답을 만드는 중…"}
                </p>
              )}
              <p style={{ color: "var(--text-dim)", fontSize: "0.76rem", marginTop: 10 }}>
                {new Date(row.createdAt).toLocaleString("ko-KR")} · 오락 및 자기성찰을 위한 참고 해석이에요.
              </p>
            </article>
          ))}
        </section>
      )}

      {showSignup && (
        <SignupModal
          reason="질문하려면 로그인이 필요해요. 가입하면 3회분을 드려요."
          onDone={(next) => {
            setUser(next);
            setShowSignup(false);
            void load(next);
          }}
          onClose={() => setShowSignup(false)}
        />
      )}
    </main>
  );
}
