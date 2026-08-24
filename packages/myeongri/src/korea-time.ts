// 출생 시각 -> 절대 시각(UTC)과 진태양시 변환.
//
// 사주는 태양의 위치로 계산하므로, 입력받은 "1990년 5월 15일 13시"가 지구 위 어느 순간인지
// 먼저 확정해야 한다. 한국은 표준시 기준 자오선이 두 번 바뀌었고 서머타임도 있었기 때문에,
// 같은 시계 시각이라도 연도에 따라 실제 태양시가 다르다.
//
// 여기서 처리하는 것:
//   1. 표준시 기준 자오선 변경 (UTC+8:30 <-> UTC+9)
//   2. 서머타임 (1987~1988년 — 지금의 주 사용자 연령대에 해당)
//   3. 진태양시 보정 (표준 자오선 135도와 실제 출생지 경도의 차이)
//
// 1948~1960년 서머타임은 적용하지 않는다. 자료마다 시행일이 엇갈리고,
// 해당 연도 출생자는 이 서비스의 사용자층 밖이다. 이 한계는 계산 노트에 남긴다.

export const SEOUL_LONGITUDE = 126.978; // 서울 종로 기준
const STANDARD_MERIDIAN = 135; // 동경 135도 = UTC+9의 기준 자오선

export interface BirthMoment {
  year: number;
  month: number; // 1~12
  day: number;
  hour: number | null; // 0~23, 모르면 null
  minute?: number;
  longitude?: number; // 출생지 경도 (기본: 서울)
}

export interface ResolvedMoment {
  /** 출생 순간의 절대 시각 — 절기(연·월 경계) 판정에 쓴다 */
  instantUtcMs: number;
  /** 진태양시로 보정한 날짜의 자정 — 일주 계산에 쓴다 */
  solarDayUtcMs: number;
  /** 진태양시 기준 시각 (0~24 미만, 시 단위 소수) — 시주 계산에 쓴다. 시각 미상이면 null */
  solarHourOfDay: number | null;
  /** 진태양시 보정으로 날짜가 밀렸는가 (-1, 0, +1) */
  solarDayShift: number;
  offsetMinutes: number;
  longitudeCorrectionMinutes: number;
  notes: string[];
}

function ymdNumber(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

// 한국 표준시 기준 자오선의 역사. 경계일은 시행일 당일부터 적용한다.
function standardOffsetMinutes(year: number, month: number, day: number): { offset: number; note: string } {
  const ymd = ymdNumber(year, month, day);
  // 1908-04-01 ~ 1911-12-31: 동경 127.5도 (UTC+8:30)
  if (ymd >= 19080401 && ymd <= 19111231) {
    return { offset: 510, note: "표준시 UTC+8:30 (동경 127.5도, 1908~1911)" };
  }
  // 1954-03-21 ~ 1961-08-09: 동경 127.5도 (UTC+8:30)
  if (ymd >= 19540321 && ymd <= 19610809) {
    return { offset: 510, note: "표준시 UTC+8:30 (동경 127.5도, 1954~1961)" };
  }
  return { offset: 540, note: "표준시 UTC+9 (동경 135도)" };
}

// 서머타임 — 시행 기간에는 시계가 한 시간 앞당겨져 있었으므로 그만큼 되돌린다.
const DST_WINDOWS: { from: number; to: number; label: string }[] = [
  { from: 19870510, to: 19871011, label: "1987년 서머타임" },
  { from: 19880508, to: 19881009, label: "1988년 서머타임" },
];

function dstMinutes(year: number, month: number, day: number): { offset: number; note: string | null } {
  const ymd = ymdNumber(year, month, day);
  const hit = DST_WINDOWS.find((w) => ymd >= w.from && ymd <= w.to);
  return hit ? { offset: 60, note: `${hit.label} 적용 (시계 -1시간 보정)` } : { offset: 0, note: null };
}

/**
 * 시계에 적힌 출생 시각을 절대 시각과 진태양시로 바꾼다.
 *
 * 일주 경계는 자정 기준(야자시)을 쓴다. 23시 이후 출생이라도 그날의 일주를 그대로 쓰고,
 * 시주만 자시로 세운다. 국내 만세력에서 널리 쓰이는 방식이고, 기존 리딩과도 어긋나지 않는다.
 */
export function resolveBirthMoment(birth: BirthMoment): ResolvedMoment {
  const notes: string[] = [];
  const longitude = birth.longitude ?? SEOUL_LONGITUDE;

  const standard = standardOffsetMinutes(birth.year, birth.month, birth.day);
  notes.push(standard.note);
  const dst = dstMinutes(birth.year, birth.month, birth.day);
  if (dst.note) notes.push(dst.note);
  const offsetMinutes = standard.offset - dst.offset;

  const knownHour = birth.hour !== null && birth.hour !== undefined;
  const hour = knownHour ? (birth.hour as number) : 12;
  const minute = birth.minute ?? 0;

  // 시계 시각(현지) -> UTC. 절기 판정은 이 절대 시각으로 한다.
  const instantUtcMs = Date.UTC(birth.year, birth.month - 1, birth.day, hour, minute) - offsetMinutes * 60000;

  // 진태양시: 표준 자오선과의 경도 차이를 분으로 환산 (1도 = 4분)
  const longitudeCorrectionMinutes = (longitude - STANDARD_MERIDIAN) * 4;

  const midnightUtcMs = Date.UTC(birth.year, birth.month - 1, birth.day);
  let solarDayUtcMs = midnightUtcMs;
  let solarHourOfDay: number | null = null;
  let solarDayShift = 0;

  if (knownHour) {
    // 보정 때문에 자정을 넘나들 수 있다. 넘어가면 날짜(일주)도 함께 옮긴다.
    const corrected = midnightUtcMs + (hour * 60 + minute + longitudeCorrectionMinutes) * 60000;
    solarDayUtcMs = Math.floor(corrected / 86400000) * 86400000;
    solarHourOfDay = (corrected - solarDayUtcMs) / 3600000;
    solarDayShift = Math.round((solarDayUtcMs - midnightUtcMs) / 86400000);
    notes.push(
      `진태양시 보정 ${longitudeCorrectionMinutes >= 0 ? "+" : ""}${longitudeCorrectionMinutes.toFixed(0)}분 (경도 ${longitude.toFixed(3)}도)`
    );
    if (solarDayShift !== 0) {
      notes.push(`보정으로 일주 기준일이 ${solarDayShift > 0 ? "다음" : "이전"} 날로 넘어감`);
    }
  } else {
    notes.push("출생 시각 미상 — 시주를 세우지 않고 세 기둥으로만 읽음");
  }
  notes.push("일주 경계는 자정 기준(야자시)");
  notes.push("1948~1960년 서머타임 미적용");

  return {
    instantUtcMs,
    solarDayUtcMs,
    solarHourOfDay,
    solarDayShift,
    offsetMinutes,
    longitudeCorrectionMinutes,
    notes,
  };
}
