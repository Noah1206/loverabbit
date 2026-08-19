// 음력 생일 -> 양력 변환.
//
// 사주는 태양의 위치로 계산하므로(saju.ts) 입력은 반드시 양력이어야 한다.
// 그런데 한국에서는 음력 생일만 아는 사람이 드물지 않다. 지금까지는 폼이
// "양력 기준으로 입력해주세요"라고만 안내했고, 음력 날짜를 그대로 넣으면
// 한 달 가까이 어긋난 명식이 나갔다.
//
// 변환표는 한국천문연구원(KASI) 기준의 korean-lunar-calendar를 쓴다.
// 중국 음력과 날짜가 갈리는 달이 있어 한국 표준을 쓰는 것이 중요하다.
// 지원 범위는 음력 1000-01-01 ~ 2050-11-18.

import KoreanLunarCalendar from "korean-lunar-calendar";

export interface SolarDate {
  year: number;
  month: number;
  day: number;
}

export interface LunarDate extends SolarDate {
  /** 윤달인가 */
  leapMonth: boolean;
}

export interface LunarConversion {
  solar: SolarDate;
  /** 계산 노트에 남길 한 줄 — 어떤 음력 날짜를 무엇으로 바꿨는지 */
  note: string;
}

/**
 * 음력 -> 양력. 없는 날짜(그 달에 윤달이 없는데 윤달을 요청한 경우 포함)면 null.
 * 호출부는 null을 사용자 오류로 처리해야 한다 — 조용히 양력으로 넘기면 안 된다.
 */
export function lunarToSolar(input: LunarDate): LunarConversion | null {
  const calendar = new KoreanLunarCalendar();
  if (!calendar.setLunarDate(input.year, input.month, input.day, input.leapMonth)) {
    return null;
  }
  const solar = calendar.getSolarCalendar();
  if (!solar || !Number.isInteger(solar.year)) return null;

  const stamp = `${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}`;
  const converted = `${solar.year}-${String(solar.month).padStart(2, "0")}-${String(solar.day).padStart(2, "0")}`;
  return {
    solar: { year: solar.year, month: solar.month, day: solar.day },
    note: `음력 ${stamp}${input.leapMonth ? " (윤달)" : ""} → 양력 ${converted} 기준으로 계산`,
  };
}

/** 양력 -> 음력. 폼에서 "음력으로는 며칠인가"를 되짚어 보여줄 때 쓴다. */
export function solarToLunar(input: SolarDate): LunarDate | null {
  const calendar = new KoreanLunarCalendar();
  if (!calendar.setSolarDate(input.year, input.month, input.day)) return null;
  const lunar = calendar.getLunarCalendar();
  if (!lunar || !Number.isInteger(lunar.year)) return null;
  return {
    year: lunar.year,
    month: lunar.month,
    day: lunar.day,
    leapMonth: lunar.intercalation === true,
  };
}

/** 그 음력 달에 윤달이 있는가 — 폼에서 윤달 체크박스를 열어줄지 판단한다. */
export function hasLeapMonth(year: number, month: number): boolean {
  const calendar = new KoreanLunarCalendar();
  return calendar.setLunarDate(year, month, 1, true);
}
