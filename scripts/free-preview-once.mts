// 무료 미리보기를 딱 한 번 만든다.
//
//   npm run free-preview:once
//
// 한 번이다. 반복도 재시도도 없다 - runFreePreview 자체가 실패해도 다시 안 부른다.
// AI_PROVIDER 를 그대로 따른다. .env.local 이 claude-code 면 구독으로 돌아 API
// 요금이 0원이다.

import { buildSajuFacts } from "../src/lib/saju-facts";
import { matchRules } from "../src/lib/reading-rules";
import { PRODUCTS } from "../src/lib/products";
import { runFreePreview } from "../src/lib/free-preview-run";
import { READING_ENGINE_VERSION } from "../src/lib/free-preview";

const KRW = 1450;
const id = "sokgunghap";
const product = PRODUCTS.find((p) => p.id === id)!;
const me = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });
const partner = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" });
const rules = matchRules(me, partner, id);

console.log(`\n${product.title} · 근거 ${rules.length}개 · provider=${process.env.AI_PROVIDER ?? "(자동)"} · model=${process.env.FREE_PREVIEW_MODEL ?? "(provider 기본)"}\n`);

const outcome = await runFreePreview({
  rules,
  product: id,
  relationshipStatus: "dating",
  dayMasterElement: me.dayMasterElement as never,
  normalizedBirthInput: "once-" + Date.now(),
  engineVersion: READING_ENGINE_VERSION,
  ruleSetVersion: rules.map((r) => r.id).join(","),
});

const t = outcome.telemetry;
console.log(`출처 ${t.source} · 호출 ${t.llmCalls}회 · ${t.model ?? "-"} (${t.provider ?? "-"})`);
console.log(`토큰 입력 ${t.inputTokens ?? "?"} / 출력 ${t.outputTokens ?? "?"}`);
console.log(`실비 $${(t.actualUsd ?? 0).toFixed(5)} (${Math.round((t.actualUsd ?? 0) * KRW)}원)`);
if (t.reason) console.log(`[!] ${t.reason}${t.problems ? " — " + t.problems.join(" / ") : ""}`);
console.log(`근거 ${t.evidenceIds.join(", ")}\n`);

const r = outcome.result;
console.log(`훅   ${r.hook}`);
console.log(`요약 ${r.summary}\n`);
for (const c of r.cards) {
  console.log(`· ${c.title}  [${c.emotionTags.join("·")}]  (${c.evidenceIds.join(",")})`);
  console.log(`  ${c.body}\n`);
}
console.log(`질문 ${r.reflectionQuestion}`);
console.log(`유료 ${r.paidTeaser}\n`);
