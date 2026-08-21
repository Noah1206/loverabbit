// 매일 굴러가는 편성.
//
// buildPlan 은 스무 칸을 한 번에 내놓는다. 그건 처음 채울 때는 맞는데, 매일
// 도는 자동화에는 안 맞았다 — 초안 ID 에 날짜가 없어서 스무 칸이 다 채워진 다음
// 날부터는 생성기가 전부 "이미 있음" 으로 건너뛴다. 자동화가 매일 돌면서 새 글을
// 하나도 안 만드는 상태였다.
//
// 그래서 날짜를 ID 에 넣고, 그날 쓸 칸만 골라 온다.
//
// 고를 때 두 가지를 지킨다.
//
//  1. 막힌 칸은 빼고 고른다. 주간 랭킹처럼 근거가 없는 칸이 그날의 두 자리를
//     차지하면, 그날은 나갈 글이 없다.
//  2. 날짜로 회전시킨다. 앞에서부터 순서대로 쓰면 매일 같은 십성이 나오고,
//     그건 며칠이면 눈에 띈다.
//
// 날짜를 옮길 때 원래 칸의 날짜 간격을 지킨다. 승인된 사실(일진·십성)이 그 날짜로
// 계산되기 때문에, 표시 날짜만 바꾸면 사실과 문장이 어긋난다.

import { buildPlan, DEFAULT_START, type PlanSlot } from "@/lib/threads-plan";

const REFERENCE = "2000-01-01";

function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 이 칸이 편성 기준일에서 며칠 뒤를 쓰는가 */
function offsetsOf(): number[] {
  return buildPlan(REFERENCE).map((slot) =>
    daysBetween(REFERENCE, slot.input.variables.date ?? REFERENCE)
  );
}

/** 근거가 없어 막힌 칸은 그날의 자리를 차지하면 안 된다 */
function usable(slot: PlanSlot): boolean {
  return !(slot.input.missingFacts && slot.input.missingFacts.length > 0);
}

export interface DailyPlanOptions {
  /** 이 날짜로 쓴다 (KST 기준 YYYY-MM-DD) */
  date: string;
  /** 이 날 만들 편수 */
  count?: number;
}

/**
 * 하루치 편성.
 *
 * ID 는 `2026-08-22-inner-정관` 꼴이 된다. 날짜가 앞에 오는 이유는 정렬하면
 * 시간순이 되기 때문이다 — 큐를 눈으로 훑을 때 그게 제일 편하다.
 */
export function buildDailyPlan({ date, count = 2 }: DailyPlanOptions): PlanSlot[] {
  const offsets = offsetsOf();
  const indices = buildPlan(DEFAULT_START)
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => usable(slot))
    .map(({ index }) => index);

  if (indices.length === 0) return [];

  // 날짜를 씨앗으로 시작 위치를 옮긴다. 같은 날이면 같은 편성이 나온다 —
  // 다시 돌려도 결과가 흔들리지 않아야 무엇이 바뀌었는지 짚을 수 있다.
  const seed = daysBetween(REFERENCE, date);
  const picked: PlanSlot[] = [];

  for (let i = 0; i < Math.min(count, indices.length); i += 1) {
    const index = indices[(seed * count + i) % indices.length];
    // 이 칸이 원래 기준일 + offset 을 쓰므로, 목표 날짜에서 그만큼 당겨 편성한다.
    const slot = buildPlan(addDays(date, -offsets[index]))[index];
    picked.push({
      note: `${date} · ${slot.note}`,
      input: { ...slot.input, id: `${date}-${slot.input.id}` },
    });
  }
  return picked;
}
