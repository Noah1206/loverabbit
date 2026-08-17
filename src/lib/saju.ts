// 사주 간지(干支) 계산 유틸리티.
// 연주·일주는 60갑자 주기로 정확히 계산하고, 월주·시주는 표준 규칙(월건법·시두법)을 따른다.
// 절기 경계(입춘 등)는 근사치를 쓰므로 경계일 ±1일은 오차가 있을 수 있다.

export const CHEONGAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const JIJI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;

export const CHEONGAN_OHAENG = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const;
export const JIJI_ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;

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
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function makePillar(ganIdx: number, jiIdx: number): Pillar {
  return { gan: CHEONGAN[ganIdx], ji: JIJI[jiIdx], ganIdx, jiIdx };
}

// 1900-01-01은 갑술일(甲戌日): 갑=0, 술=10
function dayPillar(date: Date): Pillar {
  const base = Date.UTC(1900, 0, 1);
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((target - base) / 86400000);
  return makePillar(mod(days, 10), mod(days + 10, 12));
}

// 연주: 입춘(대략 2/4) 기준으로 해가 바뀐다
function yearPillar(date: Date): Pillar {
  let y = date.getFullYear();
  const beforeIpchun = date.getMonth() === 0 || (date.getMonth() === 1 && date.getDate() < 4);
  if (beforeIpchun) y -= 1;
  return makePillar(mod(y - 4, 10), mod(y - 4, 12));
}

// 월지: 절기 기준 월 경계(각 월 4~8일경 절입, 근사치로 매월 6일 사용)
function monthPillar(date: Date, yearGanIdx: number): Pillar {
  // 인월(寅月)=음력 정월≈양력 2월. 월지 인덱스: 2월→인(2), 3월→묘(3) ...
  let m = date.getMonth() + 1; // 1~12
  if (date.getDate() < 6) m -= 1;
  if (m < 1) m += 12;
  const jiIdx = mod(m, 12); // 2월(m=2)→인덱스2(인)
  // 월간 두법: 갑·기년 → 병인월부터
  const startGan = [2, 4, 6, 8, 0][yearGanIdx % 5];
  const monthOrder = mod(jiIdx - 2, 12); // 인월=0
  return makePillar(mod(startGan + monthOrder, 10), jiIdx);
}

// 시주: 시두법. 자시(23~01시)부터 2시간 단위
function hourPillar(hour: number, dayGanIdx: number): Pillar {
  const jiIdx = mod(Math.floor((hour + 1) / 2), 12);
  const startGan = [0, 2, 4, 6, 8][dayGanIdx % 5]; // 갑·기일 → 갑자시부터
  return makePillar(mod(startGan + jiIdx, 10), jiIdx);
}

export function computeSaju(birth: {
  year: number;
  month: number; // 1~12
  day: number;
  hour: number | null; // 0~23, 모름이면 null
}): SajuChart {
  const date = new Date(birth.year, birth.month - 1, birth.day);
  const yp = yearPillar(date);
  const dp = dayPillar(date);
  const mp = monthPillar(date, yp.ganIdx);
  const hp = birth.hour === null ? null : hourPillar(birth.hour, dp.ganIdx);
  return {
    year: yp,
    month: mp,
    day: dp,
    hour: hp,
    dayOhaeng: CHEONGAN_OHAENG[dp.ganIdx],
    animal: JIJI_ANIMAL[yp.jiIdx],
  };
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
