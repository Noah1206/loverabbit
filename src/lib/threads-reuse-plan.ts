// 원문 직접 재사용 배치 10칸.
//
// 기존 20칸(threads-plan.ts)과 별도로 돈다. 기존 초안을 지우거나 다시 만들지 않는다 —
// 이미 검수를 통과한 13개를 모드 하나 바꾸겠다고 흔들 이유가 없다.
//
// 여기서도 판정 기준은 같다. 승인된 사실이 없으면 막고, 허가 증빙이 없으면 막는다.
// 다만 막히는 이유가 두 갈래로 갈린다.
//   blocked_by_missing_facts    — 명리 쪽이 비었다 (주간 랭킹 산식)
//   needs_permission_metadata   — 허가 쪽이 비었다 (증빙 세 줄)
// 둘을 한 상태로 뭉치면 무엇을 먼저 해야 하는지가 사라진다.

import {
  MISSING_ADAPTERS,
  blockedInput,
  buildFreePreviewInput,
  buildTenGodInput,
  buildTermInput,
  type TenGod,
} from "@/lib/threads-inputs";
import type { AuthorizedReuseMode, LoveRabbitContentInput } from "@/lib/threads-content";

export interface ReuseSlot {
  input: LoveRabbitContentInput;
  reuseMode: AuthorizedReuseMode;
  /** 이 칸이 근거로 삼는 원문 */
  sourcePostIds: string[];
  note: string;
}

export const REUSE_START = "2026-08-25";

function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * 지시 문서 작업 5의 표를 그대로 옮긴 열 칸.
 *
 * 주간 2칸은 close_adaptation 으로 지정됐지만, 원문의 뼈대가 순위 그 자체다.
 * 순위를 러브레빗 승인 값으로 치환하라는 것이 close_adaptation 의 조건인데
 * 치환할 승인 값이 없다. 순위를 뺀 채로 쓰면 그건 그 원문의 각색이 아니라
 * 다른 글에 그 옷을 입힌 것이다. 그래서 막고, 이유를 적는다.
 */
