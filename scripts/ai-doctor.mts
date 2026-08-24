// 지금 어느 길로 문장이 만들어지는지, 그 길이 실제로 뚫려 있는지 본다.
//
// 모델을 부르는 것은 마지막 한 번뿐이고 열 토큰짜리다. 그 앞은 전부 설정과
// 파일만 본다 — 뚫려 있는지 확인하려고 리포트 한 편을 만들 이유는 없다.
//
//   npm run ai:doctor          지금 설정으로
//   npm run ai:doctor -- --call   실제로 한 번 불러 본다 (열 토큰)

import { existsSync } from "node:fs";
import path from "node:path";

import { chatComplete, isAiConfigured, pinnedProvider, serverlessHost } from "../src/lib/ai";
import { previewSections, chaptersOf } from "../src/lib/reading-compose";
import { demoMode, pendingDemoSlots } from "../src/lib/reading-demo";
import { PRODUCTS } from "../src/lib/products";
import { MODEL_PRICES } from "../src/lib/ai-pricing";

const WANT_CALL = process.argv.includes("--call");
const mark = (ok: boolean) => (ok ? "OK " : "-- ");

console.log("── 어느 길로 나가는가 ──────────────────────────────\n");

const pinned = pinnedProvider();
const keys = {
  anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  gemini: Boolean(process.env.GEMINI_API_KEY),
  openai: Boolean(process.env.OPENAI_API_KEY),
};
console.log(`AI_PROVIDER      ${pinned ?? "(안 박음 — 키 우선순위대로)"}`);
console.log(`키               anthropic=${keys.anthropic} gemini=${keys.gemini} openai=${keys.openai}`);
console.log(`isAiConfigured   ${isAiConfigured()}`);

const chosen = pinned ?? (keys.anthropic ? "anthropic" : keys.gemini ? "gemini" : keys.openai ? "openai" : null);
console.log(`실제로 갈 곳     ${chosen ?? "없음 — 데모 글로 떨어진다"}`);

if (chosen === "openai") {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const price = MODEL_PRICES[model];
  console.log(`  OPENAI_MODEL   ${model}${price ? ` (출력 $${price.output}/1M)` : " (단가표에 없음)"}`);
}

console.log("\n── 구독으로 도는 길 (claude-code) ────────────────\n");

const bin = process.env.CLAUDE_CODE_BIN;
const guess = path.join(
  process.env.APPDATA ?? "",
  "npm",
  "node_modules",
  "@anthropic-ai",
  "claude-code",
  "bin",
  "claude.exe"
);
const found = bin ? existsSync(bin) : existsSync(guess);
console.log(`${mark(Boolean(bin))}CLAUDE_CODE_BIN  ${bin ?? "(안 줌 — 기본 자리를 찾는다)"}`);
console.log(`${mark(found)}실행 파일        ${bin ?? guess}`);
if (!found && !bin) {
  console.log("     못 찾으면 PATH 의 claude.cmd 로 떨어집니다. 없으면 이 길은 안 뚫립니다.");
  console.log("     설치: npm i -g @anthropic-ai/claude-code   그리고 한 번 로그인해 두세요.");
}
console.log(`   CLAUDE_CODE_MODEL ${process.env.CLAUDE_CODE_MODEL ?? "sonnet (기본)"}`);
console.log(`   CLAUDE_CODE_TIMEOUT_MS ${process.env.CLAUDE_CODE_TIMEOUT_MS ?? "180000 (기본)"}`);
console.log(`${mark(pinned === "claude-code")}이 길로 가는가  ${pinned === "claude-code" ? "예" : "아니오 — AI_PROVIDER=claude-code 로 못 박아야 합니다"}`);
const host = serverlessHost();
console.log(
  `${mark(!host)}여기서 되는가  ${host ? `아니오 — ${host} 에는 CLI 도 로그인 세션도 없습니다` : "예 (내 컴퓨터에서 도는 서버)"}`
);
if (host && pinned === "claude-code") {
  console.log("     이대로 배포하면 사용자가 생성 버튼을 누른 뒤에 실패합니다.");
  console.log("     AI_PROVIDER 를 openai 로 바꾸세요.");
}

console.log("\n── 결제 전에 만드는 몫 ───────────────────────────\n");

const n = previewSections();
console.log(`READING_PREVIEW_SECTIONS  ${process.env.READING_PREVIEW_SECTIONS ?? "(안 줌)"} -> ${n}절`);
for (const id of ["sokgunghap", "yeonae", "ibyeol"]) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) continue;
  const batches = chaptersOf(product.toc);
  console.log(
    `  ${id.padEnd(11)} 목차 ${String(product.toc.length).padStart(2)}절 · ` +
      `첫 묶음 ${batches[0]?.items.length ?? 0}절 · 전체 묶음 ${batches.length}개 · ` +
      `결제 전 요청 ${Math.min(2, batches.length + 1)}회`
  );
}
console.log("\n   1로 바꾸면 결제하지 않는 사람에게 드는 돈이 줄어듭니다.");
console.log("   만들다 만 리딩이 있는 채로 바꾸면 이어 만들기가 절을 건너뜁니다.");

console.log("\n── 데모 모드 ─────────────────────────────────────\n");
console.log(`READING_DEMO_MODE  ${demoMode()}`);
const pending = pendingDemoSlots();
console.log(`   아직 안 채운 자리: ${pending.join(", ") || "없음"}`);

console.log("\n── 되돌릴 스위치 ─────────────────────────────────\n");
console.log("  AI_PROVIDER=openai              종량과금으로. Vercel 은 이것만 됩니다");
console.log("  AI_PROVIDER=claude-code         구독으로. CLI 가 있는 서버에서만");
console.log("  OPENAI_MODEL=gpt-4o-mini        원가 10분의 1, 품질 미검증");
console.log("  READING_PREVIEW_SECTIONS=1      결제 전에 만드는 몫을 절반으로");
console.log("  READING_DEMO_MODE=on            생성하지 않고 미리 만든 글로");
console.log("\n  전부 환경변수입니다. 코드를 고치지 않고 배포 설정만 바꾸면 됩니다.");

if (!WANT_CALL) {
  console.log("\n실제로 한 번 불러 보려면 --call 을 붙이세요 (열 토큰).");
  process.exit(0);
}

console.log("\n── 한 번 불러 본다 ──────────────────────────────\n");
const started = Date.now();
try {
  const result = await chatComplete("한 단어로만 답해.", [{ role: "user", content: "ok?" }], 16, {
    thinking: false,
  });
  const ms = Date.now() - started;
  if (!result) {
    console.log("null — 지목한 곳에 키가 없습니다. 호출부는 데모 글로 떨어집니다.");
    process.exit(1);
  }
  console.log(`OK  provider=${result.provider} model=${result.model} ${ms}ms`);
  console.log(`    "${result.text.trim().slice(0, 40)}"`);
  if (result.usage) {
    console.log(`    토큰 입력 ${result.usage.input} 출력 ${result.usage.output} 캐시 ${result.usage.cached ?? 0}`);
  }
} catch (error) {
  console.log(`실패 (${Date.now() - started}ms)`);
  console.log(String(error).split("\n").slice(0, 4).join("\n"));
  process.exit(1);
}
