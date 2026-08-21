// 고급 해석 감사 — evidence_only / policy_preview / policy_enabled 를 나란히.
//
// 모델을 부르지 않는다. 이 층은 사용자 글에 아직 한 글자도 안 나가므로,
// 비교할 것이 계산값과 승인 상태뿐이다. 그게 지금 볼 것의 전부다.
//
//   npx tsx scripts/advanced-audit.mts

import { writeFileSync, mkdirSync, existsSync } from "node:fs";

import { computeSaju } from "../src/lib/saju";
import { buildSajuFacts } from "../src/lib/saju-facts";
import { buildAdvancedFacts, advancedForPrompt } from "../src/lib/myeongri/advanced-facts";
import { axisLabel } from "../src/lib/myeongri/yongsin";
import { assessGyeokguk } from "../src/lib/myeongri/gyeokguk";
import { seasonalContext } from "../src/lib/myeongri/seasonal-context";
import { MYEONGRI_SOURCES, canBackUserFacingClaim } from "../src/lib/myeongri-policy/source-registry";
import { CONFLICT_POLICY_ROWS } from "../src/lib/myeongri/advanced-conflict";
import { FIXTURE_INPUTS, fixtureReviewSummary, FIXTURE_SUITE_VERSION } from "../src/lib/myeongri-policy/advanced-fixtures";
import { buildPolicyBoard } from "../src/lib/myeongri-policy/policy-board";
import type { AdvancedMyeongriMode } from "../src/lib/myeongri/advanced-mode";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const BIRTH = { year: 1993, month: 1, day: 24, hour: 14 } as const;
const CHART = computeSaju(BIRTH);
const ME = buildSajuFacts({ ...BIRTH, gender: "F" }, NOW);

const OUT_DIR = "reports/reading-audit";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const L: string[] = [];
const w = (s = "") => L.push(s);

w("# 고급 해석 감사 — 조후·격국·용신");
w();
w(`기준 시각 \`${NOW.toISOString()}\` · 기준 명식 1993-01-24 14:00 여 (임신 계축 을사 계미)`);
w();
w("생성: `npx tsx scripts/advanced-audit.mts` (모델 호출 없음)");
w();
w("> 이 층은 사용자 글에 아직 한 글자도 나가지 않는다. 그것이 고장이 아니라 설계다.");
w("> 조후·격국·용신은 틀려도 드러나지 않는 층이라, 출처가 확정되기 전에는 계산만 한다.");
w();

// ── §9-3 비교표 ────────────────────────────────────────────
const modes: AdvancedMyeongriMode[] = ["evidence_only", "policy_preview", "policy_enabled"];
const byMode = Object.fromEntries(
  modes.map((mode) => [mode, buildAdvancedFacts(CHART, ME.strength.label, mode)])
) as Record<AdvancedMyeongriMode, ReturnType<typeof buildAdvancedFacts>>;

const gate = fixtureReviewSummary();
const enabledCell = (value: string) => (gate.gatesPolicyEnabled ? "not_run" : value);

w("## 모드별 비교");
w();
w("| 항목 | 기존 P0/P1 | evidence_only | policy_preview | policy_enabled |");
w("| --- | --- | --- | --- | --- |");

const p = ME.fourPillars;
const pillars = `${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour!.stem}${p.hour!.branch}`;
const luck = `${ME.luckContext.majorLuck?.currentPillar}(${ME.luckContext.majorLuck?.currentRange})`;
w(`| 4주·대운·기본 strength | ${pillars} / ${luck} / ${ME.strength.label} ${ME.strength.score} | 같음 | 같음 | ${enabledCell("같음")} |`);

const ctx = seasonalContext(CHART);
const climate = `${ctx.monthBranch}월 ${ctx.climateAxes.temperature}/${ctx.climateAxes.moisture}`;
w(`| 계절/한난조습 | 없음 | ${climate} | ${climate} | ${enabledCell(climate)} |`);

const g = assessGyeokguk(CHART);
const gyeok = `${g.determination} (${g.candidates.map((c) => `${c.pattern}/${c.confidence}`).join(", ")})`;
w(`| 격국 후보 | 없음 | ${gyeok} | ${gyeok} | ${enabledCell("동일 + 이름 노출 가능")} |`);

