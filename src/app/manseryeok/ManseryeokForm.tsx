"use client";

// 만세력 입력 폼.
//
// 계산은 서버에서 한다. 이 폼이 하는 일은 주소를 만드는 것뿐이다 —
// 결과가 주소에 담기면 그대로 공유 링크가 되고, 새로고침해도 같은 명식이 나온다.
//
// 생년월일을 date 입력 하나로 받지 않는 이유: 1970년대생이 달력 위젯으로
// 연도를 거슬러 올라가는 것은 손이 많이 간다. 연·월·일을 따로 받는다.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { hasLeapMonth, lunarToSolar } from "@/lib/lunar";
import { manseryeokHref, type ManseryeokQuery } from "@/lib/manseryeok";

// 시주 경계는 두 시간마다 갈린다. 몇 시가 무슨 시인지 함께 보여주면
// "태어난 시각이 자시인가"를 따로 찾아보지 않아도 된다.
const HOUR_BRANCH = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

function branchOfHour(hour: number): string {
  return HOUR_BRANCH[Math.floor(((hour + 1) % 24) / 2)];
}

export interface FormValue {
  gender: "M" | "F";
  calendar: "solar" | "lunar";
  leapMonth: boolean;
  year: string;
  month: string;
  day: string;
  hour: string; // "unknown" 또는 "0"~"23"
}

export const EMPTY_FORM: FormValue = {
  gender: "F",
  calendar: "solar",
  leapMonth: false,
  year: "",
  month: "",
  day: "",
  hour: "unknown",
};

/**
 * 주소에 실려 온 값을 폼 상태로 되돌린다.
 *
 * 서버에서 부르지 않는다 — "use client" 파일의 함수라 서버가 호출하면 터진다.
 * 페이지는 질의 객체를 그대로 넘기고, 되돌리는 일은 여기서 한다.
 */
function formOf(query: ManseryeokQuery): FormValue {
  return {
    gender: query.gender,
    calendar: query.calendar,
    leapMonth: query.leapMonth,
    year: String(query.year),
    month: String(query.month),
    day: String(query.day),
    hour: query.hour === null ? "unknown" : String(query.hour),
  };
}

/** 입력이 명식을 세울 수 있는 값인가. 아니면 사람이 읽을 이유를 돌려준다. */
function problemOf(value: FormValue): string | null {
  const year = Number(value.year);
  const month = Number(value.month);
  const day = Number(value.day);

  if (!value.year || !value.month || !value.day) return "태어난 연·월·일을 모두 입력해주세요.";
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "연도는 1900~2100 사이여야 해요.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월은 1~12 사이여야 해요.";

  const lunar = value.calendar === "lunar";
  if (!Number.isInteger(day) || day < 1 || day > (lunar ? 30 : 31)) {
    return `일은 1~${lunar ? 30 : 31} 사이여야 해요.`;
  }

  if (lunar) {
    // 음력은 없는 날짜가 실제로 있다. 조용히 양력으로 넘기면 한 달 어긋난 명식이 나간다.
    if (!lunarToSolar({ year, month, day, leapMonth: value.leapMonth })) {
      return `음력 ${month}월 ${day}일은 없는 날짜예요. 윤달 여부를 확인해주세요.`;
    }
    return null;
  }

  const probe = new Date(year, month - 1, day);
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return `${year}년 ${month}월에는 ${day}일이 없어요.`;
  }
  return null;
}

export default function ManseryeokForm({ initial }: { initial?: ManseryeokQuery | null }) {
  const router = useRouter();
  const [value, setValue] = useState<FormValue>(initial ? formOf(initial) : EMPTY_FORM);
  const [touched, setTouched] = useState(false);

  const problem = useMemo(() => problemOf(value), [value]);
  const set = (patch: Partial<FormValue>) => setValue((prev) => ({ ...prev, ...patch }));

  // 윤달은 그 달에 실제로 윤달이 있을 때만 열어 준다. 없는 윤달을 체크하면
  // 변환이 실패하는데, 사용자는 왜 실패했는지 알 길이 없다.
  const year = Number(value.year);
  const month = Number(value.month);
  const leapAvailable =
    value.calendar === "lunar" &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 1900 &&
    month >= 1 &&
    month <= 12 &&
    hasLeapMonth(year, month);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (problem) return;
    router.push(
      manseryeokHref({
        year: Number(value.year),
        month: Number(value.month),
        day: Number(value.day),
        hour: value.hour === "unknown" ? null : Number(value.hour),
        gender: value.gender,
        calendar: value.calendar,
        leapMonth: leapAvailable && value.leapMonth,
      })
    );
  };

  return (
    <form className="ms-form card" onSubmit={submit}>
      <fieldset className="ms-field">
        <legend>성별</legend>
        <div className="ms-seg" role="group">
          <button
            type="button"
            className={value.gender === "F" ? "on" : ""}
            aria-pressed={value.gender === "F"}
            onClick={() => set({ gender: "F" })}
          >
            여자
          </button>
          <button
            type="button"
            className={value.gender === "M" ? "on" : ""}
            aria-pressed={value.gender === "M"}
            onClick={() => set({ gender: "M" })}
          >
            남자
          </button>
        </div>
        <p className="ms-hint">대운이 순행인지 역행인지가 성별로 갈려요.</p>
      </fieldset>

      <fieldset className="ms-field">
        <legend>생년월일</legend>
        <div className="ms-seg" role="group">
          <button
            type="button"
            className={value.calendar === "solar" ? "on" : ""}
            aria-pressed={value.calendar === "solar"}
            onClick={() => set({ calendar: "solar", leapMonth: false })}
          >
            양력
          </button>
          <button
            type="button"
            className={value.calendar === "lunar" ? "on" : ""}
            aria-pressed={value.calendar === "lunar"}
            onClick={() => set({ calendar: "lunar" })}
          >
            음력
          </button>
        </div>

        <div className="ms-date">
          <label>
            <span>년</span>
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="1995"
              value={value.year}
              onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </label>
          <label>
            <span>월</span>
            <input
              inputMode="numeric"
              maxLength={2}
              placeholder="3"
              value={value.month}
              onChange={(e) => set({ month: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </label>
          <label>
            <span>일</span>
            <input
              inputMode="numeric"
              maxLength={2}
              placeholder="14"
              value={value.day}
              onChange={(e) => set({ day: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </label>
        </div>

        {value.calendar === "lunar" && (
          <label className={`ms-leap ${leapAvailable ? "" : "off"}`}>
            <input
              type="checkbox"
              checked={leapAvailable && value.leapMonth}
              disabled={!leapAvailable}
              onChange={(e) => set({ leapMonth: e.target.checked })}
            />
            <span>윤달이에요</span>
            {Number.isInteger(month) && month >= 1 && month <= 12 && !leapAvailable && (
              <small>{month}월에는 윤달이 없어요</small>
            )}
          </label>
        )}
      </fieldset>

      <fieldset className="ms-field">
        <legend>태어난 시간</legend>
        <select value={value.hour} onChange={(e) => set({ hour: e.target.value })}>
          <option value="unknown">모름 (시주를 세우지 않아요)</option>
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}시 — {branchOfHour(hour)}시
            </option>
          ))}
        </select>
        <p className="ms-hint">
          모르면 그대로 두세요. 시주를 비워 둘 뿐, 나머지 세 기둥은 정확하게 나옵니다.
        </p>
      </fieldset>

      {touched && problem && (
        <p className="ms-error" role="alert">
          {problem}
        </p>
      )}

      <button type="submit" className="ms-submit">
        만세력 보기
      </button>
    </form>
  );
}
