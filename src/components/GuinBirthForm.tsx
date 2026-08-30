"use client";

// 귀인 지도 입력 폼 — 지도 만들기와 친구 참여가 같은 폼을 쓴다.
//
// 별명을 기본으로 권한다. 실명·연락처를 넣지 말라는 안내와 동의문이 함께
// 간다. 음력은 리딩 폼과 같은 변환기(lunar.ts)로 양력으로 바꿔 보낸다 —
// 서버는 양력만 받는다.

import { useMemo, useState } from "react";

import { hasLeapMonth, lunarToSolar } from "@/lib/lunar";
import { birthProblem, nicknameProblem, type GuinBirthInput } from "@/lib/guin-map";

export interface GuinFormValue {
  nickname: string;
  birth: GuinBirthInput;
}

export default function GuinBirthForm({
  submitLabel,
  consentNote,
  busy,
  onSubmit,
  onFirstTouch,
  initial,
}: {
  submitLabel: string;
  /** 동의문 — 만들기와 참여가 문구가 다르다 */
  consentNote: string;
  busy: boolean;
  onSubmit: (value: GuinFormValue) => void;
  /** 폼에 처음 손을 댄 순간 (분석용) */
  onFirstTouch?: () => void;
  /**
   * 참여자가 자기 지도를 만들 때 방금 넣은 값을 재사용한다 (지시문 5항).
   * 값만 미리 채운다 — 동의는 절대 미리 채우지 않는다.
   */
  initial?: GuinFormValue | null;
}) {
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [dateText, setDateText] = useState(
    initial
      ? `${initial.birth.year}${String(initial.birth.month).padStart(2, "0")}${String(initial.birth.day).padStart(2, "0")}`
      : ""
  );
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [leapMonth, setLeapMonth] = useState(false);
  const [hourText, setHourText] = useState(
    initial ? (initial.birth.hour === null ? "unknown" : String(initial.birth.hour)) : "unknown"
  );
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const touch = () => {
    if (!touched) {
      setTouched(true);
      onFirstTouch?.();
    }
  };

  const parsed = useMemo(() => {
    const digits = dateText.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    return {
      year: Number(digits.slice(0, 4)),
      month: Number(digits.slice(4, 6)),
      day: Number(digits.slice(6, 8)),
    };
  }, [dateText]);

  const leapPossible =
    calendar === "lunar" && parsed ? hasLeapMonth(parsed.year, parsed.month) : false;

  const submit = () => {
    setError("");
    const nicknameIssue = nicknameProblem(nickname);
    if (nicknameIssue) return setError(nicknameIssue);
    if (!parsed) return setError("생년월일 8자리(YYYYMMDD)를 입력해 주세요.");

    let solar = parsed;
    if (calendar === "lunar") {
      const converted = lunarToSolar({ ...parsed, leapMonth: leapPossible && leapMonth });
      if (!converted) return setError("음력 날짜를 확인해 주세요.");
      solar = converted.solar;
    }
    const hour = hourText === "unknown" ? null : Number(hourText);
    const birth: GuinBirthInput = { ...solar, hour };
    const birthIssue = birthProblem(birth);
    if (birthIssue) return setError(birthIssue);
    if (!consent) return setError("안내를 확인하고 동의해 주세요.");
    onSubmit({ nickname: nickname.trim(), birth });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.86rem", fontWeight: 700 }}>이름 또는 별명</span>
        <input
          value={nickname}
          maxLength={20}
          placeholder="별명을 권해요 (예: 달토끼)"
          onChange={(e) => {
            touch();
            setNickname(e.target.value);
          }}
          disabled={busy}
        />
        <span style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>
          실명·전화번호·주소는 입력하지 마세요. 지도에는 이 이름만 보여요.
        </span>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.86rem", fontWeight: 700 }}>생년월일</span>
        <input
          value={dateText}
          inputMode="numeric"
          maxLength={10}
          placeholder="19990102 (8자리)"
          onChange={(e) => {
            touch();
            setDateText(e.target.value);
          }}
          disabled={busy}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            ["solar", "양력"],
            ["lunar", "음력"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={`chip${calendar === value ? " on" : ""}`}
            onClick={() => {
              touch();
              setCalendar(value);
            }}
            disabled={busy}
          >
            {text}
          </button>
        ))}
        {leapPossible && (
          <button
            type="button"
            className={`chip${leapMonth ? " on" : ""}`}
            onClick={() => setLeapMonth((v) => !v)}
            disabled={busy}
          >
            윤달
          </button>
        )}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.86rem", fontWeight: 700 }}>태어난 시간</span>
        <select
          value={hourText}
          onChange={(e) => {
            touch();
            setHourText(e.target.value);
          }}
          disabled={busy}
        >
          <option value="unknown">모름 — 몰라도 지도는 만들어져요</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={String(h)}>
              {h}시 ~ {h}시 59분
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.78rem", color: "var(--text-dim)" }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          style={{ marginTop: 2 }}
        />
        <span>{consentNote}</span>
      </label>

      {error && <p style={{ color: "var(--accent)", fontSize: "0.84rem" }}>{error}</p>}

      <button className="btn" onClick={submit} disabled={busy} style={{ width: "100%" }}>
        {busy ? "관계를 살피는 중…" : submitLabel}
      </button>
    </div>
  );
}
