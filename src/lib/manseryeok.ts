// 만세력 계산기가 화면에 뿌릴 값을 모은다.
//
// 계산은 여기서 하지 않는다. 명식은 saju.ts, 해석 단서는 saju-facts.ts,
// 대운은 majorLuckPlan 이 낸다. 이 파일이 하는 일은 그 결과를 표 한 장으로
// 늘어놓는 것뿐이다 — 유료 리딩과 무료 만세력이 같은 숫자를 보게 하려면
// 계산이 두 벌이 되어서는 안 된다.
//
// 입력은 주소창에서 온다. 결과 주소가 곧 공유 링크가 되도록 짧은 키를 쓴다.
//   /manseryeok?y=1995&m=3&d=14&h=9&g=F&cal=lunar&leap=1

import {
  CHEONGAN,
  CHEONGAN_HANJA,
  CHEONGAN_OHAENG,
  JIJI,
  JIJI_ANIMAL,
  JIJI_HANJA,
  JIJI_OHAENG,
  computeSaju,
  pillarLabel,
  type Ohaeng,
  type Pillar,
  type SajuChart,
} from "@/lib/saju";
import {
  buildSajuFacts,
  majorLuckPlan,
  tenGodOf,
  stemElement,
  type Gender,
  type SajuFacts,
} from "@/lib/saju-facts";
import { hiddenStemsOf, stemPolarity } from "@/lib/myeongri/hidden-stems";
import { lunarToSolar, solarToLunar } from "@/lib/lunar";

/** 대운 표에 늘어놓을 칸 수. 열 칸이면 100세를 넘어가서 여덟로 둔다. */
export const MAJOR_LUCK_COLUMNS = 8;

export interface ManseryeokQuery {
  year: number;
  month: number;
  day: number;
  /** 0~23, 모르면 null */
  hour: number | null;
  gender: Gender;
  calendar: "solar" | "lunar";
  leapMonth: boolean;
}

export interface Glyph {
  hanja: string;
  hangul: string;
  ohaeng: Ohaeng;
  /** 일간은 십성이 없다 — 기준이 자기 자신이라 '나'로 둔다 */
  tenGod: string;
}

export interface PillarView {
  label: "시주" | "일주" | "월주" | "년주";
  stem: Glyph | null;
  branch: Glyph | null;
  /** 지지 속에 든 천간 — 본기가 앞에 온다 */
  hidden: Array<{ stem: string; ohaeng: Ohaeng; role: string; tenGod: string }>;
}

export interface MajorLuckColumn {
  fromAge: number;
  toAge: number;
  /** 그 칸이 시작되는 해 (양력) */
  fromYear: number;
  stem: Glyph;
  branch: Glyph;
  /** 지금 걸려 있는 칸인가 */
  current: boolean;
}

export interface Manseryeok {
  query: ManseryeokQuery;
  chart: SajuChart;
  facts: SajuFacts;
  pillars: PillarView[];
  /** 일간 — 이 명식의 기준점 */
  dayMaster: { hanja: string; hangul: string; ohaeng: Ohaeng; label: string };
  animal: string;
  elementBars: Array<{ ohaeng: Ohaeng; count: number; ratio: number }>;
  majorLuck: { direction: "순행" | "역행"; startAge: number; columns: MajorLuckColumn[] };
  today: { date: string; pillar: string; tenGod: string };
  /** 사람이 읽는 생일 한 줄 — 음력이면 양력 환산까지 */
  birthLine: string;
  /** 양력·음력을 서로 되짚은 값 */
  solar: { year: number; month: number; day: number };
  lunar: { year: number; month: number; day: number; leapMonth: boolean } | null;
  notes: string[];
}

const POSITION_OF: Record<string, string> = {
  년주간: "연간",
  년주지: "연지",
  월주간: "월간",
  월주지: "월지",
  일주지: "일지",
  시주간: "시간",
  시주지: "시지",
};

const HIDDEN_ROLE: Record<string, string> = {
  main: "본기",
  middle: "중기",
  residual: "여기",
};

const ELEMENTS: Ohaeng[] = ["목", "화", "토", "금", "수"];

