// 결제 전에 공개되는 몫만 실제로 만들어 본다 — 머리 + 첫 절.
//
//   npm run preview:check -- --product jaehoe            하나
//   npm run preview:check -- --product jaehoe,yeonae     여럿
//   npm run preview:check -- --all                        열셋 전부
//
// PREVIEW CONTRACT(reading-prompt.ts)가 실제 글에서 어떻게 나오는지 보는 자리다.
// 후킹·장면·숨은 질문·조건·open_loop 이 순서대로 서는지, 판매 문구가 새지 않는지,
// 가드가 무엇을 잡는지. 판정은 사람이 한다 — 여기서는 나란히 놓고 셀 뿐이다.
//
// 공개분만 만들므로 상품당 호출 두 번(머리 + 첫 묶음)이다. 결과는 저장소 밖에 남긴다.

import fs from "node:fs";
import path from "node:path";

import { buildSajuFacts } from "../src/lib/saju-facts";
import { composeReport, previewBatchCount } from "../src/lib/reading-compose";
import { matchRules, forbiddenFromRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { checkReport } from "../src/lib/reading-guard";
import { previewFor } from "../src/lib/reading-preview";
import { chatComplete, effectiveProvider } from "../src/lib/ai";
import { PRODUCT_MAP, PRODUCTS } from "../src/lib/products";
import { computeSajuScore } from "../src/lib/saju-score";
import { costOf } from "../src/lib/ai-pricing";

const args = process.argv.slice(2);
const argOf = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : null;
};
const ids = args.includes("--all")
  ? PRODUCTS.map((p) => p.id)
  : (argOf("product") ?? "jaehoe").split(",").map((s) => s.trim()).filter(Boolean);
const OUT_DIR = process.env.PREVIEW_CHECK_DIR ?? path.join(process.cwd(), ".preview-check");
fs.mkdirSync(OUT_DIR, { recursive: true });

const NOW = new Date("2026-08-25T12:00:00+09:00");
const ME = { year: 1993, month: 1, day: 24, hour: 14, gender: "F" as const };
const PARTNER = { year: 1991, month: 7, day: 8, hour: 20, gender: "M" as const };

const QUESTION: Record<string, string> = {
  sokgunghap: "사귄 지 석 달인데 붙어 있을 때랑 떨어져 있을 때 온도가 너무 달라요.",
  jaehoe: "헤어진 지 넉 달인데 아직 가끔 연락이 와요. 같은 이유로 또 싸울까 봐 겁나요.",
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

const SALES_WORDS = ["결제", "구매", "해금", "원으로", "전체 풀이에서 확인", "가입 후"];

console.log(`제공사 ${effectiveProvider() ?? "없음"} · 결과 ${OUT_DIR}`);

for (const productId of ids) {
  const product = PRODUCT_MAP[productId];
  if (!product) {
    console.error(`상품 ${productId} 없음`);
    continue;
  }
  const me = buildSajuFacts(ME, NOW);
  const partner = product.needsPartner ? buildSajuFacts(PARTNER, NOW) : null;
  const rules = matchRules(me, partner, productId, Math.max(12, product.toc.length));
  const scoped = scopeOutline({ product: productId, outline: product.toc, facts: me, matchedRules: rules, label: product.promptLabel });
  const scoreResult = computeSajuScore(productId, me, partner);
  const freeCount = previewBatchCount(scoped.outline);
  const freeItems = scoped.outline.slice(0, 1);

  console.log(`\n[${productId}] 규칙 ${rules.length} · 지수 ${scoreResult.value} (${product.meterLabels?.[scoreResult.bandIndex] ?? "-"}) · 만드는 중…`);
  const t0 = Date.now();
  const composed = await composeReport(
    {
      facts: me,
      partnerFacts: partner,
      matchedRules: rules,
      productLabel: scoped.label ?? product.promptLabel,
      productId,
      score: {
        value: scoreResult.value,
        label: product.scoreLabel ?? null,
        band: product.meterLabels?.[scoreResult.bandIndex] ?? null,
        factors: scoreResult.factors.map((f) => ({ label: f.label, delta: f.delta, basis: f.basis })),
      },
      outline: scoped.outline,
      freeItems,
      focus: partner ? "relationship" : "self",
      currentScene: QUESTION[productId] ?? "",
      occupation: "",
      characterId: null,
      characterName: null,
      now: NOW,
    },
    (system, user, budget, callOptions) =>
      chatComplete(system, [{ role: "user", content: user }], budget, { thinking: false, json: true, ...callOptions }),
    { batchLimit: freeCount }
  );
  const report = composed.report;
  if (!report) {
    console.log(`  실패: ${composed.failedParts.join(", ")}`);
    continue;
  }
  const violations = checkReport(report, {
    expectedSections: report.sections.length,
    forbiddenClaims: forbiddenFromRules(rules),
    facts: me,
    partnerFacts: partner,
    matchedRules: rules,
    productDomain: productId,
    scoreValue: scoreResult.value,
  }).violations;

  const first = report.sections[0];
  const everything = [report.meta.headline, report.meta.openLoop ?? "", ...report.summaryCards.map((c) => c.value), first.summary, ...first.paragraphs].join("\n");
  const leaks = SALES_WORDS.filter((w) => everything.includes(w));
  const preview = previewFor(productId);
  const sceneHit = (preview?.scenes ?? []).filter((scene) => scene.slice(0, 6) && everything.includes(scene.slice(0, 6))).length;

  const out = {
    product: productId,
    ms: Date.now() - t0,
    model: composed.model,
    headline: report.meta.headline,
    openLoop: report.meta.openLoop ?? null,
    cards: report.summaryCards.map((c) => ({ label: c.label, value: c.value })),
    first: { title: first.title, verdict: first.verdict, summary: first.summary, paragraphs: first.paragraphs },
    violations: violations.map((v) => ({ code: v.code ?? v.kind, blocking: v.blocking, detail: v.detail })),
    leaks,
  };
  fs.writeFileSync(path.join(OUT_DIR, `${productId}.json`), JSON.stringify(out, null, 2), "utf8");

  const u = composed.usage;
  const cost = costOf(composed.model, u);
  console.log(`  토큰: 입력 ${u.input} (캐시 ${u.cached}) · 출력 ${u.output} (추론 ${u.reasoning}) · 호출 ${composed.requestCount} · 실비 ${cost === null ? "?" : "$" + cost.toFixed(3)}`);
  console.log(`  ${(out.ms / 1000).toFixed(0)}초 · 위반 ${violations.length} (막는 것 ${violations.filter((v) => v.blocking).length}) · 판매문구 ${leaks.length ? leaks.join(",") : "없음"} · 장면 재료 사용 ${sceneHit}`);
  console.log(`  후킹: ${report.meta.headline}`);
  console.log(`  물음: ${report.meta.openLoop ?? "(없음!)"}`);
  for (const c of report.summaryCards) console.log(`  카드: ${c.label} — ${c.value}`);
  console.log(`  ■ ${first.title}`);
  console.log(`    판정: ${first.verdict}`);
  console.log(`    ${first.summary}`);
  for (const p of first.paragraphs) console.log(`    · ${p}`);
  for (const v of violations.filter((v) => v.blocking)) console.log(`  !! ${v.code ?? v.kind} ${v.detail.slice(0, 100)}`);
}