const eokbu = byMode.evidence_only.yongsin.candidatesByAxis.eokbu
  .filter((c) => c.element)
  .map((c) => `${c.element}(${c.rank})`)
  .join(" ");
w(`| 억부 후보 | 없음 (강약 라벨만) | ${eokbu} | ${eokbu} | ${enabledCell(eokbu)} |`);

const johu = byMode.evidence_only.johu.candidates
  .map((c) => `${c.candidateElement}(${c.priority})`)
  .join(" ");
w(`| 조후 후보 | 없음 | ${johu} · 전부 candidate | ${johu} · 승인 0건 | ${enabledCell("승인 표 필요")} |`);

const conflict = byMode.evidence_only.conflicts
  .map((c) => `${c.id} · ${c.resolutionStatus}`)
  .join(", ") || "없음";
w(`| 충돌 상태 | 계산 안 됨 | ${conflict} | ${conflict} | ${enabledCell("우선순위 정책 필요")} |`);

const changes = modes.map((m) => (byMode[m].readerVisible ? "바뀜" : "안 바뀜"));
w(`| 사용자 리포트 결론 변경 | — | ${changes[0]} | ${changes[1]} | ${enabledCell(changes[2])} |`);

w(
  `| blocking/major/advisory | — | blocking 0 · major ${byMode.evidence_only.conflicts.filter((c) => c.severity === "major").length} · advisory 0 ` +
    `| 같음 | ${enabledCell("승인 뒤 재측정")} |`
);
w();
w(
  `\`policy_enabled\` 이 \`not_run\` 인 것이 정상이다 — 고정 명식 ${gate.total}건 중 ` +
    `${gate.pending}건이 아직 전문가 검토 전이고(${FIXTURE_SUITE_VERSION}), 그것이 이 모드의 문지기다.`
);
w();

// ── 기준 명식 상세 ──────────────────────────────────────────
w("## 기준 명식 상세 (evidence_only)");
w();
const a = byMode.evidence_only;

w("### 계절 — 계산층이라 출처 없이 확정된다");
w();
w("| 항목 | 값 |");
w("| --- | --- |");
w(`| 월지 | ${a.seasonalContext.monthBranch} |`);
w(`| 절기 | ${a.seasonalContext.solarTermWindow.birthSolarTerm} 이후 ${a.seasonalContext.solarTermWindow.daysIntoTerm}일 |`);
w(`| 계절 | ${a.seasonalContext.solarTermWindow.season} |`);
w(`| 한난 | ${a.seasonalContext.climateAxes.temperature} |`);
w(`| 조습 | ${a.seasonalContext.climateAxes.moisture} |`);
w(`| 경계 | ${a.seasonalContext.solarTermWindow.beforeOrAfterTerm ?? "아님"} |`);
w();

w("### 격국");
w();
w(`판정 **${a.gyeokguk.determination}** · 상태 ${a.gyeokguk.status} · 대표 ${a.gyeokguk.primary?.pattern ?? "없음"}`);
w();
w(`월령 ${a.gyeokguk.monthlyCommand.branch} 지장간 ${a.gyeokguk.monthlyCommand.hiddenStems.map((h) => `${h.stem}(${h.tier})`).join(" ")} → 십성 ${a.gyeokguk.monthlyCommand.tenGodsToDayMaster.join(", ")}`);
w();
w(`투간 ${a.gyeokguk.monthlyCommand.exposed.map((e) => `${e.stem}@${e.atPositions.join(",")}`).join(", ") || "없음"} · 월지 교란 ${a.gyeokguk.monthlyCommand.disturbed.map((d) => `${d.with}${d.kind}(${d.atPosition})`).join(", ") || "없음"}`);
w();
w("| 후보 | 확신 | 근거 |");
w("| --- | --- | --- |");
for (const c of a.gyeokguk.candidates) w(`| ${c.pattern} | ${c.confidence} | ${c.basis.join(" / ")} |`);
w();
for (const x of a.gyeokguk.exclusions) w(`- **${x.pattern} 제외** — ${x.reason}`);
w();