export function buildReusePlan(start = REUSE_START): ReuseSlot[] {
  const slots: ReuseSlot[] = [];
  const day = (n: number) => addDays(start, n);

  // ── 겉과 속 · 관계 기질 · 3개 · close_adaptation ──────────────
  const innerSources = [
    "SS-20260802-GOAT-INNER-WORLD",
    "SS-20260805-HIDDEN-PAIN",
    "SS-20260807-HIDDEN-MIND",
  ];
  const innerTenGods: TenGod[] = ["편관", "정인", "비견"];
  innerTenGods.forEach((tenGod, i) => {
    slots.push({
      note: `겉과 속 ${i + 1}/3 — close_adaptation · ${innerSources[i]}`,
      reuseMode: "close_adaptation",
      sourcePostIds: [innerSources[i]],
      input: buildTenGodInput({
        id: `reuse-inner-${tenGod}`,
        lane: "inner_world",
        goal: "engagement",
        patternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
        date: day(i),
        tenGod,
        cta: { type: "comment", text: "비슷한 적 있으면 댓글로 알려줘요." },
      }),
    });
  });

  // ── 주간 연애·운세 · 2개 · close_adaptation ──────────────────
  // 원문의 뼈대가 순위다. 치환할 승인 순위가 없으면 각색이 성립하지 않는다.
  const weeklySources = ["SS-20260703-WEEKLY-TOP5", "SS-20260731-WEEKLY-LOVE-TOP5"];
  weeklySources.forEach((source, i) => {
    slots.push({
      note: `주간 연애·운세 ${i + 1}/2 — close_adaptation · ${source}`,
      reuseMode: "close_adaptation",
      sourcePostIds: [source],
      input: blockedInput(
        {
          id: `reuse-weekly-${i + 1}`,
          lane: "weekly_ranking",
          goal: "save",
          patternId: "SS-P01-WEEKLY-TOP-RANKING",
          date: day(i),
          cta: { type: "comment", text: "내 일간을 댓글에 남겨봐요." },
        },
        [
          ...MISSING_ADAPTERS.weeklyRanking,
          `${source} 는 순위가 본문의 뼈대다 — close_adaptation 은 순위를 승인 값으로 치환하라고 요구하는데 치환할 값이 없다`,
          "순위를 빼고 쓰면 그 원문의 각색이 아니라 다른 글이 된다",
        ]
      ),
    });
  });

  // ── 사주 교실 · 2개 · verbatim_excerpt ───────────────────────
  const termSources = ["SS-20260716-FREE-READING", "SS-20260730-DAILY-RANKING"];
  const terms: Array<{ id: string; relation?: "지지충" | "천간합"; tenGod?: TenGod }> = [
    { id: "cheonhap", relation: "천간합" },
    { id: "sanggwan", tenGod: "상관" },
  ];
  terms.forEach((term, i) => {
    slots.push({
      note: `사주 교실 ${i + 1}/2 — verbatim_excerpt · ${termSources[i]}`,
      reuseMode: "verbatim_excerpt",
      sourcePostIds: [termSources[i]],
      input: buildTermInput({
        id: `reuse-term-${term.id}`,
        lane: "individual_reading",
        goal: "save",
        patternId: "SS-P06-TECHNICAL-TO-EVERYDAY",
        date: day(i),
        relation: term.relation,
        tenGod: term.tenGod,
        cta: { type: "share", text: "이 얘기 통할 사람에게 보내줘요." },
      }),
    });
  });

  // ── 서비스 · 무료 미리보기 · 2개 · close_adaptation ──────────
  // SS-20260725-APP-LAUNCH 의 구조(왜 만들었나 → 도움 요청)는 각색할 수 있다.
  // 다만 그 원문의 테스터 모집·마감은 러브레빗의 사실이 아니라 통째로 빠진다.
  // 패턴은 원문을 물고 있다 — sourceBodiesForPrompt 가 pattern.source_post_ids 로
  // 원문을 고르므로, 쓰려는 원문을 근거로 삼는 패턴을 골라야 한다.
  // APP-LAUNCH 를 근거로 삼는 패턴은 SS-P07 하나뿐이다.
  const previews: Array<{ slug: string; tenGod: TenGod; source: string; patternId: string }> = [
    {
      slug: "compatibility",
      tenGod: "정관",
      source: "SS-20260725-APP-LAUNCH",
      patternId: "SS-P07-APP-ORIGIN-COMMUNITY",
    },
    {
      slug: "breakup-decision",
      tenGod: "편인",
      source: "SS-20260716-FREE-READING",
      patternId: "SS-P04-FREE-READING-GATE",
    },
  ];
  previews.forEach((preview, i) => {
    slots.push({
      note: `서비스·무료 ${i + 1}/2 — close_adaptation · ${preview.source}`,
      reuseMode: "close_adaptation",
      sourcePostIds: [preview.source],
      input: buildFreePreviewInput({
        id: `reuse-free-${preview.slug}`,
        lane: "free_reading",
        goal: "conversion",
        patternId: preview.patternId,
        date: day(i),
        slug: preview.slug,
        tenGod: preview.tenGod,
        cta: { type: "link", text: "" },
      }),
    });
  });

  // ── 큰 그림 → 개인화 전환 · 1개 · verbatim_excerpt ───────────
  slots.push({
    note: "전환 1/1 — verbatim_excerpt · SS-20260807-HIDDEN-MIND",
    reuseMode: "verbatim_excerpt",
    sourcePostIds: ["SS-20260807-HIDDEN-MIND"],
    input: buildTenGodInput({
      id: "reuse-upsell-hiddenmind",
      lane: "inner_world",
      goal: "conversion",
      patternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
      date: day(2),
      tenGod: "편재",
      cta: { type: "comment", text: "내 쪽에 가까운 게 어느 쪽인지 댓글로 알려줘요." },
    }),
  });

  return slots;
}
