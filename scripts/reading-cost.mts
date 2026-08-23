// 리포트 한 편에 얼마나 드는가 — 모델을 바꾸면 얼마가 되는가.
//
// 모델을 호출하지 않는다. 프롬프트와 목차는 결정론적이라 입력 토큰은 부르지 않고도
// 셀 수 있고, 출력은 이미 만들어 둔 리포트에서 잰다.
//
//   npx tsx scripts/reading-cost.mts

import { readFileSync, existsSync } from "node:fs";

import { buildSajuFacts } from "../src/lib/saju-facts";
import { matchRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { buildReadingInput, systemPromptFor } from "../src/lib/reading-prompt";
import { chaptersOf } from "../src/lib/reading-compose";
import { PRODUCTS } from "../src/lib/products";
import { AD_OFFERS } from "../src/lib/ad-offers";
import { MODEL_PRICES, costOf, estimateTokens } from "../src/lib/ai-pricing";

const KRW_PER_USD = 1450;
const me = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });
const partner = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" });

/** 광고 오퍼가 실제로 파는 값 — 상품 정가가 아니라 이쪽이 원가율의 분모다 */
const OFFER_PRICE = new Map<string, number>();
for (const offer of Object.values(AD_OFFERS) as { category: string; price: number }[]) {
  const now = OFFER_PRICE.get(offer.category);
  if (now === undefined || offer.price < now) OFFER_PRICE.set(offer.category, offer.price);
}

// 실제로 만들어 둔 리포트의 출력 크기. 없으면 절당 평균으로 어림한다.
const CHARS_PER_SECTION = 1500;

function outputChars(id: string, sections: number): { chars: number; measured: boolean } {
  for (const path of [`src/content/demo/${id}.json`, `.reading-preview.${id}.json`]) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const report = raw.report ?? raw;
      if (report?.sections?.length) return { chars: JSON.stringify(report).length, measured: true };
    } catch {
      /* 다음 후보로 */
    }
  }
  return { chars: sections * CHARS_PER_SECTION, measured: false };
}

const MODELS = ["gpt-5.6", "gpt-4o-mini", "gemini-2.5-flash", "claude-sonnet-5"];

console.log(`한 편당 원가 (환율 ${KRW_PER_USD}원/USD 가정)\n`);
console.log(
  "상품".padEnd(12) +
    "절".padStart(3) +
    "조각".padStart(5) +
    "입력k".padStart(7) +
    "출력k".padStart(7) +
    MODELS.map((m) => m.slice(0, 12).padStart(14)).join("")
);
console.log("-".repeat(34 + MODELS.length * 14));

const rows: {
  id: string;
  price: number | undefined;
  cost: Record<string, number>;
  previewCost: Record<string, number>;
  previewSections: number;
}[] = [];

