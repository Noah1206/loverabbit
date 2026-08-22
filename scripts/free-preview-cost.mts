// 무료 미리보기 한 건이 지금 얼마고, 슬림 경로로 바꾸면 얼마인가.
//
//   npx tsx scripts/free-preview-cost.mts
//
// **모델을 부르지 않는다.** 프롬프트는 결정론적이라 입력 토큰은 호출 없이 셀 수
// 있다. 출력은 잴 수 없으므로 양쪽 다 상한치를 쓴다 - 어느 쪽에도 유리하게
// 봐주지 않으려면 같은 기준이어야 한다.
//
// 이 파일은 chatComplete 를 import 하지 않는다. 실수로도 부를 수 없게 하려는 것이다.

import { buildSajuFacts } from "../src/lib/saju-facts";
import { matchRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { buildReadingInput, READING_SYSTEM_PROMPT } from "../src/lib/reading-prompt";
import { chaptersOf, previewBatchCount, previewSections } from "../src/lib/reading-compose";
import { PRODUCTS } from "../src/lib/products";
import { MODEL_PRICES, costOf, estimateTokens } from "../src/lib/ai-pricing";
import {
  FREE_PREVIEW_LIMITS,
  FREE_PREVIEW_SYSTEM_PROMPT,
  buildFreePreviewPrompt,
  buildPreviewFactPacket,
} from "../src/lib/free-preview";

const KRW = 1450;
const me = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });
const partner = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" });

// 광고가 실제로 보내는 다섯 갈래
const CATEGORIES = ["sokgunghap", "insun", "ibyeol", "sseom"];

interface Row {
  product: string;
  oldInput: number;
  oldCalls: number;
  newInput: number;
}

const rows: Row[] = [];

for (const id of CATEGORIES) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) continue;

  const needsPartner = product.needsPartner;
  const other = needsPartner ? partner : null;
  const rules = matchRules(me, other, id);
  const outline = scopeOutline({ product: id, outline: product.toc, facts: me, matchedRules: rules }).outline;

  const inputJson = buildReadingInput({
    facts: me,
    partnerFacts: other,
    matchedRules: rules,
    productLabel: product.promptLabel,
    outline,
    focus: other ? "relationship" : "self",
    currentScene: "",
    occupation: undefined,
    characterId: null,
    characterName: null,
    now: new Date(2026, 7, 22),
  } as Parameters<typeof buildReadingInput>[0]);

  // ── 지금 ──
  // 무료 미리보기는 머리 하나 + 첫 묶음이다. 두 호출 모두 시스템 프롬프트와
  // 입력 JSON 을 통째로 다시 보낸다.
  const calls = 1 + previewBatchCount(outline);
  const perCall = READING_SYSTEM_PROMPT.length + inputJson.length;
  const oldInput = estimateTokens(perCall) * calls;

  // ── 슬림 ──
  const packet = buildPreviewFactPacket({
    rules,
    product: id,
    relationshipStatus: other ? "dating" : "single",
    dayMasterElement: me.dayMasterElement as "목" | "화" | "토" | "금" | "수",
  });
  if (!packet) {
    console.log(`${id}: 근거가 셋도 안 돼 패킷을 못 만든다 — 폴백 경로(값 0)`);
    continue;
  }
  const newInput = estimateTokens(FREE_PREVIEW_SYSTEM_PROMPT.length + buildFreePreviewPrompt(packet).length);

  rows.push({ product: `${id} (${product.title})`, oldInput, oldCalls: calls, newInput });
}

const OUT_OLD = 2600 + 3000; // 머리 예산 + 첫 묶음 예산의 어림
const OUT_NEW = FREE_PREVIEW_LIMITS.maxOutputTokens;

const won = (usd: number) => `${Math.round(usd * KRW).toLocaleString()}원`;

console.log(`\n무료 미리보기 1건 — 모델 호출 없이 센 값`);
console.log(`미리보기 절 수 ${previewSections()} · 출력은 양쪽 다 상한치로 본다 (지금 ${OUT_OLD} / 슬림 ${OUT_NEW})\n`);

for (const model of ["gpt-5-mini", "gpt-4o-mini", "gemini-2.5-flash", "gpt-5.6", "claude-sonnet-5"]) {
  if (!MODEL_PRICES[model]) continue;
  console.log(`── ${model} ──`);
  let sumOld = 0;
  let sumNew = 0;
  for (const row of rows) {
    const oldUsd = costOf(model, { input: row.oldInput, output: OUT_OLD }) ?? 0;
    const newUsd = costOf(model, { input: row.newInput, output: OUT_NEW }) ?? 0;
    sumOld += oldUsd;
    sumNew += newUsd;
    console.log(
      `  ${row.product.padEnd(28)} 지금 ${row.oldCalls}회 ${String(row.oldInput).padStart(6)}tok $${oldUsd.toFixed(5)}` +
      `   슬림 1회 ${String(row.newInput).padStart(5)}tok $${newUsd.toFixed(5)}`
    );
  }
  const avgOld = sumOld / rows.length;
  const avgNew = sumNew / rows.length;
  console.log(
    `  ${"평균".padEnd(28)} $${avgOld.toFixed(5)} (${won(avgOld)})` +
    `   →   $${avgNew.toFixed(5)} (${won(avgNew)})   ${(((avgOld - avgNew) / avgOld) * 100).toFixed(0)}% 절감\n`
  );
}

console.log(`상한 점검`);
for (const row of rows) {
  const over = row.newInput > FREE_PREVIEW_LIMITS.maxInputTokensEstimated;
  console.log(`  ${row.product.padEnd(28)} 슬림 입력 ${row.newInput}tok  ${over ? "[X] 상한 초과" : "[OK]"}`);
}
console.log();
