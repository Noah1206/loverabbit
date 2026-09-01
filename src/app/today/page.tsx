"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import SocialLoginButtons from "@/components/SocialLoginButtons";
import { DOMAIN_LABEL, type DailySajuAction, type FortuneDomain } from "@/lib/daily-action";
import { getUser, type User } from "@/lib/user";

// 오늘의 사주 액션.
//
// 화면이 3초 안에 답해야 하는 것 세 가지 — 어느 영역인가, 무엇을 하는가,
// 어디를 누르는가. 그래서 그 셋이 첫 화면 위쪽에 순서대로 서고, 근거와
// 다른 영역은 그 아래로 내린다. 사주 용어는 근거 줄 하나에만 나온다.

interface DailyActionResponse {
  today: string;
  action: DailySajuAction;
  others: DailySajuAction[];
  completedToday: string[];
  yesterdayDomain: FortuneDomain | null;
  birthTimeUnknown: boolean;
  flow: { dayGanji: string; dayMaster: string; tenGod: string };
}

type Screen =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "needsProfile" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DailyActionResponse };

export default function TodayPage() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [account, setAccount] = useState<User | null>(null);
  const [openDomain, setOpenDomain] = useState<FortuneDomain | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (token: string) => {
    setScreen({ kind: "loading" });
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setScreen({ kind: "error", message: body?.error ?? "오늘의 액션을 불러오지 못했어요." });
        return;
      }
      if (body?.needsProfile) {
        setScreen({ kind: "needsProfile" });
        return;
      }
      setScreen({ kind: "ready", data: body as DailyActionResponse });
    } catch {
      setScreen({ kind: "error", message: "연결이 불안정해요. 다시 시도해주세요." });
    }
  }, []);

  useEffect(() => {
    const stored = getUser();
    setAccount(stored);
    if (!stored) {
      setScreen({ kind: "guest" });
      return;
    }
    void load(stored.token);
  }, [load]);

  const complete = async (domain: FortuneDomain) => {
    if (!account || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/daily-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: account.token, intent: "complete", domain }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // 저장 실패는 조용히 넘기지 않는다 — 눌렀는데 아무 일도 안 일어난
        // 것처럼 보이면 사용자는 같은 자리를 계속 누른다.
        setSaveError(body?.error ?? "완료를 저장하지 못했어요. 다시 눌러주세요.");
        return;
      }
      // 서버를 다시 부르지 않고 화면에서만 완료로 표시한다. 응답이 이미
      // 성공이라 다시 물어도 같은 값이 온다.
      setScreen((prev) =>
        prev.kind === "ready"
          ? { ...prev, data: { ...prev.data, completedToday: [...prev.data.completedToday, domain] } }
          : prev
      );
    } catch {
      setSaveError("연결이 불안정해요. 다시 눌러주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 96 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 6, fontSize: "0.82rem", letterSpacing: "0.4px" }}>
        오늘의 사주 액션
      </p>
      <h1 style={{ marginBottom: 6, fontSize: "1.6rem", lineHeight: 1.3 }}>
        오늘의 흐름을 가장 잘 쓰는 방법
      </h1>

      {screen.kind === "loading" && (
        <p style={{ color: "var(--text-dim)", marginTop: 28 }}>오늘의 흐름을 읽고 있어요…</p>
      )}

      {screen.kind === "guest" && (
        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ marginBottom: 8, fontWeight: 700 }}>로그인하면 오늘의 액션이 만들어져요.</p>
          <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: "0.94rem", lineHeight: 1.6 }}>
            오늘의 일진과 내 사주를 맞대어 봐야 하니, 저장해 둔 사주 정보가 필요해요.
          </p>
          <SocialLoginButtons nextPath="/today" />
        </div>
      )}

      {screen.kind === "needsProfile" && (
        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ marginBottom: 8, fontWeight: 700 }}>사주 정보를 먼저 입력해주세요.</p>
          <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: "0.94rem", lineHeight: 1.6 }}>
            생년월일이 있어야 오늘의 일진과 맞대어 볼 수 있어요. 한 번만 입력하면 매일 이어집니다.
          </p>
          <Link href="/reading" className="btn">
            사주 정보 입력하기
          </Link>
        </div>
      )}

      {screen.kind === "error" && (
        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ marginBottom: 20 }}>{screen.message}</p>
          <button
            type="button"
            className="btn"
            onClick={() => account && void load(account.token)}
          >
            다시 시도
          </button>
        </div>
      )}

      {screen.kind === "ready" && (
        <ReadyView
          data={screen.data}
          saving={saving}
          saveError={saveError}
          openDomain={openDomain}
          onToggleDomain={(d) => setOpenDomain((prev) => (prev === d ? null : d))}
          onComplete={complete}
        />
      )}
    </main>
  );
}

