// 러브레빗 명리 엔진 → Threads 입력(LoveRabbitContentInput) 어댑터.
//
// 이 파일의 일은 "오늘 무엇을 주장해도 되는가"를 정하는 것이다.
//
// 리딩은 생년월일시를 받아 명식 하나를 통째로 세운 뒤 matchRules()로 규칙을 켠다.
// Threads는 독자의 명식을 모른다. 그래서 여기서는 명식 없이도 확정되는 축만 쓴다.
//
//   1. 오늘의 일진 간지            — dayPillarOf. 계산이라 다툼의 여지가 없다.
//   2. 일간 10종 × 오늘 일진의 십성 — tenGodOf. 두 글자만 있으면 정해진다.
//   3. 십성 10종 자체의 성정        — 독자가 자기 십성을 아는 경우에 건다.
//
// 축이 정해지면 주장은 READING_RULES에서 그대로 꺼내 쓴다. 새로 쓰지 않는다.
// 규칙 밖의 축(띠별 일일 점수, 주간 랭킹, 행운색·방향)은 승인 테이블이 없으므로
// 입력을 만들지 않고 missingFacts에 이유를 적어 돌려준다 — 빈 입력으로 생성에
// 넘기면 모델이 그 자리를 지어낸다.

import { CHEONGAN, CHEONGAN_OHAENG, JIJI, dayPillarOf, type Pillar } from "@/lib/saju";
import { tenGodOf } from "@/lib/saju-facts";
import { READING_RULES, type ReadingRule } from "@/lib/reading-rules";
import type {
  ApprovedFact,
  LoveRabbitContentInput,
  ThreadContentLane,
  ThreadCtaType,
  ThreadGoal,
} from "@/lib/threads-content";
import { SITE_URL } from "@/lib/site";

/** 십성 열 가지 — 규칙 표의 키와 같은 표기를 쓴다 */
export type TenGod =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

/**
 * 운에서 들어온 십성 → 그 흐름을 설명하는 승인 규칙.
 *
 * LUCK-* 는 원래 대운·세운·월운을 두고 쓰는 규칙이다. 일진도 같은 운이라
 * 축이 어긋나지 않는다. 다만 관성·재성은 남녀에서 뜻이 갈리므로(배우자성인지
 * 아닌지) 성별 세그먼트를 지정하지 않은 글에는 쓰지 않는다.
 */
export const LUCK_RULE_BY_TENGOD: Record<TenGod, { any?: string; F?: string; M?: string }> = {
  정인: { any: "LUCK-IN" },
  편인: { any: "LUCK-IN" },
  식신: { any: "LUCK-SIKSANG" },
  상관: { any: "LUCK-SIKSANG" },
  비견: { any: "LUCK-BIGEOP" },
  겁재: { any: "LUCK-BIGEOP" },
  정관: { F: "LUCK-GWAN-F", M: "LUCK-GWAN-M" },
  편관: { F: "LUCK-GWAN-F", M: "LUCK-GWAN-M" },
  정재: { F: "LUCK-JAE-F", M: "LUCK-JAE-M" },
  편재: { F: "LUCK-JAE-F", M: "LUCK-JAE-M" },
};

/** 십성 자체의 성정을 설명하는 승인 규칙 — 독자가 자기 십성을 아는 글에 쓴다 */
export const TENGOD_RULE: Record<TenGod, string> = {
  정관: "TG-JEONGGWAN",
  편관: "TG-PYEONGWAN",
  정재: "TG-JEONGJAE",
  편재: "TG-PYEONJAE",
  식신: "TG-SIKSIN",
  상관: "TG-SANGGWAN",
  정인: "TG-JEONGIN",
  편인: "TG-PYEONIN",
  비견: "TG-BIGYEON",
  겁재: "TG-GEOPJAE",
};

/** 형충회합의 정의를 설명하는 승인 규칙 — 사주 교실용 */
export const RELATION_RULE: Record<string, string> = {
  지지충: "REL-CHUNG",
  지지육합: "REL-YUKHAP",
  삼합: "REL-SAMHAP",
  천간합: "REL-CHEONHAP",
};

const RULE_BY_ID = new Map(READING_RULES.map((r) => [r.id, r]));

export class MissingRuleError extends Error {}