w("### 조후 후보");
w();
w("| 오행 | 역할 | 무게 | 상태 | 명식에 있나 | 막고 있는 것 |");
w("| --- | --- | --- | --- | --- | --- |");
for (const c of a.johu.candidates) {
  w(`| ${c.candidateElement} | ${c.role} | ${c.priority} | ${c.status} | ${c.presentInChart ? "있음" : "없음"} | ${c.blockers[0] ?? "-"} |`);
}
w();

w("### 용신 축별 후보");
w();
w("| 축 | 후보 |");
w("| --- | --- |");
for (const axis of Object.keys(a.yongsin.candidatesByAxis) as Array<keyof typeof a.yongsin.candidatesByAxis>) {
  const list = a.yongsin.candidatesByAxis[axis];
  w(
    `| ${axisLabel(axis)} | ${list.map((c) => `${c.element ?? "미정"}(${c.rank}/${c.status})`).join(" ") || "후보 없음"} |`
  );
}
w();
w(`**합의: ${a.yongsin.consensus.kind}** — ${a.yongsin.consensus.reason}`);
w();
w(`최종: \`${a.yongsin.finalOutput.status}\``);
w();

w("### 충돌");
w();
for (const c of a.conflicts) {
  w(`- **${c.id}** (${c.severity} / ${c.resolutionStatus})`);
  w(`  - ${c.subject}`);
  w(`  - ${c.explanation}`);
}
w();

w("### 사용자에게 안 나가는 이유");
w();
for (const r of a.suppressionReasons) w(`- ${r}`);
w();
w(`프롬프트 입력에 실린 advanced: \`${JSON.stringify(advancedForPrompt(a))}\``);
w();

// ── 지금 쓸 수 있는 것 / 없는 것 ────────────────────────────
w("## 1. 지금 사용자 리포트에 쓸 수 있는 approved 규칙");
w();
const applied = a.trace.filter((t) => t.verdict === "applied");
if (applied.length === 0) {
  w("**없다.** 조후·격국·용신 어느 축에서도 승인된 규칙이 0건이다.");
} else {
  w("| 규칙 | 출처 |");
  w("| --- | --- |");
  for (const t of applied) w(`| ${t.ruleId} | ${t.sourceIds.join(", ")} |`);
}
w();

w("## 2. 계산은 됐지만 아직 쓰면 안 되는 것");
w();
w("| 규칙 | 판정 | 이유 |");
w("| --- | --- | --- |");
for (const t of a.trace.filter((x) => x.verdict !== "applied")) {
  w(`| ${t.ruleId} | ${t.verdict} | ${t.reason.slice(0, 140)} |`);
}
w();

w("## 3. 출처·판본·권리·검토가 필요한 빈 칸");
w();
w("| 출처 | 종류 | 판본 | 위치 | 권리 | 결론 근거로 쓸 수 있나 |");
w("| --- | --- | --- | --- | --- | --- |");
for (const s of MYEONGRI_SOURCES) {
  w(`| ${s.sourceId} | ${s.sourceType} | ${s.edition} | ${s.locator} | ${s.rightsStatus} | ${canBackUserFacingClaim(s.sourceId) ? "예" : "**아니오**"} |`);
}
w();
w("| 충돌 우선순위 정책 | 상태 | 막고 있는 것 |");
w("| --- | --- | --- |");
for (const row of CONFLICT_POLICY_ROWS) w(`| ${row.policyId} | ${row.status} | ${row.blockedBy ?? "-"} |`);
w();
w(`고정 명식 ${gate.total}건 중 검토 완료 ${gate.reviewed}건, 대기 ${gate.pending}건.`);
w();

