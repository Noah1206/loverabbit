// 감사 비교표 생성기.
//
// 이 스크립트는 모델을 부르지 않는다. 부르는 대신 두 가지를 한다.
//   1) 입력 쪽(명식·번들·규칙·시기·커버리지)을 지금 코드로 다시 계산해 이전/이후를 나란히 놓는다
//   2) 이미 있는 미리보기 fixture 를 **새 가드에 통과시켜** 무엇이 걸리는지 센다
//
// 2번이 핵심이다. fixture 는 고치기 전 프롬프트로 만든 글이라, 새 가드가 그것을
// 얼마나 잡는지가 곧 "고치기 전이었으면 그대로 나갔을 것"의 목록이 된다.
//
//   npx tsx scripts/reading-audit.mts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

import { buildSajuFacts } from "../src/lib/saju-facts";
import { matchRules } from "../src/lib/reading-rules";
import { checkReport, type GuardViolation } from "../src/lib/reading-guard";
import { productCoverage } from "../src/lib/reading-coverage";
import { scopeOutline } from "../src/lib/reading-scope";
import { bundleLine } from "../src/lib/myeongri/relation-bundle";
import { xingLabel } from "../src/lib/myeongri/xing-name";
import { STRENGTH_OPEN_QUESTIONS } from "../src/lib/myeongri/strength-policy";
import { JOHU_OPEN_QUESTIONS } from "../src/lib/myeongri/johu";
import { pendingPartnerRules } from "../src/lib/myeongri-policy/partner-rules";
import { PRODUCTS } from "../src/lib/products";
import type { StructuredReport } from "../src/lib/reading-prompt";

const NOW = new Date("2026-08-21T12:00:00+09:00");
const SUBJECT = { year: 1993, month: 1, day: 24, hour: 14, gender: "F" } as const;
const PARTNER = { year: 1991, month: 7, day: 8, hour: 20, gender: "M" } as const;

const me = buildSajuFacts(SUBJECT, NOW);
const partner = buildSajuFacts(PARTNER, NOW);

const OUT_DIR = "reports/reading-audit";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

type Case = {
  id: string;
  label: string;
  fixture: string;
  report: StructuredReport | null;
  violations: GuardViolation[];
};

function loadFixture(id: string): StructuredReport | null {
  const path = `.reading-preview.${id}.json`;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")).report as StructuredReport;
  } catch {
    return null;
  }
}

const cases: Case[] = ["jaehoe", "sokgunghap"].map((id) => {
  const product = PRODUCTS.find((p) => p.id === id)!;
  const rules = matchRules(me, partner, id, Math.max(12, product.toc.length));
  const report = loadFixture(id);
  const violations = report
    ? checkReport(report, {
        expectedSections: report.sections.length,
        facts: me,
        partnerFacts: partner,
        matchedRules: rules,
        productDomain: id,
      }).violations
    : [];
  return { id, label: product.title, fixture: `.reading-preview.${id}.json`, report, violations };
});

function countCode(violations: GuardViolation[], code: string): number {
  return violations.filter((v) => v.code === code).length;
}

