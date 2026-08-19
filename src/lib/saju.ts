// 사주 간지(干支) 계산.
//
// 연·월 경계는 절기(태양 황경)로 정하고, 일주는 진태양시로 보정한 날짜에서,
// 시주는 진태양시로 세운다. 계산은 전부 결정론적이며 AI는 여기 관여하지 않는다.
//   - 절기 계산: solar-terms.ts
//   - 시각 보정: korea-time.ts

import { resolveBirthMoment, type BirthMoment, type ResolvedMoment } from "./korea-time";
import { isAfterIpchun, monthOrderAt } from "./solar-terms";

export const CHEONGAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const JIJI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;

export const CHEONGAN_OHAENG = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const;
// 지지의 본기(本氣) 오행 — 자축인묘진사오미신유술해 순서
export const JIJI_OHAENG = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"] as const;
export const JIJI_ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;

export type Ohaeng = "목" | "화" | "토" | "금" | "수";

export interface Pillar {
  gan: string;
  ji: string;
  ganIdx: number;
  jiIdx: number;
}

export interface SajuChart {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null; // 시간 모름이면 null
  dayOhaeng: string; // 일간 오행 — 리딩의 핵심 축
  animal: string;
  /** 사주상의 해 (입춘 기준). 1월 출생은 전년도가 된다. */
  sajuYear: number;
  /** 인월=0 ... 축월=11 */
  monthOrder: number;
  moment: ResolvedMoment;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function makePillar(ganIdx: number, jiIdx: number): Pillar {
  return { gan: CHEONGAN[ganIdx], ji: JIJI[jiIdx], ganIdx, jiIdx };
}

// 1900-01-01은 갑술일(甲戌日): 갑=0, 술=10
export function dayPillarOf(dayUtcMs: number): Pillar {
  const days = Math.round((dayUtcMs - Date.UTC(1900, 0, 1)) / 86400000);
  return makePillar(mod(days, 10), mod(days + 10, 12));
}

// 연주 — 입춘을 지났는지로 해가 갈린다
export function yearPillarOf(sajuYear: number): Pillar {
  return makePillar(mod(sajuYear - 4, 10), mod(sajuYear - 4, 12));
}

// 월주 — 월지는 절기로, 월간은 두법(갑기년 병인월)으로
export function monthPillarOf(monthOrder: number, yearGanIdx: number): Pillar {
  const jiIdx = mod(monthOrder + 2, 12); // 인월(order 0) = 지지 인덱스 2
  const startGan = [2, 4, 6, 8, 0][yearGanIdx % 5]; // 갑·기년 -> 병인월부터
  return makePillar(mod(startGan + monthOrder, 10), jiIdx);
}

// 시주 — 시두법. 자시(23~01시)부터 2시간 단위
export function hourPillarOf(solarHour: number, dayGanIdx: number): Pillar {
  const jiIdx = mod(Math.floor((solarHour + 1) / 2), 12);
  const startGan = [0, 2, 4, 6, 8][dayGanIdx % 5]; // 갑·기일 -> 갑자시부터
  return makePillar(mod(startGan + jiIdx, 10), jiIdx);
}

export function computeSaju(birth: BirthMoment): SajuChart {
  const moment = resolveBirthMoment(birth);

  const sajuYear = isAfterIpchun(moment.instantUtcMs, birth.month) ? birth.year : birth.year - 1;
  const monthOrder = monthOrderAt(moment.instantUtcMs);

  const yp = yearPillarOf(sajuYear);
  const mp = monthPillarOf(monthOrder, yp.ganIdx);
  const dp = dayPillarOf(moment.solarDayUtcMs);
  const hp = moment.solarHourOfDay === null ? null : hourPillarOf(moment.solarHourOfDay, dp.ganIdx);

  return {
    year: yp,
    month: mp,
    day: dp,
    hour: hp,
    dayOhaeng: CHEONGAN_OHAENG[dp.ganIdx],
    animal: JIJI_ANIMAL[yp.jiIdx],
    sajuYear,
    monthOrder,
    moment,
  };
}

/** 지금 시점의 세운(그 해)·월운(그 달) 기둥 */
export function currentLuckPillars(now = new Date()): { year: Pillar; month: Pillar; sajuYear: number } {
  const chart = computeSaju({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 12,
  });
  return { year: chart.year, month: chart.month, sajuYear: chart.sajuYear };
}

export function pillarLabel(p: Pillar | null): string {
  return p ? `${p.gan}${p.ji}` : "미상";
}

export function chartSummary(c: SajuChart): string {
  return [
    `연주 ${pillarLabel(c.year)} (띠: ${c.animal})`,
    `월주 ${pillarLabel(c.month)}`,
    `일주 ${pillarLabel(c.day)} (일간 오행: ${c.dayOhaeng})`,
    `시주 ${pillarLabel(c.hour)}`,
  ].join(", ");
}