w("## 4. P0/P1 결과와 달라질 수 있는 문장");
w();
w("지금은 **한 문장도 없다.** 아래는 정책이 다 승인됐을 때 달라질 수 있는 자리다.");
w();
w("| 지금 나가는 말 | 승인 뒤 달라질 수 있는 말 | 무엇이 승인돼야 하나 |");
w("| --- | --- | --- |");
w(
  "| 2026년 병오·병신의 화를 상관(마찰)으로만 읽는다 | 겨울 목에게 화는 한기가 풀리는 흐름이기도 하다고 함께 읽는다 | " +
    "조후용신 표(SRC-GUNGTONG 판본) + CR-JOHU-FIRST-EXTREME-SEASON |"
);
w(
  "| 월지 축을 '사회 자리'로만 쓴다 | 월령이 가리키는 구조(격)를 함께 말한다 | " +
    "격국 V1 내격 우선순위 + SRC-JAPYEONG 판본 |"
);
w(
  "| 강약을 신약 36으로 말한다 | 왕상휴수사·설기·통근을 반영한 값으로 말한다 | " +
    "P2 억부 가중치(strength-v1.json) |"
);
w();

// ── 회귀 세트 ──────────────────────────────────────────────
w("## 고정 명식 회귀 세트");
w();
w(`${FIXTURE_INPUTS.length}건. 실제 인물의 명조를 쓰지 않는다 — 생년월일시는 개인정보이고,`);
w("유명인 명조는 출처와 정확성이 제각각이다. 계산 경로를 고르게 밟도록 고른 합성 입력이다.");
w();
w("| id | 목적 | 4주 | 계절 | 강약 | 격국 | 합의 | 충돌 |");
w("| --- | --- | --- | --- | --- | --- | --- | --- |");
const tally = { determined: 0, ambiguous: 0, unsupported: 0 } as Record<string, number>;
const consensusTally: Record<string, number> = {};
for (const f of FIXTURE_INPUTS) {
  const facts = buildSajuFacts(f.birthInput, NOW);
  const adv = facts.advanced;
  const fp = facts.fourPillars;
  const four = `${fp.year.stem}${fp.year.branch} ${fp.month.stem}${fp.month.branch} ${fp.day.stem}${fp.day.branch} ${fp.hour ? `${fp.hour.stem}${fp.hour.branch}` : "미상"}`;
  tally[adv.gyeokguk.determination] += 1;
  consensusTally[adv.yongsin.consensus.kind] = (consensusTally[adv.yongsin.consensus.kind] ?? 0) + 1;
  w(
    `| ${f.id} | ${f.purpose} | ${four} | ${adv.seasonalContext.monthBranch}월 ${adv.seasonalContext.climateAxes.temperature}/${adv.seasonalContext.climateAxes.moisture}${adv.seasonalContext.solarTermWindow.beforeOrAfterTerm ? " (경계)" : ""} | ${facts.strength.label} | ${adv.gyeokguk.determination} | ${adv.yongsin.consensus.kind} | ${adv.conflicts.length} |`
  );
}
w();
w(`격국 판정: determined ${tally.determined} / ambiguous ${tally.ambiguous} / unsupported ${tally.unsupported}`);
w();
w(`축 합의: ${Object.entries(consensusTally).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
w();
w("`expectedGyeokgukStatus` 와 `approvedPolicyAssertions` 는 아직 채우지 않았다. 그 칸을");
w("그럴듯하게 채우면 회귀 테스트가 **틀린 답을 지키는 장치**가 된다. 전문가 검토 뒤에 채운다.");
w();

// ── 승인 순서 ──────────────────────────────────────────────
const board = buildPolicyBoard(NOW);
w("## 승인 순서");
w();
w("| # | 승인할 것 | 왜 이 순서인가 | 상태 |");
w("| --- | --- | --- | --- |");
for (const step of board.approvalOrder) {
  w(`| ${step.step} | ${step.what} | ${step.why} | ${step.done ? "완료" : "대기"} |`);
}
w();
w("관리 화면: `/admin/myeongri-policy`");
w();

writeFileSync(`${OUT_DIR}/advanced-evidence-only.md`, L.join("\n") + "\n", "utf-8");
console.log(`썼어요: ${OUT_DIR}/advanced-evidence-only.md`);
console.log(`  모드 ${modes.map((m) => `${m}=${byMode[m].readerVisible ? "노출" : "차단"}`).join(" / ")}`);
console.log(`  기준 명식 충돌 ${a.conflicts.length}건 · trace ${a.trace.length}건 (applied ${applied.length})`);
console.log(`  고정 명식 ${gate.total}건 · 검토 대기 ${gate.pending}건`);