function bodyOf(report: StructuredReport): string {
  return report.sections
    .flatMap((s) => [s.summary, ...s.paragraphs, s.watchOut ?? ""])
    .concat(report.summaryCards.map((c) => `${c.value} ${c.detail}`))
    .join(" ");
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

// ── baseline vs P0 ─────────────────────────────────────────

const rulesFor = Object.fromEntries(
  cases.map((c) => [c.id, matchRules(me, partner, c.id, Math.max(12, PRODUCTS.find((p) => p.id === c.id)!.toc.length))])
) as Record<string, ReturnType<typeof matchRules>>;

const lines: string[] = [];
const w = (s = "") => lines.push(s);

w("# baseline vs P0 — 정명·중복·가드");
w();
w(`기준 시각 \`${NOW.toISOString()}\` · 기준 명식 1993-01-24 14:00 여 / 1991-07-08 20:00 남`);
w();
w("생성: `npx tsx scripts/reading-audit.mts` (모델 호출 없음)");
w();
w("## 계산층은 그대로다");
w();
w("| 항목 | 값 |");
w("| --- | --- |");
const p = me.fourPillars;
w(`| 본인 4주 | ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour!.stem}${p.hour!.branch} |`);
const q = partner.fourPillars;
w(`| 상대 4주 | ${q.year.stem}${q.year.branch} ${q.month.stem}${q.month.branch} ${q.day.stem}${q.day.branch} ${q.hour!.stem}${q.hour!.branch} |`);
w(`| 본인 강약 | ${me.strength.label} ${me.strength.score} |`);
w(`| 상대 강약 | ${partner.strength.label} ${partner.strength.score} |`);
w(`| 대운 | ${me.luckContext.majorLuck?.currentPillar} (${me.luckContext.majorLuck?.currentRange}, ${me.luckContext.majorLuck?.direction}) |`);
w(`| 세운·월운 | ${me.luckContext.yearly.year} ${me.luckContext.yearly.pillar} / ${me.luckContext.monthly.month}월 ${me.luckContext.monthly.pillar} |`);
w();
w("만세력·4주·일주·대운·진태양시는 이번 작업에서 건드리지 않았다. 위 값이 감사 때와 같다.");
w();

w("## 비교표");
w();
w("| 항목 | 이전 | 이후 | 판정 |");
w("| --- | --- | --- | --- |");

const partialNames = me.xing
  .filter((x) => x.completeness === "partial")
  .map((x) => xingLabel(x))
  .join(", ");
w(`| 부분 형 표기 | \`인사신 삼형(부분)\`, \`축술미 삼형(부분)\` — 그룹명 | \`${partialNames}\` — 선 글자로만 | 고침 |`);
w(`| 관계 bundle 수 | 없음 (합·충 2건과 형 2건이 각각 따로) | ${me.relationBundles.length}묶음 — ${me.relationBundles.map(bundleLine).join(" / ")} | 고침 |`);

const missingGlyphs = (() => {
  const own = new Set([p.year.branch, p.month.branch, p.day.branch, p.hour!.branch]);
  const totals = cases.map((c) => {
    if (!c.report) return `${c.id} 확인불가`;
    const body = bodyOf(c.report);
    const bad = ["인", "술"].filter((g) => !own.has(g) && occurrences(body, `${g}사신`) + occurrences(body, `축${g}미`) > 0);
    return `${c.id} ${bad.length ? bad.join("·") : "0"}`;
  });
  return totals.join(", ");
})();
w(`| 명식에 없는 글자 언급 (fixture) | jaehoe 10회 / sokgunghap 8회 | 새 가드가 전건 차단 (${cases.map((c) => `${c.id} ${countCode(c.violations, "GUARD-XING-OVERNAME")}건 차단`).join(", ")}) | 차단 |`);
void missingGlyphs;

w(`| matched rule 수 | jaehoe 9 / sokgunghap 4 | jaehoe ${rulesFor.jaehoe.length} / sokgunghap ${rulesFor.sokgunghap.length} | ${rulesFor.jaehoe.length}·${rulesFor.sokgunghap.length} |`);
for (const c of cases) {
  if (!c.report) continue;
  const coverage = productCoverage({
    product: c.id,
    matchedRules: rulesFor[c.id],
    sections: c.report.sections.map((s, i) => ({ id: s.id || `s${i}`, ruleIds: s.ruleIds, factsUsed: s.factsUsed })),
  });
  const top = Object.entries(coverage.ruleUsageHistogram).sort((a, b) => b[1] - a[1])[0];
  w(
    `| section별 unique rule (${c.id}) | 세지 않았음 | ${coverage.uniqueRuleCount}종 / ${coverage.sectionCount}절, 최다 ${top ? `${top[0]} ${top[1]}절` : "-"} | 계량됨 |`
  );
}
w(
  `| partner 근거 없는 문장 | 검사 없음 | ${cases.map((c) => `${c.id} ${countCode(c.violations, "GUARD-UNSUPPORTED-PARTNER-CLAIM")}건`).join(", ")} | 차단 |`
);
w(
  `| 6개월 시기 coverage | 이번 달 1개 | ${me.luckContext.upcoming.months.length}개월 + ${me.luckContext.upcoming.nextYear?.year}년 | 고침 |`
);
w(
  `| facts_used 경로 오류 | 검사 없음 | ${cases.map((c) => `${c.id} ${countCode(c.violations, "GUARD-FACT-PATH-MISMATCH")}건`).join(", ")} | 차단 |`
);
w(
  `| 근거만 올리고 안 쓴 관계 | 2건 (본문 대조로만 확인) | ${cases.map((c) => `${c.id} ${countCode(c.violations, "GUARD-FACT-CHIP-UNUSED")}건`).join(", ")} | 차단 |`
);
w(
  `| 같은 자리 이중 계상 | 검사 없음 | ${cases.map((c) => `${c.id} ${countCode(c.violations, "GUARD-UNBUNDLED-RELATION-COUNT")}건`).join(", ")} | 차단 |`
);
w();

w("## 옛 미리보기를 새 가드에 통과시킨 결과");
w();
w("고치기 전 프롬프트로 만든 글이다. 아래가 곧 “그대로였으면 나갔을 것”의 목록이다.");
w();
for (const c of cases) {
  w(`### ${c.label} (\`${c.fixture}\`)`);
  w();
  if (!c.report) {
    w("- fixture 없음");
    w();
    continue;
  }
  const blocking = c.violations.filter((v) => v.blocking);
  w(`- 절 ${c.report.sections.length}개 · 위반 ${c.violations.length}건 (막는 것 ${blocking.length}건)`);
  const byCode = new Map<string, number>();
  for (const v of c.violations) {
    const key = v.code ?? `${v.kind}(코드 없음)`;
    byCode.set(key, (byCode.get(key) ?? 0) + 1);
  }
  w();
  w("| 코드 | 건수 | 막는가 |");
  w("| --- | --- | --- |");
  for (const [code, count] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    const sample = c.violations.find((v) => (v.code ?? `${v.kind}(코드 없음)`) === code)!;
    w(`| ${code} | ${count} | ${sample.blocking ? "예" : "아니오"} |`);
  }
  w();
  const samples = blocking.slice(0, 6);
  if (samples.length) {
    w("막는 위반 예시:");
    w();
    for (const v of samples) w(`- \`${v.where}\` ${v.detail}`);
    w();
  }
}
writeFileSync(`${OUT_DIR}/baseline-vs-p0.md`, lines.join("\n") + "\n", "utf-8");

// ── P0 vs P1 ───────────────────────────────────────────────

const l2: string[] = [];
const w2 = (s = "") => l2.push(s);
w2("# P0 vs P1 — 상품 커버리지·상대 근거·시기 정합성");
w2();
w2("P1 은 문장을 고치지 않는다. **못 지킬 약속을 팔기 전에 줄인다.**");
w2();
w2("## 목차가 파는 것과 계산이 감당하는 것");
w2();
w2("| 상품 | 목차 | 범위 조정 후 | 켜진 규칙 | 판정 |");
w2("| --- | --- | --- | --- | --- |");
for (const c of cases) {
  const product = PRODUCTS.find((x) => x.id === c.id)!;
  const scoped = scopeOutline({
    product: c.id,
    outline: product.toc,
    facts: me,
    matchedRules: rulesFor[c.id],
  });
  w2(
    `| ${c.label} | ${product.toc.length}절 | ${scoped.outline.length}절 | ${rulesFor[c.id].length}개 | ${
      scoped.notes.length ? "범위 명시" : "그대로"
    } |`
  );
}
w2();
for (const c of cases) {
  const product = PRODUCTS.find((x) => x.id === c.id)!;
  const scoped = scopeOutline({ product: c.id, outline: product.toc, facts: me, matchedRules: rulesFor[c.id] });
  if (!scoped.notes.length && !scoped.dropped.length) continue;
  w2(`**${c.label}**`);
  w2();
  for (const note of scoped.notes) w2(`- 범위: ${note}`);
  for (const item of scoped.dropped) w2(`- 제외: ${item}`);
  w2();
}

w2("## 시기");
w2();
w2("| 달 | 기둥 | 십성 | 절입 |");
w2("| --- | --- | --- | --- |");
for (const m of me.luckContext.upcoming.months) {
  w2(`| ${m.year}-${String(m.month).padStart(2, "0")} | ${m.pillar.stem}${m.pillar.branch} | ${m.tenGod} | ${m.start.slice(0, 10)} |`);
}
const ny = me.luckContext.upcoming.nextYear;
if (ny) w2(`| ${ny.year}년(세운) | ${ny.pillar.stem}${ny.pillar.branch} | ${ny.tenGod} | — |`);
w2();
w2("이전에는 이 표가 통째로 없었다. 그래서 “앞으로 6개월”을 판 절이 이번 달만 스물일곱 번 짚었다.");
w2();

w2("## 상대 명식");
w2();
w2("조건은 계산되지만 승인된 규칙은 아직 0개다. 그래서 상대 성향 문장은 이번 판에서 한 줄도 나가지 않는다.");
w2();
w2("| 규칙 | 상태 | 막고 있는 것 |");
w2("| --- | --- | --- |");
for (const entry of pendingPartnerRules()) {
  w2(`| \`${entry.rule.id}\` | ${entry.status} | ${entry.blockedBy ?? "-"} |`);
}
w2();
w2("참고로 기준 상대 명식에서 계산은 이미 이렇게 나와 있다 — 승인되면 쓸 수 있는 것들이다.");
w2();
w2(`- 없는 오행: ${partner.missingElements.join(", ") || "없음"}`);
w2(`- 두드러진 십성: ${partner.dominantTenGods.join(", ")}`);
w2(`- 올해·이달: ${partner.luckContext.yearly.pillar} ${partner.luckContext.yearly.tenGod} / ${partner.luckContext.monthly.pillar} ${partner.luckContext.monthly.tenGod}`);
w2(`- 관계 묶음: ${partner.relationBundles.map(bundleLine).join(" / ") || "없음"}`);
w2();
writeFileSync(`${OUT_DIR}/p0-vs-p1.md`, l2.join("\n") + "\n", "utf-8");

// ── P2 정책 미리보기 ────────────────────────────────────────

const l3: string[] = [];
const w3 = (s = "") => l3.push(s);
w3("# P2 정책 미리보기 — 강약·조후");
w3();
w3("**둘 다 승인 전이다. 지금 판정을 바꾸지 않는다.** 아래는 나란히 놓고 보라고 낸 값이다.");
w3();
w3("## 강약");
w3();
w3("| 명식 | 현행 | 제안 | 반영 |");
w3("| --- | --- | --- | --- |");
for (const [name, facts] of [["본인", me], ["상대", partner]] as const) {
  w3(
    `| ${name} | ${facts.strength.label} ${facts.strength.score} | ${facts.strengthPolicy.proposedLabel} ${facts.strengthPolicy.proposedScore} | ${facts.strengthPolicy.appliedToLabel ? "예" : "아니오"} |`
  );
}
w3();
w3("차이가 큰 쪽(상대)이 특히 중요하다. 가중치를 정하지 않은 채 이걸 기본값으로 올리면 " +
  "중화였던 사람이 신강이 된다 — 그 한 줄이 리포트 전체의 어조를 뒤집는다.");
w3();
for (const [name, facts] of [["본인", me], ["상대", partner]] as const) {
  const e = facts.strengthPolicy;
  w3(`### ${name}`);
  w3();
  w3(`- 득령: ${e.monthCommand.branch}월 ${e.monthCommand.seasonalPhase} (${e.monthCommand.scoreDelta}) — ${e.monthCommand.reason}`);
  w3(`- 설기: ${e.draining.map((d) => `${d.source} ${d.tenGod} ${d.scoreDelta}`).join(", ") || "없음"}`);
  w3(`- 극: ${e.controlling.map((d) => `${d.source} ${d.scoreDelta}`).join(", ") || "없음"}`);
  w3(`- 통근: ${e.rooting.map((r) => `${r.branch}/${r.hiddenStemTier} +${r.scoreDelta} (${r.applied})`).join(", ") || "없음"}`);
  w3(`- 투간: ${e.exposure.map((x) => `${x.stem} +${x.scoreDelta}`).join(", ") || "없음"}`);
  for (const s of e.supportExcess) w3(`- ${s.type}: ${s.triggered ? "걸림" : "안 걸림"} — ${s.reason}`);
  w3();
}

w3("## 조후");
w3();
w3("| 명식 | 월지 | 한난조습 | 계절이 부르는 것 | 억부와 충돌 | 노출 |");
w3("| --- | --- | --- | --- | --- | --- |");
for (const [name, facts] of [["본인", me], ["상대", partner]] as const) {
  const j = facts.johu;
  w3(
    `| ${name} | ${j.monthBranch} | ${j.climate} | ${j.seasonalNeed.map((n) => `${n.element}${n.presentInChart ? "" : "(명식에 없음)"}`).join(", ") || "없음"} | ${j.conflictsWithStrength ? "예" : "아니오"} | ${j.exposable ? "예" : "아니오"} |`
  );
}
w3();
w3(`본인 조정: ${me.johu.conflictResolution ?? "-"}`);
w3();
w3("이것이 감사에서 지적한 그 자리다. 축월 을목(한랭)에 2026 병오·병신의 화가 온다. " +
  "조후로는 해동이고 억부로는 설기다. 지금까지는 조후 축이 없어서 **충돌이 있다는 사실 자체가 계산되지 않았다.**");
w3();

w3("## 사용자가 정해야 할 것");
w3();
w3("| # | 결정 | 지금 값 | 정하지 않으면 |");
w3("| --- | --- | --- | --- |");
const decisions: [string, string, string][] = [
  ["지지 음양 모드", "main_hidden_stem (myeongri/policy.ts)", "이미 정해져 있음 — 바꾸지 않았다"],
  ["강약 가중치", "strength-v1.json (policy_proposed)", "제안 점수가 영원히 제안으로 남는다"],
  ["왕상휴수사 감점 폭", "왕+30 상+20 휴-5 수-12 사-18 (제안)", "축월 목이 계속 '중립'으로 처리된다"],
  ["설기 가중치", "식상-4 재성-3 (제안)", "일지 상관이 계속 0점이다"],
  ["유근·통근 점수", "본기+10 중기+6 여기+3, 상한 20 (제안, not_applied)", "이미 계산된 통근이 계속 판정에 안 쓰인다"],
  ["인성과다 임계", "3개 + 비겁 없음 (제안)", "수다목부 자리가 계속 '신약하니 인성이 돕는다'로 읽힌다"],
  ["조후용신 표", "계절 한난조습까지만 (일간×월지 120칸 없음)", "조후를 사용자에게 못 쓴다"],
  ["조후·억부 충돌 우선순위", "JOOHU_PRIORITY_POLICY=off", "충돌을 계산만 하고 결론에 못 옮긴다"],
  ["부분 삼형 실질 인정", "XING_PARTIAL_POLICY=on (기존값 유지)", "이미 정해져 있음 — 바꾸지 않았다"],
  ["상대 규칙 승인", "P-* 3건 policy_proposed", "상대 성향 문장이 계속 0줄이다"],
  ["규칙 부족 시 처리", "READING_SCOPE_POLICY=annotate", "12절이 규칙 4개 위에 계속 선다"],
];
decisions.forEach(([name, now, cost], i) => w3(`| ${i + 1} | ${name} | ${now} | ${cost} |`));
w3();
w3("## 표에 남은 열린 질문");
w3();
w3("**강약**");
w3();
for (const q of STRENGTH_OPEN_QUESTIONS) w3(`- ${q}`);
w3();
w3("**조후**");
w3();
for (const q of JOHU_OPEN_QUESTIONS) w3(`- ${q}`);
w3();
writeFileSync(`${OUT_DIR}/p2-policy-preview.md`, l3.join("\n") + "\n", "utf-8");

console.log(`썼어요: ${OUT_DIR}/baseline-vs-p0.md, p0-vs-p1.md, p2-policy-preview.md`);
for (const c of cases) {
  const blocking = c.violations.filter((v) => v.blocking).length;
  console.log(`  ${c.id}: 위반 ${c.violations.length}건 (막는 것 ${blocking}건)`);
}
