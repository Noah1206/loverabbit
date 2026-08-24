// 모델 비교 하네스 — 같은 리딩을 모델마다 딱 한 번 생성하고, 시간·비용·품질을 기록한다.
//
//   npx tsx --env-file=.env scripts/model-compare.mts            아직 안 돈 모델만
//   npx tsx --env-file=.env scripts/model-compare.mts --dry      API를 부르지 않고 형식만
//   npx tsx --env-file=.env scripts/model-compare.mts --only gpt-4o
//   npx tsx --env-file=.env scripts/model-compare.mts --force    이미 있는 결과도 다시
//
// 생성은 비싸다. 그래서 이 파일의 절반은 "두 번 부르지 않기" 위한 장치다.
//   - 결과가 이미 있는 모델은 건너뛴다 (--force로만 다시 부른다)
//   - 모델 하나가 끝날 때마다 즉시 파일에 기록한다. 뒤가 깨져도 앞은 남는다
//   - 실패해도 모델 단위로는 다시 부르지 않는다. --only로 사람이 직접 지목해야 한다
//     (조각 단위 재시도는 운영에서도 하는 일이라 그대로 둔다)
//
// 결과는 .model-compare.json 에 쌓이고 /dev/model-compare 가 그걸 읽어 보여준다.

import fs from "node:fs";
import { buildSajuFacts } from "../src/lib/saju-facts";
import { composeReport } from "../src/lib/reading-compose";
import { matchRules, forbiddenFromRules } from "../src/lib/reading-rules";
import { checkReport } from "../src/lib/reading-guard";
import { reportToText, type StructuredReport } from "../src/lib/reading-prompt";
import { chatComplete, type Provider } from "../src/lib/ai";
import { PRODUCTS } from "../src/lib/products";

const OUT = ".model-compare.json";

// ── 비교 대상 ────────────────────────────────────────────────────────
// 백만 토큰당 단가 (USD). 실제 청구 토큰에 곱해 1건 실비를 낸다.
interface Candidate {
  id: string;
  provider: Provider;
  model: string;
  price: { input: number; output: number; cached?: number };
  note: string;
}

const CANDIDATES: Candidate[] = [
  { id: "gpt-5.6", provider: "openai", model: "gpt-5.6", price: { input: 4, output: 20, cached: 0.4 }, note: "현재 .env 설정값 · gpt-5.6-sol 프로모션 단가" },
  { id: "gpt-5", provider: "openai", model: "gpt-5", price: { input: 1.25, output: 10, cached: 0.125 }, note: "4o보다 싸고 최신" },
  { id: "gpt-4o", provider: "openai", model: "gpt-4o", price: { input: 2.5, output: 10, cached: 1.25 }, note: "이번 질문의 대상" },
  { id: "gemini-2.5-flash", provider: "gemini", model: "gemini-2.5-flash", price: { input: 0.3, output: 2.5 }, note: "코드 기본값 · 최저가" },
  { id: "gemini-3-flash-preview", provider: "gemini", model: "gemini-3-flash-preview", price: { input: 0.5, output: 3 }, note: "해요체 0% 확인됨" },
];

// ── 모든 모델이 똑같이 받는 입력 ──────────────────────────────────────
const SUBJECT = { year: 1999, month: 10, day: 2, hour: 14, gender: "F" as const };
const PARTNER = { year: 1997, month: 3, day: 11, hour: 9, gender: "M" as const };
const PRODUCT_ID = "jjak";
const QUESTION = "3개월 전에 헤어졌는데 아직 연락이 와요. 다시 만나도 될까요?";

