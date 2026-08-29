// 무료 미리보기 1건 — 어디를 줄이면 얼마가 주는가.
//
//   npx tsx scripts/cost-levers.mts
//
// 모델을 부르지 않는다. 입력은 프롬프트가 결정론적이라 세면 되고, 출력은 코드가
// 잡아 둔 예산(budget)을 상한으로 본다.
//
// 지금까지 입력만 봤는데, 출력 단가가 입력의 4~8배다. 어느 쪽이 큰지 갈라 본다.

import { buildSajuFacts } from "../src/lib/saju-facts";
import { matchRules } from "../src/lib/reading-rules";
import { scopeOutline } from "../src/lib/reading-scope";
import { buildReadingInput, READING_SYSTEM_PROMPT, systemPromptFor } from "../src/lib/reading-prompt";
import { previewBatchCount } from "../src/lib/reading-compose";
import { PRODUCTS } from "../src/lib/products";
import { MODEL_PRICES, estimateTokens, type ModelPrice } from "../src/lib/ai-pricing";
import { FREE_PREVIEW_LIMITS, FREE_PREVIEW_SYSTEM_PROMPT, buildFreePreviewPrompt, buildPreviewFactPacket } from "../src/lib/free-preview";

const KRW = 1450;
const me = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });
const partner = buildSajuFacts({ year: 1991, month: 7, day: 8, hour: 20, gender: "M" });

const id = "sokgunghap";
const product = PRODUCTS.find((p) => p.id === id)!;
const rules = matchRules(me, partner, id);
const outline = scopeOutline({ product: id, outline: product.toc, facts: me, matchedRules: rules }).outline;
const inputJson = buildReadingInput({
  facts: me, partnerFacts: partner, matchedRules: rules, productLabel: product.promptLabel,
  productId: product.id,
  outline, focus: "relationship", currentScene: "", occupation: undefined,
  now: new Date(2026, 7, 22),
} as Parameters<typeof buildReadingInput>[0]);

const SYS = estimateTokens(READING_SYSTEM_PROMPT.length);
const HEAD_SYS = estimateTokens(systemPromptFor("head").length);
const BODY_SYS = estimateTokens(systemPromptFor("body").length);
const JSONTOK = estimateTokens(inputJson.length);
const CALLS = 1 + previewBatchCount(outline);
const BODY_CALLS = CALLS - 1;
const OUT_HEAD = 2600;
const OUT_BATCH = 3000;

const packet = buildPreviewFactPacket({ rules, product: id, relationshipStatus: "dating", dayMasterElement: me.dayMasterElement as never })!;
const SLIM_SYS = estimateTokens(FREE_PREVIEW_SYSTEM_PROMPT.length);
const SLIM_IN = estimateTokens(FREE_PREVIEW_SYSTEM_PROMPT.length + buildFreePreviewPrompt(packet).length);

/** OpenAI 자동 캐시는 1,024토큰 이상인 공통 앞부분에만 걸린다 */
const CACHE_FLOOR = 1024;

interface Lever { name: string; fresh: number; cached: number; cacheWrite: number; output: number; note?: string }

const levers: Lever[] = [
  { name: "1. 통짜 · 캐시 없음", fresh: (SYS + JSONTOK) * CALLS, cached: 0, cacheWrite: 0, output: OUT_HEAD + OUT_BATCH },
  // 입력 JSON도 한 리딩 안에서는 호출마다 정확히 같다. 첫 호출이 쓴 뒤에는
  // 지시문뿐 아니라 JSON까지 같은 프리픽스로 읽힌다.
  { name: "2. 통짜 · 정확한 캐싱", fresh: 0, cached: (SYS + JSONTOK) * (CALLS - 1), cacheWrite: SYS + JSONTOK, output: OUT_HEAD + OUT_BATCH,
    note: "입력 JSON도 반복 호출에서는 캐시 대상" },
  { name: "3. 갈래 지시문", fresh: HEAD_SYS + JSONTOK + (BODY_CALLS === 1 ? BODY_SYS + JSONTOK : 0),
    cached: Math.max(0, BODY_CALLS - 1) * (BODY_SYS + JSONTOK),
    cacheWrite: BODY_CALLS > 1 ? BODY_SYS + JSONTOK : 0,
    output: OUT_HEAD + OUT_BATCH,
    note: "머리에는 본문 계약을, 본문에는 머리 계약을 보내지 않음" },
  { name: "4. + 미리보기 1절", fresh: HEAD_SYS + JSONTOK + (BODY_CALLS === 1 ? BODY_SYS + JSONTOK : 0),
    cached: Math.max(0, BODY_CALLS - 1) * (BODY_SYS + JSONTOK),
    cacheWrite: BODY_CALLS > 1 ? BODY_SYS + JSONTOK : 0,
    output: OUT_HEAD + Math.round(OUT_BATCH / 2),
    note: "READING_PREVIEW_SECTIONS=1" },
  { name: "5. 슬림 경로", fresh: SLIM_IN, cached: 0, cacheWrite: 0, output: FREE_PREVIEW_LIMITS.maxOutputTokens,
    note: SLIM_SYS < CACHE_FLOOR ? `지시문이 ${SLIM_SYS}토큰이라 캐시 문턱(${CACHE_FLOOR}) 아래 — 캐싱 이득 없음` : "" },
];

const cost = (p: ModelPrice, l: Lever) =>
  (l.fresh * p.input +
    l.cacheWrite * p.input * (p.cacheWriteMultiplier ?? 1) +
    l.cached * (p.cachedInput ?? p.input) +
    l.output * p.output) / 1_000_000;

for (const model of ["gpt-5-mini", "gpt-5.6", "claude-sonnet-5"]) {
  const p = MODEL_PRICES[model];
  if (!p) continue;
  const base = cost(p, levers[0]);
  console.log(`\n── ${model}  (입력 $${p.input} / 캐시 $${p.cachedInput ?? p.input} / 출력 $${p.output}) ──`);
  for (const l of levers) {
    const c = cost(p, l);
    const inUsd = (
      l.fresh * p.input +
      l.cacheWrite * p.input * (p.cacheWriteMultiplier ?? 1) +
      l.cached * (p.cachedInput ?? p.input)
    ) / 1_000_000;
    const outUsd = (l.output * p.output) / 1_000_000;
    console.log(
      `  ${l.name.padEnd(22)} $${c.toFixed(5)} (${Math.round(c * KRW)}원)  ` +
      `입력 $${inUsd.toFixed(5)} 출력 $${outUsd.toFixed(5)}   ${(((base - c) / base) * 100).toFixed(0)}% 절감`
    );
    if (l.note) console.log(`  ${" ".repeat(22)} ${l.note}`);
    // 캐시 단가를 모르면 절감이 0으로 보인다. 그건 안 먹는다는 뜻이 아니라
    // 표에 값이 없다는 뜻이다 - 숫자가 거짓말하지 않게 여기서 밝힌다.
    if (l.cached > 0 && p.cachedInput === undefined)
      console.log(`  ${" ".repeat(22)} [!] ${model} 캐시 단가가 가격표에 없다. 이 줄의 절감은 실제보다 낮게 나온다.`);
  }
}
console.log(`\n지시문 통짜 ${SYS}tok · 머리 ${HEAD_SYS}tok · 본문 ${BODY_SYS}tok · 입력JSON ${JSONTOK}tok · 호출 ${CALLS}회 · 슬림 입력 ${SLIM_IN}tok\n`);
