// 지금 이 환경에서 어느 경로가 어느 모델로 나가는가.
//
//   npm run model:routing
//
// 모델을 부르지 않는다. 환경변수와 코드의 판단 규칙만 읽어서 표로 만든다.
//
// 무료 초안과 결제 후 본문은 같은 제공사·모델을 쓴다. 예전 슬림 경로 변수는
// 남아 있어도 무시되며, 여기서 그 사실까지 드러낸다.

import { effectiveProvider, pinnedProvider, serverlessHost } from "../src/lib/ai";
import { MODEL_PRICES, priceOf } from "../src/lib/ai-pricing";
import { previewSections } from "../src/lib/reading-compose";

const provider = effectiveProvider();
const host = serverlessHost();

/** 그 제공사가 지목 없이 부를 때 쓰는 모델 (ai.ts 의 기본값과 같아야 한다) */
function defaultModelOf(p: string | null): string {
  if (p === "openai") return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (p === "anthropic") return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  if (p === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  if (p === "claude-code") return process.env.CLAUDE_CODE_MODEL ?? "sonnet";
  return "(제공사 없음 — 키가 하나도 없다)";
}

const paidModel = defaultModelOf(provider);
const legacyFreeModel = process.env.FREE_PREVIEW_MODEL?.trim();

const keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]
  .filter((k) => process.env[k])
  .map((k) => k.replace("_API_KEY", ""));

console.log(`\n실행 환경 ${host ?? "로컬"}`);
console.log(`AI_PROVIDER    ${process.env.AI_PROVIDER ?? "(안 박음 — 키 우선순위대로)"}`);
console.log(`있는 키        ${keys.length ? keys.join(", ") : "(없음)"}`);
console.log(`고른 제공사     ${provider ?? "(없음)"}`);
if (pinnedProvider() === "claude-code" && host) {
  console.log(`[X] claude-code 는 ${host} 에서 못 쓴다. 배포 환경에서는 반드시 바꿔야 한다.`);
}
console.log();

const rows = [
  {
    path: "무료 미리보기",
    when: `확정 머리+${previewSections()}절, 결제 후 다음 절부터 이어쓰기`,
    model: paidModel,
    from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본",
  },
  {
    path: "유료 본문 (결제 후)",
    when: "/api/unlock -> reading-finish",
    model: paidModel,
    from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본",
  },
  {
    path: "리딩 후속 질문",
    when: "/api/chat",
    model: paidModel,
    from: "제공사 기본",
  },
];

for (const r of rows) {
  const p = priceOf(r.model);
  const price = p
    ? `입력 $${p.input} / 캐시 $${p.cachedInput ?? p.input} / 출력 $${p.output}`
    : "[!] 가격표에 없다 — 예산 가드가 금액으로 못 막는다";
  console.log(`${r.path}`);
  console.log(`  언제   ${r.when}`);
  console.log(`  모델   ${r.model}   (${r.from})`);
  console.log(`  단가   ${price}\n`);
}

if (legacyFreeModel) {
  console.log(`[i] FREE_PREVIEW_MODEL="${legacyFreeModel}" 는 이전 슬림 경로 설정이라 지금은 무시된다.`);
}
if (process.env.FREE_PREVIEW_V2 === "1") {
  console.log("[i] FREE_PREVIEW_V2=1 은 이전 슬림 경로 플래그라 지금은 무시된다.");
}
const unpriced = [paidModel].filter((m) => !MODEL_PRICES[m] && !priceOf(m));
if (unpriced.length) console.log(`[!] 단가를 모르는 모델: ${[...new Set(unpriced)].join(", ")}`);
console.log();
