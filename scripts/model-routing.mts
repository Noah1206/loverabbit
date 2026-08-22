// 지금 이 환경에서 어느 경로가 어느 모델로 나가는가.
//
//   npm run model:routing
//
// 모델을 부르지 않는다. 환경변수와 코드의 판단 규칙만 읽어서 표로 만든다.
//
// 이게 필요한 이유는 모델이 세 군데서 정해지기 때문이다 - AI_PROVIDER 가
// 제공사를 고르고, OPENAI_MODEL 이 그 제공사의 기본을 고르고, FREE_PREVIEW_MODEL
// 이 무료 경로만 따로 지목한다. 셋이 서로를 덮어써서, 머릿속으로 짚으면 틀린다.

import { effectiveProvider, pinnedProvider, serverlessHost } from "../src/lib/ai";
import { freePreviewModel } from "../src/lib/free-preview";
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
const wanted = freePreviewModel();
// 지목은 OpenAI 일 때만 산다. free-preview-run.ts 의 판단과 같은 규칙이다.
const freeModel = wanted && provider === "openai" ? wanted : paidModel;
const slimOn = process.env.FREE_PREVIEW_V2 === "1";

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
    when: slimOn ? "FREE_PREVIEW_V2=1 (슬림 1회)" : `기본 경로 (머리+${previewSections()}절, 2회)`,
    model: slimOn ? freeModel : paidModel,
    from: slimOn && wanted && provider === "openai" ? "FREE_PREVIEW_MODEL" : "제공사 기본",
  },
  {
    path: "유료 본문 (결제 후)",
    when: "/api/unlock -> reading-finish",
    model: paidModel,
    from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본",
  },
  {
    path: "신당 채팅",
    when: "/api/shrine-chat",
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

if (wanted && provider !== "openai") {
  console.log(`[!] FREE_PREVIEW_MODEL="${wanted}" 가 무시된다. 제공사가 ${provider ?? "없음"} 이라서다.`);
}
if (!slimOn) {
  console.log(`[i] FREE_PREVIEW_V2 가 꺼져 있다. 무료 미리보기는 유료와 같은 프롬프트로 2회 부른다.`);
}
const unpriced = [freeModel, paidModel].filter((m) => !MODEL_PRICES[m] && !priceOf(m));
if (unpriced.length) console.log(`[!] 단가를 모르는 모델: ${[...new Set(unpriced)].join(", ")}`);
console.log();
