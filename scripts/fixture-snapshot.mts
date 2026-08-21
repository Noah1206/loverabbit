// 고정 명식의 **계산으로 확정되는 칸**을 뽑아 붙여 넣을 꼴로 낸다.
//
// 이 스크립트는 파일을 고치지 않는다. 사람이 눈으로 보고 옮겨 적는 절차가 핵심이다 —
// 스크립트가 스스로 기대값을 갱신하면 회귀 테스트는 아무것도 안 지킨다. 값이 바뀔 때마다
// 조용히 따라 바뀌는 자물쇠는 자물쇠가 아니다.
//
//   npx tsx scripts/fixture-snapshot.mts

import { buildSajuFacts } from "../src/lib/saju-facts";
import { FIXTURE_INPUTS } from "../src/lib/myeongri-policy/advanced-fixtures";

const NOW = new Date("2026-08-21T12:00:00+09:00");

const rows = FIXTURE_INPUTS.map((input) => {
  const facts = buildSajuFacts(input.birthInput, NOW);
  const p = facts.fourPillars;
  const a = facts.advanced;
  return {
    id: input.id,
    purpose: input.purpose,
    birthInput: input.birthInput,
    expectedFourPillars: {
      year: `${p.year.stem}${p.year.branch}`,
      month: `${p.month.stem}${p.month.branch}`,
      day: `${p.day.stem}${p.day.branch}`,
      hour: p.hour ? `${p.hour.stem}${p.hour.branch}` : null,
    },
    expectedSeasonalContext: {
      monthBranch: a.seasonalContext.monthBranch,
      season: a.seasonalContext.solarTermWindow.season,
      temperature: a.seasonalContext.climateAxes.temperature,
      moisture: a.seasonalContext.climateAxes.moisture,
    },
    expectedGyeokgukStatus: a.gyeokguk.determination,
    expectedConflictKind: a.yongsin.consensus.kind,
    // 아래 둘은 계산이 아니라 판단이다. 스크립트가 채우지 않는다.
    approvedPolicyAssertions: [] as string[],
    sourceNotes: [] as string[],
    reviewState: "pending_expert_review" as const,
  };
});

console.log(JSON.stringify(rows, null, 2));
console.error(`\n${rows.length}건. 계산으로 확정되는 칸만 채웠습니다.`);
console.error("approvedPolicyAssertions 와 sourceNotes 는 비어 있습니다 — 전문가 검토 자리입니다.");