function isYangStem(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

/**
 * 주소창 값을 입력으로 읽는다. 하나라도 말이 안 되면 null 이다 —
 * 반쯤 맞는 입력으로 명식을 세우면 틀린 명식이 맞는 얼굴로 나간다.
 */
export function parseManseryeokQuery(
  raw: Record<string, string | string[] | undefined>
): ManseryeokQuery | null {
  const one = (key: string): string | null => {
    const value = raw[key];
    const picked = Array.isArray(value) ? value[0] : value;
    return picked === undefined || picked === "" ? null : picked;
  };
  const num = (key: string): number | null => {
    const value = one(key);
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const year = num("y");
  const month = num("m");
  const day = num("d");
  if (year === null || month === null || day === null) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const calendar = one("cal") === "lunar" ? "lunar" : "solar";
  const hourRaw = one("h");
  const hour = hourRaw === null || hourRaw === "unknown" ? null : Number(hourRaw);
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) return null;

  // 양력은 그 달에 실제로 있는 날짜인지 확인한다. 2월 30일이 조용히 3월 2일이 되면
  // 명식이 통째로 어긋난다.
  if (calendar === "solar") {
    const probe = new Date(year, month - 1, day);
    if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  }

  return {
    year,
    month,
    day,
    hour,
    gender: one("g") === "M" ? "M" : "F",
    calendar,
    leapMonth: one("leap") === "1",
  };
}

export function manseryeokHref(query: ManseryeokQuery): string {
  const params = new URLSearchParams({
    y: String(query.year),
    m: String(query.month),
    d: String(query.day),
    h: query.hour === null ? "unknown" : String(query.hour),
    g: query.gender,
  });
  if (query.calendar === "lunar") {
    params.set("cal", "lunar");
    if (query.leapMonth) params.set("leap", "1");
  }
  return `/manseryeok?${params.toString()}`;
}

function glyphOfStem(ganIdx: number, tenGod: string): Glyph {
  return {
    hanja: CHEONGAN_HANJA[ganIdx],
    hangul: CHEONGAN[ganIdx],
    ohaeng: CHEONGAN_OHAENG[ganIdx],
    tenGod,
  };
}

function glyphOfBranch(jiIdx: number, tenGod: string): Glyph {
  return {
    hanja: JIJI_HANJA[jiIdx],
    hangul: JIJI[jiIdx],
    ohaeng: JIJI_OHAENG[jiIdx],
    tenGod,
  };
}

/** 지지 속 천간에도 십성을 매긴다 — 겉으로 안 드러난 글자가 어디에 걸리는지 보이게 */
function hiddenOf(pillar: Pillar, dayElement: Ohaeng, dayYang: boolean) {
  return hiddenStemsOf(pillar.jiIdx).map((hidden) => ({
    stem: hidden.stem,
    ohaeng: hidden.element,
    role: HIDDEN_ROLE[hidden.role] ?? hidden.role,
    tenGod: tenGodOf(dayElement, dayYang, hidden.element, stemPolarity(hidden.stem) === "yang"),
  }));
}

/**
 * 시각을 모르면 시주를 세우지 않는다. 만세력에서 이 칸을 임의로 채우는 곳이
 * 있는데, 모르는 값을 채우면 십성 두 개와 지장간 한 벌이 통째로 지어진다.
 */
function pillarViews(chart: SajuChart, facts: SajuFacts): PillarView[] {
  const tenGodAt = new Map<string, string>(facts.tenGods.map((fact) => [fact.position as string, fact.tenGod]));
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);

  const rows: Array<{ label: PillarView["label"]; key: string; pillar: Pillar | null }> = [
    { label: "시주", key: "시주", pillar: chart.hour },
    { label: "일주", key: "일주", pillar: chart.day },
    { label: "월주", key: "월주", pillar: chart.month },
    { label: "년주", key: "년주", pillar: chart.year },
  ];

  return rows.map(({ label, key, pillar }) => {
    if (!pillar) return { label, stem: null, branch: null, hidden: [] };
    // 일간만 십성이 없다. 기준이 자기 자신이라 재는 대상이 아니다.
    const stemTenGod = key === "일주" ? "일원" : tenGodAt.get(POSITION_OF[`${key}간`] ?? "") ?? "";
    const branchTenGod = tenGodAt.get(POSITION_OF[`${key}지`] ?? "") ?? "";
    return {
      label,
      stem: glyphOfStem(pillar.ganIdx, stemTenGod),
      branch: glyphOfBranch(pillar.jiIdx, branchTenGod),
      hidden: hiddenOf(pillar, dayElement, dayYang),
    };
  });
}