export function ruleById(id: string): ReadingRule {
  const rule = RULE_BY_ID.get(id);
  if (!rule) throw new MissingRuleError(`승인 규칙이 없다 — ${id}`);
  return rule;
}

/**
 * 규칙 하나를 승인 사실로.
 *
 * claimId 는 규칙 안에서 어느 문장을 골랐는지 가리킨다. 규칙이 claim 하나만
 * 갖고 있어 지금은 항상 "#claim" 이지만, 나중에 한 규칙이 문맥별로 여러 문장을
 * 갖게 되면 이 자리가 갈린다. 그때 초안을 되짚을 수 있게 지금부터 남긴다.
 */
export function approvedFactOf(ruleId: string, scope: string): ApprovedFact {
  const rule = ruleById(ruleId);
  return {
    ruleId: rule.id,
    claimId: `${rule.id}#claim`,
    safePhrasing: rule.claim,
    scope,
  };
}

export interface DayGanji {
  pillar: Pillar;
  /** "병오" */
  label: string;
  /** ISO 날짜 (Asia/Seoul 기준의 그 날) */
  date: string;
}

/**
 * 그 날의 일진.
 *
 * dayPillarOf 는 UTC 자정 기준 일수로 센다. Threads 글은 한국 날짜로 쓰므로
 * "2026-08-24" 라는 날짜 문자열을 그대로 UTC 자정으로 읽는다 — 한국의 그 날과
 * 같은 간지가 나온다.
 */
export function dayGanjiFor(dateISO: string): DayGanji {
  const [y, m, d] = dateISO.split("-").map(Number);
  const pillar = dayPillarOf(Date.UTC(y, m - 1, d));
  return { pillar, label: `${pillar.gan}${pillar.ji}`, date: dateISO };
}

const isYang = (ganIdx: number) => ganIdx % 2 === 0;

/** 오늘 일진의 일간이, 어떤 일간에게 무슨 십성인가 */
export function tenGodOfDayLuck(natalGanIdx: number, luckGanIdx: number): TenGod {
  return tenGodOf(
    CHEONGAN_OHAENG[natalGanIdx],
    isYang(natalGanIdx),
    CHEONGAN_OHAENG[luckGanIdx],
    isYang(luckGanIdx)
  ) as TenGod;
}

export interface StemEntry {
  stem: string;
  stemIdx: number;
  tenGod: TenGod;
  ruleId: string;
}

/**
 * 오늘 일진 기준으로 열 개 일간을 훑어, 승인 규칙이 걸리는 것만 남긴다.
 *
 * 성별 세그먼트를 주지 않으면 관성·재성에 걸리는 네 개가 빠진다. 그 넷은
 * 남녀에서 뜻이 반대라, 아무 쪽으로나 쓰면 절반의 독자에게 틀린 말이 된다.
 */
export function stemsForDay(ganji: DayGanji, gender?: "F" | "M"): {
  entries: StemEntry[];
  skipped: Array<{ stem: string; tenGod: TenGod; reason: string }>;
} {
  const entries: StemEntry[] = [];
  const skipped: Array<{ stem: string; tenGod: TenGod; reason: string }> = [];

  CHEONGAN.forEach((stem, idx) => {
    const tenGod = tenGodOfDayLuck(idx, ganji.pillar.ganIdx);
    const mapping = LUCK_RULE_BY_TENGOD[tenGod];
    const ruleId = mapping.any ?? (gender ? mapping[gender] : undefined);
    if (!ruleId) {
      skipped.push({
        stem,
        tenGod,
        reason: `${tenGod}은 남녀에서 뜻이 갈린다 — 성별 세그먼트를 정하지 않으면 쓸 수 없다`,
      });
      return;
    }
    entries.push({ stem, stemIdx: idx, tenGod, ruleId });
  });

  return { entries, skipped };
}

export interface BuildInputOptions {
  id: string;
  lane: ThreadContentLane;
  goal: ThreadGoal;
  patternId: string;
  date: string;
  /** 이 글이 어느 쪽 사주를 두고 쓰는지. 관성·재성 규칙을 켤 때만 필요하다. */
  gender?: "F" | "M";
  /** inner_world / individual_reading 이 다룰 십성 */
  tenGod?: TenGod;
  /** individual_reading 이 다룰 형충회합 용어 */
  relation?: keyof typeof RELATION_RULE;
  cta: { type: ThreadCtaType; text: string };
  /** 대상으로 삼을 일간 개수 — LR-01은 3~5개 */
  targetCount?: number;
}

