// 이 서버가 어느 경로를 어느 모델로 보내는가.
//
//   curl -H "Authorization: Bearer $ADMIN_APPROVAL_KEY" https://loverebbit.xyz/api/admin/model-routing
//
// **모델을 부르지 않는다.** 환경변수와 코드의 판단 규칙만 읽는다. 그래서 값이 0원이고,
// 배포 직후 설정이 먹었는지 확인하는 데 리딩 한 건을 태울 필요가 없다.
//
// 이게 필요한 이유는 모델이 세 군데서 정해지기 때문이다 - AI_PROVIDER 가 제공사를
// 고르고, OPENAI_MODEL 이 그 제공사의 기본을 고르고, FREE_PREVIEW_MODEL 이 무료
// 경로만 따로 지목한다. 셋이 서로를 덮어써서 대시보드만 보고는 결론이 안 난다.
//
// **키 값은 절대 내보내지 않는다.** 있는지 없는지만 말한다.

import { NextRequest, NextResponse } from "next/server";

import { adminKeyFromAuthorization, verifyAdminApprovalKey } from "@/lib/admin-auth";
import { effectiveProvider, pinnedProvider, serverlessHost } from "@/lib/ai";
import { priceOf } from "@/lib/ai-pricing";
import { freePreviewModel } from "@/lib/free-preview";
import { previewSections } from "@/lib/reading-compose";

export const dynamic = "force-dynamic";

function defaultModelOf(provider: string | null): string {
  if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (provider === "anthropic") return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  if (provider === "gemini") return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  if (provider === "claude-code") return process.env.CLAUDE_CODE_MODEL ?? "sonnet";
  return "(제공사 없음)";
}

export async function GET(req: NextRequest) {
  if (!verifyAdminApprovalKey(adminKeyFromAuthorization(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  }

  const provider = effectiveProvider();
  const host = serverlessHost();
  const paidModel = defaultModelOf(provider);
  const wanted = freePreviewModel();
  // 지목은 OpenAI 일 때만 산다. free-preview-run.ts 의 판단과 같은 규칙이어야 한다.
  const freeModel = wanted && provider === "openai" ? wanted : paidModel;
  const slimOn = process.env.FREE_PREVIEW_V2 === "1";

  const priced = (model: string) => {
    const p = priceOf(model);
    return p ? { input: p.input, cachedInput: p.cachedInput ?? p.input, output: p.output } : null;
  };

  const warnings: string[] = [];
  if (pinnedProvider() === "claude-code" && host) {
    warnings.push(`AI_PROVIDER=claude-code 는 ${host} 에서 쓸 수 없다. 생성이 전부 실패한다.`);
  }
  if (wanted && provider !== "openai") {
    warnings.push(`FREE_PREVIEW_MODEL="${wanted}" 가 무시된다. 제공사가 ${provider ?? "없음"} 이라서다.`);
  }
  if (!priceOf(freeModel)) warnings.push(`${freeModel} 단가가 가격표에 없다. 예산 가드가 금액으로 못 막는다.`);
  if (!priceOf(paidModel)) warnings.push(`${paidModel} 단가가 가격표에 없다.`);
  if (!provider) warnings.push("쓸 수 있는 제공사가 없다. 키가 하나도 없거나 못 박은 것이 잘못됐다.");

  return NextResponse.json({
    host: host ?? "local",
    provider,
    pinned: pinnedProvider(),
    // 값이 아니라 있고 없음만.
    keys: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    freePreview: {
      slim: slimOn,
      shape: slimOn ? "슬림 1회" : `머리+${previewSections()}절, 2회`,
      model: freeModel,
      from: slimOn && wanted && provider === "openai" ? "FREE_PREVIEW_MODEL" : "제공사 기본",
      price: priced(freeModel),
    },
    paidReport: { model: paidModel, from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본", price: priced(paidModel) },
    warnings,
  });
}
