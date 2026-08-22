"use client";

import { useState } from "react";

import type { ShrineTheme } from "@/lib/characters";

// 도령이 태어난 날을 물었을 때 손님이 답하는 자리.
//
// 대화창에 "1994년 3월 2일 오후 3시" 라고 적게 하지 않는다. 사람이 쓰는 방식은
// 열 가지라 파싱이 반드시 어긋나고, 어긋난 생년월일은 엉뚱한 간지가 되어 도령이
// 남의 사주를 읽게 된다. 사주는 틀리면 안 되는 값이라 입력을 정확한 자리로 받는다.
//
// 한 번 답하면 다음 턴부터 도령이 실제 간지를 손에 쥐고 말하고, 리딩을 살 때도
// 같은 값을 다시 묻지 않는다.

export default function ShrineSajuPrompt({
  theme,
  characterName,
  userToken,
  onSaved,
  onDismiss,
}: {
  theme: ShrineTheme;
  characterName: string;
  userToken: string;
  onSaved: () => void;
  onDismiss: () => void;
}) {
  const [birthdate, setBirthdate] = useState("");
  const [hour, setHour] = useState<string>("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<"F" | "M" | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!birthdate || !gender || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/shrine-chat/saju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken,
          birthdate,
          birthHour: timeUnknown || hour === "" ? null : Number(hour),
          birthTimeUnknown: timeUnknown,
          gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했어요.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrine-saju" style={{ borderColor: theme.line }}>
      <p className="shrine-saju-title" style={{ color: theme.stage }}>
        {characterName}에게 네 기운을 보여줄까?
      </p>
      <p className="shrine-saju-sub">알려주면 이 대화부터 네 사주를 보고 말해줘요.</p>

      <div className="shrine-saju-row">
        <input
          type="date"
          value={birthdate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthdate(e.target.value)}
          aria-label="생년월일"
        />
        <select
          value={timeUnknown ? "unknown" : hour}
          onChange={(e) => {
            const value = e.target.value;
            setTimeUnknown(value === "unknown");
            setHour(value === "unknown" ? "" : value);
          }}
          aria-label="태어난 시각"
        >
          <option value="">시각 선택</option>
          <option value="unknown">시각 모름</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}시
            </option>
          ))}
        </select>
      </div>

      <div className="shrine-saju-row">
        {(["F", "M"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`shrine-saju-gender${gender === value ? " is-on" : ""}`}
            style={gender === value ? { borderColor: theme.accent, color: theme.stage } : undefined}
            onClick={() => setGender(value)}
          >
            {value === "F" ? "여성" : "남성"}
          </button>
        ))}
      </div>

      {error && <p className="shrine-saju-error">{error}</p>}

      <div className="shrine-saju-actions">
        <button type="button" className="shrine-saju-skip" onClick={onDismiss}>
          나중에
        </button>
        <button
          type="button"
          className="shrine-saju-submit"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          onClick={() => void submit()}
          disabled={!birthdate || !gender || saving}
        >
          {saving ? "전하는 중…" : "알려주기"}
        </button>
      </div>
    </div>
  );
}
