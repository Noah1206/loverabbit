// 축(reading-axis.ts)을 켰을 때와 껐을 때, 같은 명식에서 리포트가 어떻게 달라지는가.
//
//   npm run axis:compare -- --product jaehoe                    세 명식 전부, 머리 + 2묶음
//   npm run axis:compare -- --product jaehoe --case canonical   하나만
//   npm run axis:compare -- --product jaehoe --batches 9        전 장
//   npm run axis:compare -- --product jaehoe --variant off      한쪽만 다시 (다른 쪽은 있는 결과)
//   npm run axis:compare -- --product jaehoe --force            이미 있는 결과도 다시
//
// 축은 "하나씩, 미리보기로 확인하며" 채우기로 못 박혀 있다(reading-axis.ts). 확인은
// 눈으로 하는 것이라 이 스크립트는 판정하지 않는다 — 같은 입력의 두 결과를 나란히
// 놓고, 축의 낱말이 얼마나 쓰였는지와 옆 상품의 물음이 얼마나 샜는지만 센다.
//
// 축을 끄는 것은 환경변수 READING_AXIS_OFF 로 한다. 표(READING_AXES)에서 빼는 방식은
// 안 통했다 — Windows 에서 "../src/lib" 와 "@/lib" 가 서로 다른 모듈 인스턴스로
// 로드돼, 이쪽 표를 고쳐도 reading-prompt 가 보는 표는 그대로였다. 처음 돌린
// 비교는 그래서 켬-대-켬이었다. 환경변수는 프로세스 전체가 같이 본다.
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
/** off | on — 한쪽만 다시 만든다. 다른 쪽은 있는 결과를 그대로 쓴다. 돈을 두 번 안 쓰기 위해서다. */
const VARIANT = argOf("variant");
const OUT_DIR = process.env.AXIS_COMPARE_DIR ?? path.join(process.cwd(), ".axis-compare");

const product = PRODUCT_MAP[PRODUCT_ID];
if (!product) {
  console.error(`상품 ${PRODUCT_ID} 를 못 찾았어요.`);
  process.exit(1);
}
if (!READING_AXES[PRODUCT_ID]) {
  console.error(`${PRODUCT_ID} 에는 축이 없어요. reading-axis.ts 에 먼저 적어야 비교할 것이 있어요.`);
  process.exit(1);
}
if (VARIANT && VARIANT !== "off" && VARIANT !== "on") {
  console.error(`--variant 는 off | on 중 하나예요.`);
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

/**
 * 상품마다 고민 문장을 바꾼다.
 *
 * 처음에는 모든 상품에 재회용 고민("헤어진 지 넉 달인데…")을 넣었다. 그러면 결혼·권태기
 * 리포트가 "재결합" 이야기로 기울고, 그게 축 탓인지 고민 탓인지 가릴 수 없다.
 * 상품의 물음에 맞는 고민을 넣어야 축이 하는 일만 보인다.
 */
const QUESTION_BY_PRODUCT: Record<string, string> = {
  sokgunghap: "사귄 지 석 달인데 붙어 있을 때랑 떨어져 있을 때 온도가 너무 달라요.",
  yeonae: "올해 안에 연애를 시작하고 싶어요. 소개팅이 나을지 그냥 기다릴지 모르겠어요.",
  ibyeol: "두 달 전에 헤어졌는데 왜 끝났는지 아직도 정리가 안 돼요. 제 탓인지 그 사람 탓인지.",
  bamgijil: "연애만 하면 제가 이상해져요. 평소엔 안 그런데 집착하게 돼요.",
  baramgi: "남자친구가 요즘 폰을 뒤집어 놓고 연락이 뜸해요. 의심하는 제가 이상한 건지.",
  gyeolhon: "1년 반 사귄 사람이 프러포즈를 준비하는 것 같아요. 이 사람과 결혼해도 될까요.",
  gwontaegi: "3년 사귀었는데 요즘 만나도 할 말이 없어요. 권태기인지 끝나는 건지 모르겠어요.",
  hwanseung: "애인이 있는데 새로 만난 사람한테 자꾸 마음이 가요. 갈아타면 후회할까요.",
  sseom: "석 달째 썸인데 진도가 안 나가요. 상대가 밀당하는 건지 진심인지 모르겠어요.",
  jjak: "같은 팀 사람을 반년째 좋아해요. 고백하면 팀이 어색해질까 봐 못 하고 있어요.",
  bimil: "회사 사람과 비밀연애 중이에요. 요즘 눈치챈 사람이 있는 것 같아 불안해요.",
  dohwasal: "친구들이 저더러 도화살 있다고 해요. 원치 않는 사람만 자꾸 다가와서 힘들어요.",
};

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

  const savedSwitch = process.env.READING_AXIS_OFF;
  process.env.READING_AXIS_OFF = axis ? "" : PRODUCT_ID;
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
        currentScene: QUESTION_BY_PRODUCT[PRODUCT_ID] ?? c.question,
        occupation: c.occupation,
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
          scoreValue: scoreResult.value,
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
    if (savedSwitch === undefined) delete process.env.READING_AXIS_OFF;
    else process.env.READING_AXIS_OFF = savedSwitch;
  }
}