function ReadyView({
  data,
  saving,
  saveError,
  openDomain,
  onToggleDomain,
  onComplete,
}: {
  data: DailyActionResponse;
  saving: boolean;
  saveError: string;
  openDomain: FortuneDomain | null;
  onToggleDomain: (d: FortuneDomain) => void;
  onComplete: (d: FortuneDomain) => void;
}) {
  const { action } = data;
  const done = data.completedToday.includes(action.domain);

  return (
    <>
      {data.yesterdayDomain && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 14 }}>
          어제는 {DOMAIN_LABEL[data.yesterdayDomain]} 액션을 완료했어요.
        </p>
      )}

      <ActionCard
        action={action}
        done={done}
        saving={saving}
        saveError={saveError}
        onComplete={onComplete}
        primary
      />

      {/* 사주 근거 — 용어가 나오는 유일한 자리다. 대표 액션 아래에 둔다. */}
      <section className="card" style={{ marginTop: 14 }}>
        <p style={{ fontWeight: 800, marginBottom: 8, fontSize: "0.95rem" }}>오늘의 사주 근거</p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 6 }}>
          {action.sajuBasis.label}
        </p>
        <p style={{ fontSize: "0.94rem", lineHeight: 1.65 }}>{action.sajuBasis.description}</p>
        {data.birthTimeUnknown && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 10 }}>
            태어난 시각을 모르는 것으로 두고 계산했어요. 오늘의 흐름은 태어난 날로 정해지니 결과는 달라지지 않아요.
          </p>
        )}
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 10, lineHeight: 1.6 }}>
          이 결과는 미래를 확정하는 예언이 아니라, 오늘을 돌아보는 사주 기반 참고 가이드입니다.
        </p>
      </section>

      {/* 다른 운세 보기 — 접어 둔다. 첫 화면은 행동 하나여야 한다. */}
      <section style={{ marginTop: 28 }}>
        <p style={{ fontWeight: 800, marginBottom: 12, fontSize: "0.95rem" }}>다른 운세 보기</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.others.map((other) => (
            <button
              key={other.domain}
              type="button"
              className={openDomain === other.domain ? "chip on" : "chip"}
              onClick={() => onToggleDomain(other.domain)}
              aria-expanded={openDomain === other.domain}
            >
              {DOMAIN_LABEL[other.domain]}
              {data.completedToday.includes(other.domain) ? " ✓" : ""}
            </button>
          ))}
        </div>

        {openDomain && (
          <ActionCard
            action={data.others.find((o) => o.domain === openDomain)!}
            done={data.completedToday.includes(openDomain)}
            saving={saving}
            saveError={saveError}
            onComplete={onComplete}
          />
        )}
      </section>
    </>
  );
}

function ActionCard({
  action,
  done,
  saving,
  saveError,
  onComplete,
  primary = false,
}: {
  action: DailySajuAction;
  done: boolean;
  saving: boolean;
  saveError: string;
  onComplete: (d: FortuneDomain) => void;
  primary?: boolean;
}) {
  return (
    <section className="card" style={{ marginTop: primary ? 18 : 14 }}>
      <span className="badge">{DOMAIN_LABEL[action.domain]}</span>

      {/* 오늘의 핵심 행동 — 화면에서 가장 큰 글자. */}
      <p
        style={{
          marginTop: 14,
          fontSize: primary ? "1.32rem" : "1.1rem",
          fontWeight: 800,
          lineHeight: 1.45,
        }}
      >
        {action.action}
      </p>

      {action.durationMinutes && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 8 }}>
          약 {action.durationMinutes}분
        </p>
      )}

      <p style={{ fontWeight: 800, marginTop: 22, marginBottom: 6, fontSize: "0.92rem" }}>왜 이 행동인가</p>
      <p style={{ color: "var(--text-dim)", fontSize: "0.94rem", lineHeight: 1.65 }}>{action.reason}</p>

      <p style={{ fontWeight: 800, marginTop: 20, marginBottom: 6, fontSize: "0.92rem" }}>오늘 피할 행동</p>
      <p style={{ color: "var(--text-dim)", fontSize: "0.94rem", lineHeight: 1.65 }}>{action.avoidAction}</p>

      {action.disclaimer && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginTop: 14, lineHeight: 1.6 }}>
          {action.disclaimer}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        {done ? (
          <p style={{ fontWeight: 800, color: "var(--semantic-success)" }}>
            오늘의 흐름을 잘 사용했어요.
          </p>
        ) : (
          <button
            type="button"
            className="btn"
            style={{ width: "100%" }}
            disabled={saving}
            onClick={() => onComplete(action.domain)}
          >
            {saving ? "저장하는 중…" : "지금 실행하기"}
          </button>
        )}
        {saveError && (
          <p style={{ color: "var(--semantic-error)", fontSize: "0.88rem", marginTop: 10 }}>{saveError}</p>
        )}
      </div>
    </section>
  );
}
