// 절기 계산 — 태양의 겉보기 황경(黃經)으로 사주의 연·월 경계를 정한다.
//
// 사주의 한 해는 1월 1일이 아니라 입춘(황경 315도)에 바뀌고, 달은 12절(節)마다 바뀐다.
// 절기는 날짜가 해마다 하루씩 움직이므로 "매월 6일" 같은 근사로는 경계일 출생자의
// 기둥이 통째로 틀린다. 그래서 태양 위치를 직접 계산한다.
//
// 계산식은 Meeus, Astronomical Algorithms 25장의 저정밀 태양 위치.
// 오차는 황경 기준 약 0.01도 — 시간으로 환산하면 15분 안쪽이다.

const DEG = Math.PI / 180;
/** 태양 황경의 하루 평균 이동량 (도) */
const DEG_PER_DAY = 0.9856473;

function toJulianDay(utcMs: number): number {
  return utcMs / 86400000 + 2440587.5;
}

/** 각도를 [0, 360) 범위로 */
function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 각도 차이를 [-180, 180) 범위로 — 경계를 넘는 비교에 쓴다 */
function normDelta(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/**
 * 주어진 순간의 태양 겉보기 황경 (도).
 */
export function sunApparentLongitude(utcMs: number): number {
  const jd = toJulianDay(utcMs);
  const t = (jd - 2451545.0) / 36525;

  // 태양의 기하 평균 황경
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  // 태양의 평균 근점이각
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const mRad = m * DEG;
  // 중심차
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
    0.000289 * Math.sin(3 * mRad);
  const trueLongitude = l0 + c;

  // 장동(章動)과 광행차 보정
  const omega = 125.04 - 1934.136 * t;
  return norm360(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * DEG));
}

/**
 * 태양 황경이 target(도)이 되는 순간을 찾는다. near 근처의 해를 찾아 반환한다.
 * 뉴턴법 — 황경은 거의 일정한 속도로 증가하므로 서너 번이면 수렴한다.
 */
export function solarLongitudeMoment(target: number, nearUtcMs: number): number {
  let ms = nearUtcMs;
  for (let i = 0; i < 8; i += 1) {
    const diff = normDelta(sunApparentLongitude(ms) - target);
    if (Math.abs(diff) < 1e-7) break;
    ms -= (diff / DEG_PER_DAY) * 86400000;
  }
  return ms;
}

/** 월(月)의 경계가 되는 12절의 황경 — 입춘 315도에서 30도 간격 */
export const MONTH_TERM_LONGITUDES = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285];

/** 12절의 이름 (인월부터) */
export const MONTH_TERM_NAMES = [
  "입춘", "경칩", "청명", "입하", "망종", "소서",
  "입추", "백로", "한로", "입동", "대설", "소한",
];

/**
 * 이 순간이 몇 번째 달(인월=0 ... 축월=11)에 속하는지.
 * 입춘(315도)부터 30도씩 끊는다.
 */
export function monthOrderAt(utcMs: number): number {
  return Math.floor(norm360(sunApparentLongitude(utcMs) - 315) / 30);
}

/** 입춘을 지났는가 — 사주의 해가 바뀌는 기준 */
export function isAfterIpchun(utcMs: number, calendarMonth: number): boolean {
  if (calendarMonth >= 3) return true; // 3월 이후는 항상 입춘 이후
  return sunApparentLongitude(utcMs) >= 315 && sunApparentLongitude(utcMs) < 360;
}

export interface TermBoundary {
  name: string;
  utcMs: number;
  monthOrder: number;
}

/** 이 순간이 속한 달이 시작된 절입 시각 */
export function previousMonthTerm(utcMs: number): TermBoundary {
  const order = monthOrderAt(utcMs);
  const target = MONTH_TERM_LONGITUDES[order];
  // 목표 황경까지의 거리(항상 과거 방향)를 어림해 출발점을 잡는다
  const back = norm360(sunApparentLongitude(utcMs) - target);
  const moment = solarLongitudeMoment(target, utcMs - (back / DEG_PER_DAY) * 86400000);
  return { name: MONTH_TERM_NAMES[order], utcMs: moment, monthOrder: order };
}

/** 이 순간 다음에 오는 절입 시각 */
export function nextMonthTerm(utcMs: number): TermBoundary {
  const order = (monthOrderAt(utcMs) + 1) % 12;
  const target = MONTH_TERM_LONGITUDES[order];
  const ahead = norm360(target - sunApparentLongitude(utcMs));
  const moment = solarLongitudeMoment(target, utcMs + (ahead / DEG_PER_DAY) * 86400000);
  return { name: MONTH_TERM_NAMES[order], utcMs: moment, monthOrder: order };
}

/** 특정 해의 특정 절기 시각 (검증·표시용). termLongitude는 15도 배수. */
export function solarTermOfYear(year: number, termLongitude: number): Date {
  // 춘분(0도)이 3월 20일경이므로 목표 황경에서 대략의 날짜를 역산해 출발점으로 쓴다
  const approxDayOfYear = 79 + norm360(termLongitude) / DEG_PER_DAY;
  const guess = Date.UTC(year, 0, 1) + approxDayOfYear * 86400000;
  const wrapped = norm360(termLongitude) >= 300 ? guess - 365.2422 * 86400000 : guess;
  return new Date(solarLongitudeMoment(norm360(termLongitude), wrapped));
}
