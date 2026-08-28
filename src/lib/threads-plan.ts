// 다음 20개 초안의 편성.
//
// 지시 문서 G의 표를 그대로 옮기되, 각 칸이 실제로 만들어질 수 있는지를 여기서
// 판정한다. 판정은 "승인된 사실이 있는가" 하나로 한다.
//
// 스무 개 중 일곱은 막힌다. 막힌 이유가 전부 같지 않아서, 이유를 칸마다 따로 적는다 —
// 나중에 무엇을 먼저 만들지 정하는 것이 그 목록이기 때문이다.

import {
  MISSING_ADAPTERS,
  blockedInput,
  buildDailyRelationInput,
  buildFreePreviewInput,
  buildTenGodInput,
  buildTermInput,
  buildUpsellInput,
  type TenGod,
} from "@/lib/threads-inputs";
import type { LoveRabbitContentInput } from "@/lib/threads-content";

/** 편성 기준일 — 스크립트에서 덮어쓸 수 있다 */
export const DEFAULT_START = "2026-08-21";

function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

export interface PlanSlot {
  input: LoveRabbitContentInput;
  /** 보고용 — 이 칸이 어느 레인의 몇 번째인가 */
  note: string;
}

/**
 * 스무 칸.
 *
 * 날짜는 편성일부터 하루씩 민다. 같은 날 여러 개가 나오는 레인은 같은 날짜를 쓴다 —
 * 일진이 같아야 같은 근거를 쓰기 때문이다.
 */