function base(options: BuildInputOptions): LoveRabbitContentInput {
  return {
    id: options.id,
    contentLane: options.lane,
    goal: options.goal,
    selectedPatternId: options.patternId,
    approvedFacts: [],
    variables: { date: options.date, cta: options.cta },
  };
}

/**
 * 오늘의 관계 온도 — 일진 × 일간 몇 개.
 *
 * 순위도 점수도 붙이지 않는다. 대상마다 무엇이 켜졌는지만 말한다.
 * 순위를 붙이려면 "오늘 어느 일간이 더 낫다"를 정하는 산식이 있어야 하는데
 * 그런 산식이 이 저장소에 없다.
 */
export function buildDailyRelationInput(options: BuildInputOptions): LoveRabbitContentInput {
  const input = base(options);
  const ganji = dayGanjiFor(options.date);
  const { entries, skipped } = stemsForDay(ganji, options.gender);

  const take = options.targetCount ?? 4;
  if (entries.length < take) {
    input.missingFacts = [
      `승인 규칙이 걸리는 일간이 ${entries.length}개뿐이다 (필요 ${take}개)`,
      ...skipped.map((s) => `${s.stem}(${s.tenGod}) — ${s.reason}`),
    ];
    return input;
  }

  const chosen = entries.slice(0, take);
  input.variables.ganji = ganji.label;
  input.variables.dayStems = chosen.map((e) => e.stem);
  input.approvedFacts = chosen.map((e) =>
    approvedFactOf(e.ruleId, `${e.stem} 일간 — 오늘 일진 ${ganji.label}이 ${e.tenGod}으로 든다`)
  );
  return input;
}

/**
 * 겉과 속 — 십성 하나의 성정.
 *
 * 독자를 띠로 부르지 않고 십성으로 부른다. 자기 십성을 모르는 독자가 대부분이라
 * 전환 CTA가 자연스럽게 붙는 자리이기도 하다.
 */
export function buildTenGodInput(options: BuildInputOptions): LoveRabbitContentInput {
  const input = base(options);
  if (!options.tenGod) {
    input.missingFacts = ["다룰 십성이 지정되지 않았다"];
    return input;
  }
  input.approvedFacts = [
    approvedFactOf(TENGOD_RULE[options.tenGod], `${options.tenGod}이 두드러진 명식의 관계 기질`),
  ];
  return input;
}

/**
 * 사주 교실 — 용어 하나의 정의와 흔한 오해.
 *
 * 규칙의 source 필드가 고전 근거를 들고 있어, 정의는 거기서 나온다.
 * 오해를 바로잡는 문장은 forbidden 이 이미 갖고 있다 — 그 규칙이 "이렇게 말하면
 * 안 된다"고 적어 둔 것이 곧 흔한 오해다.
 */
export function buildTermInput(options: BuildInputOptions): LoveRabbitContentInput {
  const input = base(options);
  const ruleId = options.relation
    ? RELATION_RULE[options.relation]
    : options.tenGod
      ? TENGOD_RULE[options.tenGod]
      : null;
  if (!ruleId) {
    input.missingFacts = ["다룰 용어(십성 또는 형충회합)가 지정되지 않았다"];
    return input;
  }
  const rule = ruleById(ruleId);
  input.approvedFacts = [
    approvedFactOf(ruleId, `용어 정의 — ${rule.source}`),
    { ruleId, claimId: `${ruleId}#forbidden`, safePhrasing: rule.forbidden.join(" / "), scope: "흔한 오해 — 이렇게 말하면 안 된다" },
  ];
  return input;
}

/**
 * 무료 미리보기 안내.
 *
 * SS-P04의 정책이 허위 희소성과 가짜 마감을 금지한다. 그래서 실제로 존재하는
 * 것만 쓴다 — 랜딩의 무료 미리보기다. 마감도 인원 제한도 붙이지 않는다.
 */
export const FREE_PREVIEW_PAGES = [
  { slug: "inner-mind", label: "속마음 리포트" },
  { slug: "compatibility", label: "궁합" },
  { slug: "romance-timing", label: "인연 타이밍" },
  { slug: "breakup-decision", label: "이별 판단" },
];