/** 리포트 본문 전체를 한 덩어리로 */
function bodyOf(report: StructuredReport | null): string {
  if (!report) return "";
  return [report.meta.headline, ...report.sections.flatMap((s) => [s.title, s.summary, ...s.paragraphs])].join(
    "\n"
  );
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
  // 화면의 지수가 본문에 몇 번 나오는가. usesScore 가 실제로 먹었는지 여기서 보인다.
  const scoreMentions = product.scoreLabel ? (body.match(new RegExp(product.scoreLabel, "g")) ?? []).length : 0;
  return { own: count([...new Set(own)]), leak: count(leak), chars: body.length, scoreMentions };
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
  const previous = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Saved) : null;
  let saved: Saved;

  if (previous && !has("force") && !VARIANT) {
    console.log(`\n[${caseId}] 이미 있어요 — ${file}. 다시 만들려면 --force, 한쪽만은 --variant off|on.`);
    saved = previous;
  } else if (previous && VARIANT) {
    console.log(`\n[${caseId}] ${VARIANT} 쪽만 다시 만들어요 — 다른 쪽은 있는 결과를 씁니다.`);
    const fresh = await generate(caseId, VARIANT === "on");
    console.log(
      `  축 ${VARIANT === "on" ? "켬" : "끔"} — ${(fresh.ms / 1000).toFixed(0)}초 · ${fresh.report?.sections.length ?? 0}절 · 위반 ${fresh.violations.length}`
    );
    saved = { ...previous, ...(VARIANT === "on" ? { on: fresh } : { off: fresh }) };
    fs.writeFileSync(file, JSON.stringify(saved, null, 2), "utf8");
  } else {
    const c = CASES[caseId];
    const me = buildSajuFacts(c.me, NOW);
    const partner = product.needsPartner ? buildSajuFacts(c.partner, NOW) : null;
    const rules = matchRules(me, partner, PRODUCT_ID, Math.max(12, product.toc.length));
    const scoreResult = computeSajuScore(PRODUCT_ID, me, partner);
    const scoped = scopeOutline({ product: PRODUCT_ID, outline: product.toc, facts: me, matchedRules: rules });
    console.log(
      `\n[${caseId}] 규칙 ${rules.length}개 · 지수 ${scoreResult.value} (${product.meterLabels?.[scoreResult.bandIndex] ?? "-"})`
    );

    const want = (v: "off" | "on") => !VARIANT || VARIANT === v;
    let off = previous?.off ?? null;
    let on = previous?.on ?? null;
    if (want("off")) {
      console.log(`  축 끔 — 만드는 중…`);
      off = await generate(caseId, false);
      console.log(`  축 끔 — ${(off.ms / 1000).toFixed(0)}초 · ${off.report?.sections.length ?? 0}절 · 위반 ${off.violations.length}`);
    }
    if (want("on")) {
      console.log(`  축 켬 — 만드는 중…`);
      on = await generate(caseId, true);
      console.log(`  축 켬 — ${(on.ms / 1000).toFixed(0)}초 · ${on.report?.sections.length ?? 0}절 · 위반 ${on.violations.length}`);
    }
    if (!off || !on) {
      console.error(`  ${caseId}: 한쪽이 비어 있어요. --variant 없이 돌리거나 먼저 양쪽을 만드세요.`);
      process.exit(1);
    }

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
    `| "재회 가능성" 언급 | ${lexOff.scoreMentions} | ${lexOn.scoreMentions} |`,
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
