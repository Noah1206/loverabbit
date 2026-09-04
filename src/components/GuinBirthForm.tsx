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
  const [showHour, setShowHour] = useState(initial ? initial.birth.hour !== null : false);
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
      {/* 라벨은 접었다 (2026-09-04) — 플레이스홀더가 같은 말을 하는데 위에
          한 번 더 적으면 글자만 는다. 스크린리더에는 aria-label 로 남긴다. */}
      <input
        value={nickname}
        maxLength={20}
        aria-label="이름 또는 별명"
        placeholder="이름 또는 별명 (별명을 권해요)"
        onChange={(e) => {
          touch();
          setNickname(e.target.value);
        }}
        disabled={busy}
      />

      <div style={{ display: "grid", gap: 6 }}>
        {/* 달력 선택이 입력값의 해석을 정한다 — 인풋 바로 위, 같은 폭으로 세운다 */}
        <div className="guin-cal-seg" role="group" aria-label="달력 종류">
          {(
            [
              ["solar", "양력"],
              ["lunar", "음력"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              className={calendar === value ? "on" : ""}
              onClick={() => {
                touch();
                setCalendar(value);
              }}
              disabled={busy}
            >
              {text}
            </button>
          ))}
        </div>
        <input
          value={dateText}
          inputMode="numeric"
          maxLength={10}
          aria-label="생년월일 8자리"
          placeholder="생년월일 8자리 (예: 19990102)"
          onChange={(e) => {
            touch();
            setDateText(e.target.value);
          }}
          disabled={busy}
        />
        {leapPossible && (
          <button
            type="button"
            className={`chip${leapMonth ? " on" : ""}`}
            style={{ justifySelf: "start" }}
            onClick={() => setLeapMonth((v) => !v)}
            disabled={busy}
          >
            윤달
          </button>
        )}
      </div>

      {/* 태어난 시간은 접어 둔다 — 대부분 "모름"이고, 몰라도 지도는 만들어진다.
          아는 사람만 펼쳐서 고른다: 처음 화면의 칸 수가 하나 준다. */}
      {!showHour ? (
        <button
          type="button"
          className="guin-hour-toggle"
          onClick={() => setShowHour(true)}
          disabled={busy}
        >
          태어난 시간을 알아요 (선택)
        </button>
      ) : (
        <select
          value={hourText}
          aria-label="태어난 시간"
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
      )}

      {/* 동의 전문은 접는다 — 체크 줄은 한 줄, 전문은 펼쳐 읽을 수 있다.
          내용을 줄이는 게 아니라 접는 것이다: 동의문 자체는 그대로 남는다. */}
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.8rem", color: "var(--text-dim)" }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          style={{ marginTop: 2 }}
        />
        <span>
          입력 정보 이용 안내에 동의해요
          <details className="guin-consent-details">
            <summary>안내 전문 보기</summary>
            {consentNote}
          </details>
        </span>
      </label>

      {error && <p style={{ color: "var(--accent)", fontSize: "0.84rem" }}>{error}</p>}

      <button className="btn guin-form-submit" onClick={submit} disabled={busy} style={{ width: "100%" }}>
        {busy ? "관계를 살피는 중…" : submitLabel}
      </button>
    </div>
  );
}