// ── 품질 지표 ────────────────────────────────────────────────────────
/** 해요체가 아닌 종결 — 브랜드 목소리 계약 위반 */
const NOT_HAEYO = /(합니다|입니다|습니다|됩니다|랍니다|십니다|한다|이다|지요)[.!?"']?\s*$/;

function sentencesOf(report: StructuredReport): string[] {
  const out: string[] = [];
  for (const s of report.sections)
    for (const text of [s.summary, ...s.paragraphs, s.watchOut ?? ""])
      for (const sent of String(text).split(/(?<=[.!?])\s+/)) if (sent.trim()) out.push(sent.trim());
  return out;
}

function voiceCheck(report: StructuredReport) {
  const all = sentencesOf(report);
  const bad = all.filter((s) => NOT_HAEYO.test(s));
  return { total: all.length, bad: bad.length, samples: bad.slice(0, 5) };
}

// ── 결과 형식 ────────────────────────────────────────────────────────
export interface ModelRun {
  id: string;
  model: string;
  provider: string;
  note: string;
  ranAt: string;
  ok: boolean;
  error?: string;
  /** 요청한 모델과 다른 것으로 대체했다면 그 사유 */
  substitutedFor?: string;
  ms: { generate: number; guard: number; assemble: number; total: number };
  timings: { label: string; ms: number; ok: boolean; retry: boolean }[];
  requestCount: number;
  retryCount: number;
  failedParts: string[];
  usage: { input: number; output: number; cached: number; reasoning: number } | null;
  costUsd: number | null;
  guard: { blocking: number; warning: number; details: string[] };
  voice: { total: number; bad: number; samples: string[] };
  sections: number;
  expectedSections: number;
  avgSectionChars: number;
  report: StructuredReport | null;
  teaser: string;
  full: string;
}

interface ResultFile {
  product: { id: string; title: string; tocLength: number };
  subject: string;
  partner: string;
  question: string;
  batchSize: number;
  runs: ModelRun[];
}

function load(): ResultFile | null {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8")) as ResultFile;
  } catch {
    return null;
  }
}

function save(file: ResultFile): void {
  fs.writeFileSync(OUT, JSON.stringify(file, null, 2), "utf8");
}

// ── --dry 용 가짜 응답 ───────────────────────────────────────────────
// 돈을 쓰기 전에 파일 형식과 화면을 끝까지 완성하기 위한 것. 모델마다 조금씩
// 다르게(길이·해요체 위반 수) 만들어, 화면이 차이를 제대로 그리는지 볼 수 있게 한다.
function fakeComplete(seed: number) {
  return async (_system: string, user: string) => {
    await new Promise((r) => setTimeout(r, 40 + seed * 25));
    if (user.startsWith("지시: 머리")) {
      return {
        text: JSON.stringify({
          report_meta: { headline: `가짜 헤드라인 ${seed} — ${"머".repeat(30)}`, confidence_note: "시각까지 확인했어요." },
          summary_cards: [1, 2, 3].map((i) => ({ label: `카드${i}`, value: "값", detail: "디".repeat(60), facts_used: ["strength.label=신약"] })),
          action_questions: [1, 2, 3].map((i) => ({ question: `질문 ${i}`, why_it_matters: "왜".repeat(20) })),
          character_note: { character_id: "a", name: "화린도령", message: "한마디예요." },
          next_step: { label: "다음", description: "설명이에요.", recommended_focus: "relationship" },
        }),
        provider: "fake",
        model: `fake-${seed}`,
        usage: { input: 3000, output: 600, cached: 0, reasoning: 0 },
      };
    }
    const ns: number[] = [];
    for (const line of user.split("\n")) {
      const m = line.match(/^(\d+)\.\s/);
      if (m) ns.push(Number(m[1]));
      else if (ns.length) break;
    }
    return {
      text: JSON.stringify({
        sections: ns.map((n) => ({
          n,
          // seed가 클수록 해요체를 더 어기게 해서 화면이 차이를 그리는지 본다
          summary: (seed % 2 === 0 ? "이건 요약이에요. " : "이것은 요약입니다. ").repeat(18),
          paragraphs: ["첫 문단이에요. ".repeat(10), "둘째 문단이에요. ".repeat(10)],
          facts_used: ["strength.label=신약", "shinsal=홍염=시지"],
          rule_ids: ["TG-SIKSIN"],
          watch_out: "살펴볼 점이에요.",
        })),
      }),
      provider: "fake",
      model: `fake-${seed}`,
      usage: { input: 3200, output: 1900, cached: 0, reasoning: 0 },
    };
  };
}

