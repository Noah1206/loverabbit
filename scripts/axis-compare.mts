// 축(reading-axis.ts)을 켰을 때와 껐을 때, 같은 명식에서 리포트가 어떻게 달라지는가.
//
//   npm run axis:compare -- --product jaehoe                    세 명식 전부, 머리 + 2묶음
//   npm run axis:compare -- --product jaehoe --case canonical   하나만
//   npm run axis:compare -- --product jaehoe --batches 4        더 깊이
//   npm run axis:compare -- --product jaehoe --force            이미 있는 결과도 다시
//
// 축은 "하나씩, 미리보기로 확인하며" 채우기로 못 박혀 있다(reading-axis.ts). 확인은
// 눈으로 하는 것이라 이 스크립트는 판정하지 않는다 — 같은 입력의 두 결과를 나란히
// 놓고, 축의 낱말이 얼마나 쓰였는지와 옆 상품의 물음이 얼마나 샜는지만 센다.
//
// 생성에는 실비가 든다(제공사에 따라). 그래서 있는 결과는 다시 만들지 않는다.
// 결과는 저장소 밖(스크래치패드)에 남긴다 — 비교본이지 자산이 아니다.

import fs from "node:fs";
import path from "node:path";

import { buildSajuFacts } from "../src/lib/saju-facts";
import { composeReport } from "../src/lib/reading-compose";
import { matchRules, forbiddenFromRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { checkReport } from "../src/lib/reading-guard";
import { READING_AXES } from "../src/lib/reading-axis";
import type { StructuredReport } from "../src/lib/reading-prompt";
import { chatComplete, effectiveProvider } from "../src/lib/ai";
import { PRODUCT_MAP } from "../src/lib/products";
import { computeSajuScore } from "../src/lib/saju-score";

const args = process.argv.slice(2);
const argOf = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const PRODUCT_ID = argOf("product") ?? "jaehoe";
const ONLY_CASE = argOf("case");
const BATCHES = Number(argOf("batches") ?? 2);
const OUT_DIR =
  process.env.AXIS_COMPARE_DIR ??
  path.join(process.cwd(), ".axis-compare");

const product = PRODUCT_MAP[PRODUCT_ID];
if (!product) {
  console.error(`상품 ${PRODUCT_ID} 를 못 찾았어요.`);
  process.exit(1);
}
if (!READING_AXES[PRODUCT_ID]) {
  console.error(`${PRODUCT_ID} 에는 축이 없어요. reading-axis.ts 에 먼저 적어야 비교할 것이 있어요.`);
  process.exit(1);
}

// 골든 픽스처(tests/golden-readings.test.ts)와 같은 세 명식. 경계를 하나씩 밟는다.
type Person = Parameters<typeof buildSajuFacts>[0];
const CASES: Record<string, { me: Person; partner: Person; question: string; occupation: string }> = {
  canonical: {
    me: { year: 1993, month: 1, day: 24, hour: 14, gender: "F" },
    partner: { year: 1991, month: 7, day: 8, hour: 20, gender: "M" },
    question: "헤어진 지 넉 달인데 아직 가끔 연락이 와요. 같은 이유로 또 싸울까 봐 겁나요.",
    occupation: "3교대 간호사",
  },
  "no-hour": {
    me: { year: 1996, month: 11, day: 3, hour: null, gender: "F" },
    partner: { year: 1994, month: 5, day: 17, hour: 9, gender: "M" },
    question: "제가 먼저 헤어지자고 했는데 두 달째 후회 중이에요. 상대는 아무 연락이 없어요.",
    occupation: "대학원생",
  },
  "male-self": {
    me: { year: 1989, month: 6, day: 30, hour: 22, gender: "M" },
    partner: { year: 1990, month: 2, day: 14, hour: 3, gender: "F" },
    question: "1년 사귀고 헤어진 지 반년이에요. SNS는 서로 안 끊었는데 먼저 연락하는 게 맞을까요.",
    occupation: "스타트업 개발자",
  },
};

const NOW = new Date("2026-08-25T12:00:00+09:00");

interface Variant {
  axis: boolean;
  report: StructuredReport | null;
  failedParts: string[];
  violations: { code?: string; kind: string; where: string; detail: string; blocking: boolean }[];
  model: string;
  ms: number;
  usage: unknown;
}

interface Saved {
  product: string;
  case: string;
  batches: number;
  rules: string[];
  score: { value: number; band: string | null };
  outline: string[];
  off: Variant;
  on: Variant;
}

async function generate(caseId: string, axis: boolean): Promise<Variant> {
  const c = CASES[caseId];
  const me = buildSajuFacts(c.me, NOW);
  const partner = product.needsPartner ? buildSajuFacts(c.partner, NOW) : null;
  const rules = matchRules(me, partner, PRODUCT_ID, Math.max(12, product.toc.length));
  const scoped = scopeOutline({
    product: PRODUCT_ID,
    outline: product.toc,
    facts: me,
    matchedRules: rules,
    label: product.promptLabel,
  });
  const scoreResult = computeSajuScore(PRODUCT_ID, me, partner);

  // 축을 끄는 방법은 표에서 잠시 빼는 것뿐이다. axisFor 가 부를 때마다 표를 읽는다.
  const saved = READING_AXES[PRODUCT_ID];
  if (!axis) delete READING_AXES[PRODUCT_ID];
  const t0 = Date.now();
  try {
    const composed = await composeReport(
      {
        facts: me,
        partnerFacts: partner,
        matchedRules: rules,
        productLabel: scoped.label ?? product.promptLabel,
        productId: PRODUCT_ID,
        score: {
          value: scoreResult.value,
          label: product.scoreLabel ?? null,
          band: product.meterLabels?.[scoreResult.bandIndex] ?? null,
          factors: scoreResult.factors.map((f) => ({ label: f.label, delta: f.delta, basis: f.basis })),
        },
        outline: scoped.outline,
        focus: partner ? "relationship" : "self",
        currentScene: c.question,
        occupation: c.occupation,
        characterId: null,
        characterName: null,
        now: NOW,
      },
      (system, user, budget, callOptions) =>
        chatComplete(system, [{ role: "user", content: user }], budget, {
          thinking: false,
          json: true,
          ...callOptions,
        }),
      { batchLimit: BATCHES }
    );
    const ms = Date.now() - t0;
    const violations = composed.report
      ? checkReport(composed.report, {
          expectedSections: composed.report.sections.length,
          forbiddenClaims: forbiddenFromRules(rules),
          facts: me,
          partnerFacts: partner,
          matchedRules: rules,
          productDomain: PRODUCT_ID,
        }).violations
      : [];
    return {
      axis,
      report: composed.report,
      failedParts: composed.failedParts,
      violations,
      model: composed.model,
      ms,
      usage: composed.usage,
    };
  } finally {
    READING_AXES[PRODUCT_ID] = saved;
  }
}

/** 리포트 본문 전체를 한 덩어리로 */
function bodyOf(report: StructuredReport | null): string {
  if (!report) return "";
  return [
    report.meta.headline,
    ...report.sections.flatMap((s) => [s.title, s.summary, ...s.paragraphs]),
  ].join("\n");
}

/** 축이 정한 낱말과, 옆 상품의 낱말이 각각 몇 번 쓰였나. 판정이 아니라 눈금이다. */
function lexicon(report: StructuredReport | null) {
  const body = bodyOf(report);
  const axis = READING_AXES[PRODUCT_ID];
  const own = axis.vocabulary
    .split(/[·,\s]+/)
    .map((w) => w.replace(/[^가-힣]/g, ""))
    .filter((w) => w.length >= 2 && !["쪽의", "말로", "쓴다", "끝내지", "않는다"].includes(w));
  const leak = ["결혼", "속궁합", "바람", "부검", "온도", "호흡"];
  const count = (words: string[]) =>
    Object.fromEntries(
      words.map((w) => [w, (body.match(new RegExp(w, "g")) ?? []).length]).filter(([, n]) => (n as number) > 0)
    );
  return { own: count([...new Set(own)]), leak: count(leak), chars: body.length };
}

function brief(report: StructuredReport | null): string[] {
  if (!report) return ["(만들지 못함)"];
  const out = [`  머리: ${report.meta.headline}`];
  for (const card of report.summaryCards.slice(0, 3)) out.push(`  카드: ${card.label} — ${card.value}`);
  for (const s of report.sections) {
    out.push(`  ■ ${s.title}`);
    out.push(`    판정: ${s.verdict ?? "-"}`);
    out.push(`    ${s.summary.slice(0, 140)}${s.summary.length > 140 ? "…" : ""}`);
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const provider = effectiveProvider();
console.log(`상품 ${PRODUCT_ID} · 제공사 ${provider ?? "없음"} · 머리 + ${BATCHES}묶음 · 결과 ${OUT_DIR}`);

const caseIds = ONLY_CASE ? [ONLY_CASE] : Object.keys(CASES);
const summaryLines: string[] = [`# 축 비교 — ${product.title} (${PRODUCT_ID})`, ""];

for (const caseId of caseIds) {
  if (!CASES[caseId]) {
    console.error(`모르는 케이스 ${caseId}. 가능한 값: ${Object.keys(CASES).join(", ")}`);
    process.exit(1);
  }
  const file = path.join(OUT_DIR, `${PRODUCT_ID}.${caseId}.json`);
  let saved: Saved;
  if (fs.existsSync(file) && !has("force")) {
    console.log(`\n[${caseId}] 이미 있어요 — ${file}. 다시 만들려면 --force.`);
    saved = JSON.parse(fs.readFileSync(file, "utf8")) as Saved;
  } else {
    const c = CASES[caseId];
    const me = buildSajuFacts(c.me, NOW);
    const partner = product.needsPartner ? buildSajuFacts(c.partner, NOW) : null;
    const rules = matchRules(me, partner, PRODUCT_ID, Math.max(12, product.toc.length));
    const scoreResult = computeSajuScore(PRODUCT_ID, me, partner);
    const scoped = scopeOutline({ product: PRODUCT_ID, outline: product.toc, facts: me, matchedRules: rules });
    console.log(`\n[${caseId}] 규칙 ${rules.length}개 · 지수 ${scoreResult.value} (${product.meterLabels?.[scoreResult.bandIndex] ?? "-"})`);

    console.log(`  축 끔 — 만드는 중…`);
    const off = await generate(caseId, false);
    console.log(`  축 끔 — ${(off.ms / 1000).toFixed(0)}초 · ${off.report?.sections.length ?? 0}절 · 위반 ${off.violations.length}`);
    console.log(`  축 켬 — 만드는 중…`);
    const on = await generate(caseId, true);
    console.log(`  축 켬 — ${(on.ms / 1000).toFixed(0)}초 · ${on.report?.sections.length ?? 0}절 · 위반 ${on.violations.length}`);

    saved = {
      product: PRODUCT_ID,
      case: caseId,
      batches: BATCHES,
      rules: rules.map((r) => r.id),
      score: { value: scoreResult.value, band: product.meterLabels?.[scoreResult.bandIndex] ?? null },
      outline: scoped.outline,
      off,
      on,
    };
    fs.writeFileSync(file, JSON.stringify(saved, null, 2), "utf8");
  }

  const lexOff = lexicon(saved.off.report);
  const lexOn = lexicon(saved.on.report);
  summaryLines.push(
    `## ${caseId} — 규칙 ${saved.rules.length} · 지수 ${saved.score.value} (${saved.score.band})`,
    "",
    `| | 축 끔 | 축 켬 |`,
    `|---|---|---|`,
    `| 절 수 | ${saved.off.report?.sections.length ?? 0} | ${saved.on.report?.sections.length ?? 0} |`,
    `| 글자 수 | ${lexOff.chars} | ${lexOn.chars} |`,
    `| 가드 위반 | ${saved.off.violations.length} | ${saved.on.violations.length} |`,
    `| 축 낱말 | ${JSON.stringify(lexOff.own)} | ${JSON.stringify(lexOn.own)} |`,
    `| 옆 상품 낱말 | ${JSON.stringify(lexOff.leak)} | ${JSON.stringify(lexOn.leak)} |`,
    `| 모델 | ${saved.off.model} · ${(saved.off.ms / 1000).toFixed(0)}초 | ${saved.on.model} · ${(saved.on.ms / 1000).toFixed(0)}초 |`,
    "",
    "### 축 끔",
    "```",
    ...brief(saved.off.report),
    "```",
    "",
    "### 축 켬",
    "```",
    ...brief(saved.on.report),
    "```",
    ""
  );
  for (const v of [saved.off, saved.on]) {
    if (v.violations.length) {
      summaryLines.push(`가드 (${v.axis ? "켬" : "끔"}):`);
      for (const x of v.violations) summaryLines.push(`- [${x.code ?? x.kind}] ${x.where} ${x.detail}`);
      summaryLines.push("");
    }
  }
}

const summaryFile = path.join(OUT_DIR, `${PRODUCT_ID}.summary.md`);
fs.writeFileSync(summaryFile, summaryLines.join("\n"), "utf8");
console.log(`\n요약 → ${summaryFile}`);