export function buildPlan(start = DEFAULT_START): PlanSlot[] {
  const slots: PlanSlot[] = [];
  const day = (n: number) => addDays(start, n);

  // ── 오늘의 12띠 / 관계 온도 · 4개 ──────────────────────────
  // SS-P02는 순위판이다. 띠 12종의 일일 점수·순위 산식이 없어 두 칸이 막힌다.
  for (let i = 0; i < 2; i += 1) {
    slots.push({
      note: `daily_zodiac ${i + 1}/4 — SS-P02 순위판`,
      input: blockedInput(
        {
          id: `daily-board-${i + 1}`,
          lane: "daily_zodiac",
          goal: "reach",
          patternId: "SS-P02-DAILY-12-ZODIAC-BOARD",
          date: day(i),
          cta: { type: "comment", text: "내 일간을 댓글에 남겨봐요." },
        },
        [...MISSING_ADAPTERS.dailyZodiacScore, ...MISSING_ADAPTERS.luckyColorDirection]
      ),
    });
  }
  // SS-P05는 경고 훅 + 행동 처방이다. 순위가 없어도 성립한다.
  for (let i = 0; i < 2; i += 1) {
    slots.push({
      note: `daily_zodiac ${i + 3}/4 — SS-P05 경고+처방`,
      input: buildDailyRelationInput({
        id: `daily-warn-${i + 1}`,
        lane: "daily_zodiac",
        goal: "reach",
        patternId: "SS-P05-WARNING-WITH-RELIEF",
        date: day(i + 2),
        targetCount: 4,
        cta: { type: "comment", text: "내 일간 모르면 생년월일 댓글에 남겨. 전체는 loverebbit.xyz 에서 봐." },
      }),
    });
  }

  // ── 주간 TOP · 랭킹 · 4개 ──────────────────────────────────
  // 전부 막힌다. SS-P01은 순위를 요구하고 규칙은 임의 랭킹을 금지한다.
  for (let i = 0; i < 4; i += 1) {
    slots.push({
      note: `weekly_ranking ${i + 1}/4 — SS-P01`,
      input: blockedInput(
        {
          id: `weekly-top-${i + 1}`,
          lane: "weekly_ranking",
          goal: "save",
          patternId: "SS-P01-WEEKLY-TOP-RANKING",
          date: day(i),
          cta: { type: "comment", text: "내 일간을 댓글에 남겨봐요." },
        },
        [...MISSING_ADAPTERS.weeklyRanking]
      ),
    });
  }

  // ── 겉과 속 · 관계 기질 · 5개 ──────────────────────────────
  // 십성 다섯 가지. 독자를 띠가 아니라 십성으로 부른다.
  const innerTenGods: TenGod[] = ["정관", "상관", "편인", "겁재", "정재"];
  innerTenGods.forEach((tenGod, i) => {
    slots.push({
      note: `inner_world ${i + 1}/5 — SS-P03 · ${tenGod}`,
      input: buildTenGodInput({
        id: `inner-${tenGod}`,
        lane: "inner_world",
        goal: "engagement",
        patternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
        date: day(i),
        tenGod,
        cta: { type: "comment", text: "내 십성 모르면 생년월일 댓글에 남겨요. 전체는 loverebbit.xyz 에서 봐요." },
      }),
    });
  });

  // ── 무료 리딩 · 이벤트 · 2개 ───────────────────────────────
  // 실제로 있는 무료 미리보기만 쓴다. 마감도 인원 제한도 붙이지 않는다.
  const previews: Array<{ slug: string; tenGod: TenGod }> = [
    { slug: "inner-mind", tenGod: "편관" },
    { slug: "romance-timing", tenGod: "정인" },
  ];
  previews.forEach((p, i) => {
    slots.push({
      note: `free_reading ${i + 1}/2 — SS-P04 · ${p.slug}`,
      input: buildFreePreviewInput({
        id: `free-${p.slug}`,
        lane: "free_reading",
        goal: "conversion",
        patternId: "SS-P04-FREE-READING-GATE",
        date: day(i),
        slug: p.slug,
        tenGod: p.tenGod,
        cta: { type: "link", text: "" },
      }),
    });
  });

  // ── 명리 용어 심층 번역 · 3개 ──────────────────────────────
  // 정의는 규칙의 source(고전 근거)에서, 오해는 규칙의 forbidden 에서 나온다.
  const terms: Array<{ id: string; tenGod?: TenGod; relation?: "지지충" | "지지육합" | "삼합" | "천간합" }> = [
    { id: "yukhap", relation: "지지육합" },
    { id: "chung", relation: "지지충" },
    { id: "siksin", tenGod: "식신" },
  ];
  terms.forEach((t, i) => {
    slots.push({
      note: `individual_reading ${i + 1}/3 — SS-P06 · ${t.relation ?? t.tenGod}`,
      input: buildTermInput({
        id: `term-${t.id}`,
        lane: "individual_reading",
        goal: "save",
        patternId: "SS-P06-TECHNICAL-TO-EVERYDAY",
        date: day(i),
        tenGod: t.tenGod,
        relation: t.relation,
        cta: { type: "share", text: "이 얘기 통할 사람에게 보내줘요." },
      }),
    });
  });

  // ── 서비스 · 웹툰 리딩 이야기 · 2개 ────────────────────────
  // SS-P07은 실제 출시·모집 사실이 있어야 쓸 수 있다. 없다.
  slots.push({
    note: "app_story 1/2 — SS-P07 출시 이야기",
    input: blockedInput(
      {
        id: "app-origin",
        lane: "app_story",
        goal: "conversion",
        patternId: "SS-P07-APP-ORIGIN-COMMUNITY",
        date: day(0),
        cta: { type: "link", text: "" },
      },
      [...MISSING_ADAPTERS.appLaunchStory]
    ),
  });
  // SS-P08은 "띠보다 일주가 좁다"는 구조 사실 하나로 성립한다.
  slots.push({
    note: "app_story 2/2 — SS-P08 일주 전환",
    input: buildUpsellInput({
      id: "upsell-daypillar",
      lane: "app_story",
      goal: "conversion",
      patternId: "SS-P08-ZODIAC-TO-DAY-PILLAR-UPSELL",
      date: day(1),
      cta: { type: "link", text: "" },
    }),
  });

  return slots;
}