// ── 한 모델 실행 ─────────────────────────────────────────────────────
async function runOne(c: Candidate, seed: number, dry: boolean): Promise<ModelRun> {
  const product = PRODUCTS.find((p) => p.id === PRODUCT_ID)!;
  const me = buildSajuFacts(SUBJECT);
  const partner = buildSajuFacts(PARTNER);
  const rules = matchRules(me, partner, PRODUCT_ID);

  const base = {
    id: c.id,
    model: c.model,
    provider: c.provider,
    note: c.note,
    ranAt: new Date().toISOString(),
    expectedSections: product.toc.length,
  };

  const complete = dry
    ? fakeComplete(seed)
    : (system, user, budget, callOptions) =>
        chatComplete(system, [{ role: "user", content: user }], budget, {
          thinking: false,
          json: true,
          provider: c.provider,
          model: c.model,
          ...callOptions,
        });

  const t0 = Date.now();
  let composed;
  try {
    composed = await composeReport(
      {
        facts: me,
        partnerFacts: partner,
        matchedRules: rules,
        productLabel: product.promptLabel,
        productId: product.id,
        outline: product.toc,
        focus: "relationship",
        currentScene: QUESTION,
        characterId: null,
        characterName: null,
        now: new Date(),
      },
      complete
    );
  } catch (e) {
    return {
      ...base,
      ok: false,
      error: String(e).slice(0, 400),
      ms: { generate: Date.now() - t0, guard: 0, assemble: 0, total: Date.now() - t0 },
      timings: [],
      requestCount: 0,
      retryCount: 0,
      failedParts: [],
      usage: null,
      costUsd: null,
      guard: { blocking: 0, warning: 0, details: [] },
      voice: { total: 0, bad: 0, samples: [] },
      sections: 0,
      avgSectionChars: 0,
      report: null,
      teaser: "",
      full: "",
    };
  }
  const tGen = Date.now() - t0;

  // 머리만 오고 본문이 전부 죽으면 report 객체는 생기지만 sections가 비어 있다.
  // 그건 리포트가 아니므로 성공으로 적지 않는다.
  if (!composed.report || composed.report.sections.length === 0) {
    return {
      ...base,
      ok: false,
      error: `리포트 없음 — 실패 조각: ${composed.failedParts.join(", ") || "(불명)"}`,
      ms: { generate: tGen, guard: 0, assemble: 0, total: tGen },
      timings: composed.timings,
      requestCount: composed.requestCount,
      retryCount: composed.retryCount,
      failedParts: composed.failedParts,
      usage: composed.usage,
      costUsd: null,
      guard: { blocking: 0, warning: 0, details: [] },
      voice: { total: 0, bad: 0, samples: [] },
      sections: 0,
      avgSectionChars: 0,
      report: null,
      teaser: "",
      full: "",
    };
  }

  const t1 = Date.now();
  const guard = checkReport(composed.report, {
    expectedSections: product.toc.length,
    forbiddenClaims: forbiddenFromRules(rules),
    facts: me,
    partnerFacts: partner,
    matchedRules: rules,
    productDomain: PRODUCT_ID,
  });
  const tGuard = Date.now() - t1;

  const t2 = Date.now();
  const { teaser, full } = reportToText(composed.report);
  const tAssemble = Date.now() - t2;

  const u = composed.usage;
  const billed = Math.max(0, u.input - u.cached);
  const costUsd =
    u.input + u.output === 0
      ? null
      : (billed / 1e6) * c.price.input +
        (u.cached / 1e6) * (c.price.cached ?? c.price.input) +
        (u.output / 1e6) * c.price.output;

  const chars =
    composed.report.sections.reduce((n, s) => n + s.summary.length + s.paragraphs.join("").length, 0) /
    Math.max(1, composed.report.sections.length);

  return {
    ...base,
    model: composed.model || c.model,
    provider: composed.provider || c.provider,
    ok: true,
    ms: { generate: tGen, guard: tGuard, assemble: tAssemble, total: tGen + tGuard + tAssemble },
    timings: composed.timings,
    requestCount: composed.requestCount,
    retryCount: composed.retryCount,
    failedParts: composed.failedParts,
    usage: u,
    costUsd,
    guard: {
      blocking: guard.violations.filter((v) => v.blocking).length,
      warning: guard.violations.filter((v) => !v.blocking).length,
      details: guard.violations.map((v) => `${v.blocking ? "차단" : "경고"} · ${v.where}: ${v.detail}`),
    },
    voice: voiceCheck(composed.report),
    sections: composed.report.sections.length,
    avgSectionChars: Math.round(chars),
    report: composed.report,
    teaser,
    full,
  };
}