export function freePreviewUrl(slug: string): string {
  return `${SITE_URL}/saju/${slug}`;
}

export function buildFreePreviewInput(
  options: BuildInputOptions & { slug: string }
): LoveRabbitContentInput {
  const input = base(options);
  const page = FREE_PREVIEW_PAGES.find((p) => p.slug === options.slug);
  if (!page) {
    input.missingFacts = [`실제로 있는 무료 미리보기 페이지가 아니다 — ${options.slug}`];
    return input;
  }
  if (options.tenGod) {
    input.approvedFacts = [
      approvedFactOf(TENGOD_RULE[options.tenGod], `${options.tenGod} 기질 — 미리보기가 다루는 결`),
    ];
  }
  input.variables.cta = { type: "link", text: `${freePreviewUrl(page.slug)} — ${page.label} 무료 미리보기` };
  return input;
}

/**
 * 띠·큰 그림 → 일주 개인화 전환.
 *
 * 이 레인이 주장하는 명리 사실은 "띠보다 일주가 좁다" 하나뿐이고, 그건 해석이
 * 아니라 구조다 — 띠는 연지 하나, 일주는 일간과 일지 두 글자다.
 */
export function buildUpsellInput(options: BuildInputOptions): LoveRabbitContentInput {
  const input = base(options);
  // 일진을 싣지 않는다. 이 레인의 주장은 날짜와 무관한 구조 사실 하나뿐이고,
  // 간지를 쥐여 주면 모델이 그것을 독자의 일주 예시처럼 끌어다 쓴다 —
  // 실제로 그렇게 나왔다("무진처럼 태어난 날의 일주까지"). 그 날의 일진은
  // 독자의 일주가 아니므로, 맞는 말도 틀린 말도 아닌 문장이 되어 버린다.
  input.approvedFacts = [
    {
      ruleId: "ADAPTER-SCOPE-ZODIAC-VS-DAYPILLAR",
      claimId: "ADAPTER-SCOPE-ZODIAC-VS-DAYPILLAR#claim",
      safePhrasing:
        "띠는 태어난 해의 지지 한 글자이고, 일주는 태어난 날의 천간과 지지 두 글자다. 같은 띠 안에서도 일주는 예순 가지로 갈린다",
      scope: "구조 사실 — 해석이 아니라 글자 수",
    },
  ];
  input.variables.cta = { type: "link", text: `${SITE_URL}/reading — 내 일주로 보는 관계 리딩` };
  return input;
}

/**
 * 아직 만들 수 없는 입력.
 *
 * 지시 문서 G가 요구한 대로, 빈 입력으로 생성에 넘기는 대신 무엇이 없는지 적는다.
 * 여기 적힌 문장이 그대로 최종 보고의 "필요한 데이터 어댑터" 목록이 된다.
 */
export function blockedInput(
  options: BuildInputOptions,
  missing: string[]
): LoveRabbitContentInput {
  const input = base(options);
  input.missingFacts = missing;
  return input;
}

/** 승인 테이블이 없어 지금은 못 쓰는 축들 — 한 곳에 모아 둔다 */
export const MISSING_ADAPTERS = {
  dailyZodiacScore: [
    "띠 12종의 일일 점수·순위 산식이 없다",
    "saju-score.ts의 computeSajuScore는 명식 하나를 받아 계산한다 — 띠 단위로는 켤 수 없다",
    "필요한 것: 일진 × 연지 12종의 승인된 점수 규칙과 그 근거",
  ],
  weeklyRanking: [
    "주간 랭킹 산식이 없다",
    "SS-P01은 순위를 요구하고, 규칙은 '임의 랭킹 생성 금지'다",
    "필요한 것: 주간 일진 묶음 × 일간/일주의 승인된 가중치 산식과 동점 처리 규칙",
  ],
  luckyColorDirection: [
    "행운색·방향 테이블이 없다",
    "필요한 것: 오행 → 색·방위 대응의 승인된 출처와, 그것을 일진에 거는 규칙",
  ],
  appLaunchStory: [
    "실제 출시·베타·이벤트 사실이 없다",
    "SS-P07 정책이 허위 희소성과 가짜 마감을 금지한다",
    "필요한 것: 운영자가 확인한 실제 일정·모집 인원·마감",
  ],
} as const;