function majorLuckColumns(chart: SajuChart, gender: Gender, birthYear: number, now: Date) {
  const plan = majorLuckPlan(chart, gender);
  const dayElement = stemElement(chart.day.ganIdx);
  const dayYang = isYangStem(chart.day.ganIdx);
  const ageNow = now.getFullYear() - birthYear + 1; // 세는나이 — 대운 표기 관행

  const columns: MajorLuckColumn[] = [];
  for (let step = 0; step < MAJOR_LUCK_COLUMNS; step += 1) {
    const pillar = plan.pillarAt(step);
    const fromAge = plan.startAge + step * 10;
    const toAge = fromAge + 9;
    columns.push({
      fromAge,
      toAge,
      fromYear: birthYear + fromAge - 1,
      stem: glyphOfStem(
        pillar.ganIdx,
        tenGodOf(dayElement, dayYang, stemElement(pillar.ganIdx), isYangStem(pillar.ganIdx))
      ),
      branch: glyphOfBranch(pillar.jiIdx, ""),
      current: ageNow >= fromAge && ageNow <= toAge,
    });
  }
  return { direction: plan.direction, startAge: plan.startAge, columns };
}

function birthLineOf(query: ManseryeokQuery, solar: { year: number; month: number; day: number }): string {
  const stamp = (y: number, m: number, d: number) => `${y}년 ${m}월 ${d}일`;
  const time = query.hour === null ? "시간 모름" : `${String(query.hour).padStart(2, "0")}시`;
  if (query.calendar === "lunar") {
    const leap = query.leapMonth ? " 윤달" : "";
    return `음력 ${stamp(query.year, query.month, query.day)}${leap} · 양력 ${stamp(solar.year, solar.month, solar.day)} · ${time}`;
  }
  return `양력 ${stamp(solar.year, solar.month, solar.day)} · ${time}`;
}

/**
 * 만세력 한 장.
 *
 * 음력 입력은 여기서 양력으로 바꾼다. 사주는 태양의 위치로 계산하므로
 * 음력 날짜를 그대로 넣으면 한 달 가까이 어긋난 명식이 나간다.
 * 그 달에 윤달이 없는데 윤달을 요청하면 null 이다 — 조용히 평달로 넘기지 않는다.
 */
export function buildManseryeok(query: ManseryeokQuery, now = new Date()): Manseryeok | null {
  let solar = { year: query.year, month: query.month, day: query.day };
  const notes: string[] = [];

  if (query.calendar === "lunar") {
    const converted = lunarToSolar({ ...solar, leapMonth: query.leapMonth });
    if (!converted) return null;
    solar = converted.solar;
    notes.push(converted.note);
  }

  const birth = { ...solar, hour: query.hour, gender: query.gender };
  const facts = buildSajuFacts(birth, now);
  const chart = computeSaju(birth);
  notes.push(...chart.moment.notes);

  const balance = facts.elementBalance;
  const total = ELEMENTS.reduce((sum, element) => sum + balance[element], 0) || 1;

  const todayChart = computeSaju({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 12,
  });

  return {
    query,
    chart,
    facts,
    pillars: pillarViews(chart, facts),
    dayMaster: {
      hanja: CHEONGAN_HANJA[chart.day.ganIdx],
      hangul: CHEONGAN[chart.day.ganIdx],
      ohaeng: CHEONGAN_OHAENG[chart.day.ganIdx],
      label: facts.dayMaster,
    },
    animal: `${JIJI_ANIMAL[chart.year.jiIdx]}띠`,
    elementBars: ELEMENTS.map((ohaeng) => ({
      ohaeng,
      count: balance[ohaeng],
      ratio: Math.round((balance[ohaeng] / total) * 100),
    })),
    majorLuck: majorLuckColumns(chart, query.gender, solar.year, now),
    today: {
      date: `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`,
      pillar: pillarLabel(todayChart.day),
      tenGod: tenGodOf(
        stemElement(chart.day.ganIdx),
        isYangStem(chart.day.ganIdx),
        stemElement(todayChart.day.ganIdx),
        isYangStem(todayChart.day.ganIdx)
      ),
    },
    birthLine: birthLineOf(query, solar),
    solar,
    lunar: query.calendar === "lunar"
      ? { year: query.year, month: query.month, day: query.day, leapMonth: query.leapMonth }
      : solarToLunar(solar),
    notes,
  };
}