// ── 진입점 ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
const force = argv.includes("--force");
const onlyAt = argv.indexOf("--only");
const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;

const product = PRODUCTS.find((p) => p.id === PRODUCT_ID)!;
const existing = load();
const file: ResultFile = existing ?? {
  product: { id: product.id, title: product.title, tocLength: product.toc.length },
  subject: `${SUBJECT.year}-${SUBJECT.month}-${SUBJECT.day} ${SUBJECT.hour}시 ${SUBJECT.gender}`,
  partner: `${PARTNER.year}-${PARTNER.month}-${PARTNER.day} ${PARTNER.hour}시 ${PARTNER.gender}`,
  question: QUESTION,
  batchSize: Number(process.env.READING_BATCH_SIZE) || 3,
  runs: [],
};
// --dry 결과와 실제 결과가 섞이면 비교가 무의미하다. 모드가 바뀌면 갈아엎는다.
const wasDry = file.runs.some((r) => r.provider === "fake");
if (existing && wasDry !== dry) {
  console.log(`[모드 전환: ${wasDry ? "가짜" : "실제"} -> ${dry ? "가짜" : "실제"}] 기존 결과를 비웁니다.`);
  file.runs = [];
}

const targets = CANDIDATES.filter((c) => (only ? c.id === only : true));
if (only && targets.length === 0) {
  console.error(`--only ${only} 에 해당하는 모델이 없습니다. 가능한 값: ${CANDIDATES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

console.log(`${dry ? "[가짜 모드] " : ""}상품 ${product.title} · 목차 ${product.toc.length}개 · 배치 ${file.batchSize}`);
console.log("대상:", targets.map((t) => t.id).join(", "), "\n");

let seed = 0;
for (const c of targets) {
  seed += 1;
  const done = file.runs.find((r) => r.id === c.id);
  if (done && !force) {
    console.log(`- ${c.id.padEnd(24)} 건너뜀 (이미 결과 있음 — 다시 돌리려면 --force)`);
    continue;
  }
  process.stdout.write(`- ${c.id.padEnd(24)} 실행 중... `);
  const run = await runOne(c, seed, dry);
  file.runs = [...file.runs.filter((r) => r.id !== c.id), run];
  // 한 건 끝날 때마다 즉시 기록 — 뒤에서 깨져도 앞의 결과는 남는다
  save(file);
  if (run.ok) {
    const cost = run.costUsd === null ? "?" : `$${run.costUsd.toFixed(4)}`;
    console.log(
      `${(run.ms.total / 1000).toFixed(1)}초 · ${run.sections}/${run.expectedSections}절 · ${cost} · ` +
        `해요체위반 ${run.voice.bad}/${run.voice.total} · 가드 차단 ${run.guard.blocking}`
    );
  } else {
    console.log(`실패 — ${run.error?.slice(0, 120)}`);
  }
}

// 정의된 순서대로 정렬해 두면 화면이 매번 같은 순서로 보인다
file.runs.sort((a, b) => CANDIDATES.findIndex((c) => c.id === a.id) - CANDIDATES.findIndex((c) => c.id === b.id));
save(file);
console.log(`\n${OUT} 에 ${file.runs.length}건 기록. /dev/model-compare 에서 확인하세요.`);
