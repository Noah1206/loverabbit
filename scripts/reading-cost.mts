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
import { buildReadingInput, READING_SYSTEM_PROMPT } from "../src/lib/reading-prompt";
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

const rows: { id: string; price: number | undefined; cost: Record<string, number> }[] = [];

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

  const chunks = chaptersOf(scoped.outline).length + 1;
  // 조각마다 시스템 프롬프트와 입력 JSON 이 통째로 다시 나간다. 그게 입력의 거의 전부다.
  const inputTokens = estimateTokens(chunks * (READING_SYSTEM_PROMPT.length + input.length));
  // 같은 지시가 되풀이되므로 첫 조각을 뺀 나머지는 캐시로 본다.
  const cached = estimateTokens((chunks - 1) * READING_SYSTEM_PROMPT.length);
  const out = outputChars(product.id, scoped.outline.length);
  const outputTokens = estimateTokens(out.chars);

  const usage = { input: inputTokens, output: outputTokens, cached };
  const cost: Record<string, number> = {};
  for (const model of MODELS) cost[model] = costOf(model, usage) ?? 0;

  rows.push({ id: product.id, price: OFFER_PRICE.get(product.id) ?? product.price, cost });
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