for (const product of PRODUCTS) {
  const rules = matchRules(me, partner, product.id, Math.max(12, product.toc.length));
  const scoped = scopeOutline({
    product: product.id,
    outline: product.toc,
    facts: me,
    matchedRules: rules,
  });
  const input = buildReadingInput({
    facts: me,
    partnerFacts: partner,
    matchedRules: rules,
    productLabel: product.promptLabel,
    outline: scoped.outline,
    focus: "relationship",
    currentScene: "",
    occupation: undefined,
    characterId: null,
    characterName: null,
    now: new Date(),
  });

  const batches = chaptersOf(scoped.outline);
  const chunks = batches.length + 1;
  const headStable = systemPromptFor("head").length + input.length;
  const bodyStable = systemPromptFor("body").length + input.length;
  // 머리와 본문은 서로 필요한 계약만 받는다. 본문끼리는 시스템 + 같은 입력 JSON
  // 프리픽스를 정확히 공유하므로 첫 본문 뒤의 호출은 JSON까지 캐시 대상이다.
  const inputTokens = estimateTokens(headStable + batches.length * bodyStable);
  // 무료 첫 절은 한 번뿐이라 유료 캐시 쓰기를 만들지 않는다. 결제 후 남은 본문
  // 묶음끼리만 새 캐시를 공유한다(결제까지 시간이 길면 무료 호출의 캐시는 어차피 없다).
  const paidBodyBatches = Math.max(0, batches.length - 1);
  const cached = estimateTokens(Math.max(0, paidBodyBatches - 1) * bodyStable);
  const cacheWrite = paidBodyBatches > 1 ? estimateTokens(bodyStable) : 0;
  const out = outputChars(product.id, scoped.outline.length);
  const outputTokens = estimateTokens(out.chars);

  const usage = { input: inputTokens, output: outputTokens, cached, cacheWrite };
  const cost: Record<string, number> = {};
  for (const model of MODELS) cost[model] = costOf(model, usage) ?? 0;

  // 결제 전에 만드는 몫 — 머리 하나 + 첫 묶음. 전환되지 않으면 그대로 버려진다.
  const previewSections = batches[0]?.items.length ?? 0;
  const perSection = outputTokens / Math.max(1, scoped.outline.length);
  // 머리는 헤드라인·요약 카드·질문뿐이라 한 절보다 짧다.
  const headTokens = Math.round(perSection * 0.75);
  const previewUsage = {
    input: estimateTokens(headStable + bodyStable),
    output: Math.round(headTokens + perSection * previewSections),
    // 머리와 본문 시스템이 다르고 각각 한 번뿐이라 유료 캐시 쓰기를 만들지 않는다.
    cached: 0,
    cacheWrite: 0,
  };
  const previewCost: Record<string, number> = {};
  for (const model of MODELS) previewCost[model] = costOf(model, previewUsage) ?? 0;

  rows.push({
    id: product.id,
    price: OFFER_PRICE.get(product.id) ?? product.price,
    cost,
    previewCost,
    previewSections,
  });
  console.log(
    product.id.padEnd(12) +
      String(scoped.outline.length).padStart(3) +
      String(chunks).padStart(5) +
      (inputTokens / 1000).toFixed(0).padStart(7) +
      ((outputTokens / 1000).toFixed(0) + (out.measured ? "" : "~")).padStart(7) +
      MODELS.map((m) => `$${cost[m].toFixed(4)}`.padStart(14)).join("")
  );
}

console.log("\n출력k 의 ~ 는 실측이 아니라 절당 평균으로 어림한 값입니다.\n");

console.log("광고 오퍼(990원)가 있는 상품의 원가율\n");
console.log("상품".padEnd(12) + "판매가".padStart(9) + MODELS.map((m) => m.slice(0, 12).padStart(14)).join(""));
console.log("-".repeat(21 + MODELS.length * 14));
for (const row of rows) {
  if (!OFFER_PRICE.has(row.id)) continue;
  const krw = OFFER_PRICE.get(row.id)!;
  console.log(
    row.id.padEnd(12) +
      `${krw.toLocaleString()}원`.padStart(9) +
      MODELS.map((m) => {
        const share = ((row.cost[m] * KRW_PER_USD) / krw) * 100;
        return `${share.toFixed(1)}%`.padStart(14);
      }).join("")
  );
}

console.log("\n결제 전에 버려지는 몫 (머리 + 첫 묶음). 전환되지 않으면 그대로 손실입니다.\n");
console.log(
  "상품".padEnd(12) + "미리보기절".padStart(11) + MODELS.map((m) => m.slice(0, 12).padStart(14)).join("")
);
console.log("-".repeat(23 + MODELS.length * 14));
for (const row of rows) {
  if (!OFFER_PRICE.has(row.id)) continue;
  console.log(
    row.id.padEnd(12) +
      String(row.previewSections).padStart(11) +
      MODELS.map((m) => `$${row.previewCost[m].toFixed(4)}`.padStart(14)).join("")
  );
}
console.log("\n클릭 1,000회에 전환 3% 라면 (gpt-5.6 기준)\n");
for (const row of rows) {
  if (!OFFER_PRICE.has(row.id)) continue;
  const wasted = row.previewCost["gpt-5.6"] * 970;
  const earned = row.cost["gpt-5.6"] * 30;
  console.log(
    `  ${row.id.padEnd(12)} 버려짐 $${wasted.toFixed(2)} + 완성 $${earned.toFixed(2)} = $${(wasted + earned).toFixed(2)}` +
      `  (매출 ${(30 * (OFFER_PRICE.get(row.id) ?? 0)).toLocaleString()}원)`
  );
}

console.log("\n단가 (100만 토큰당 USD)\n");
for (const model of MODELS) {
  const p = MODEL_PRICES[model];
  console.log(
    `  ${model.padEnd(18)} 입력 $${p.input.toFixed(2).padStart(5)}` +
      (p.cachedInput !== undefined ? ` (캐시 $${p.cachedInput.toFixed(3)})` : "".padEnd(15)) +
      `  출력 $${p.output.toFixed(2)}` +
      (p.note ? `\n${" ".repeat(22)}${p.note}` : "")
  );
}
