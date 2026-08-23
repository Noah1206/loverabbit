// 이 서버가 어느 경로를 어느 모델로 보내는가.
//
//   curl -H "Authorization: Bearer $ADMIN_APPROVAL_KEY" https://loverebbit.xyz/api/admin/model-routing
//
// **모델을 부르지 않는다.** 환경변수와 코드의 판단 규칙만 읽는다. 그래서 값이 0원이고,
// 배포 직후 설정이 먹었는지 확인하는 데 리딩 한 건을 태울 필요가 없다.
//
// 무료 초안과 결제 후 본문은 같은 제공사·모델을 쓴다. 이 화면은 그 계약이 배포
// 환경에서도 실제로 살아 있는지, 예전 FREE_PREVIEW_MODEL 설정이 남았는지 보여준다.
//
// **키 값은 절대 내보내지 않는다.** 있는지 없는지만 말한다.

import { NextRequest, NextResponse } from "next/server";

import { adminKeyFromAuthorization, verifyAdminApprovalKey } from "@/lib/admin-auth";
import { effectiveProvider, pinnedProvider, serverlessHost } from "@/lib/ai";
import { priceOf } from "@/lib/ai-pricing";
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
  const legacyFreeModel = process.env.FREE_PREVIEW_MODEL?.trim();

  const priced = (model: string) => {
    const p = priceOf(model);
    return p ? { input: p.input, cachedInput: p.cachedInput ?? p.input, output: p.output } : null;
  };

  const warnings: string[] = [];
  if (pinnedProvider() === "claude-code" && host) {
    warnings.push(`AI_PROVIDER=claude-code 는 ${host} 에서 쓸 수 없다. 생성이 전부 실패한다.`);
  }
  if (legacyFreeModel) {
    warnings.push(`FREE_PREVIEW_MODEL="${legacyFreeModel}" 는 이전 슬림 경로 설정이라 지금은 무시된다.`);
  }
  if (process.env.FREE_PREVIEW_V2 === "1") {
    warnings.push("FREE_PREVIEW_V2=1 은 이전 슬림 경로 플래그라 지금은 무시된다.");
  }
  if (!priceOf(paidModel)) warnings.push(`${paidModel} 단가가 가격표에 없다.`);
  if (!provider) warnings.push("쓸 수 있는 제공사가 없다. 키가 하나도 없거나 못 박은 것이 잘못됐다.");

  return NextResponse.json({
    host: host ?? "local",
    // 지금 돌고 있는 것이 어느 커밋인가.
    //
    // 이게 없으면 "배포 됐어?" 에 답할 방법이 없다. 코드를 밀고 나서 화면이 안
    // 바뀌면 배포가 안 끝난 것인지 고친 것이 틀린 것인지 구분이 안 되는데,
    // 그 둘은 대응이 정반대다. Vercel 이 넣어 주는 값이라 로컬에서는 비어 있다.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? undefined : "(로컬)",
    provider,
    pinned: pinnedProvider(),
    // 값이 아니라 있고 없음만.
    keys: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    freePreview: {
      continuous: true,
      shape: `확정 머리+${previewSections()}절, 결제 후 다음 절부터 이어쓰기`,
      model: paidModel,
      from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본",
      price: priced(paidModel),
    },
    paidReport: { model: paidModel, from: provider === "openai" ? "OPENAI_MODEL" : "제공사 기본", price: priced(paidModel) },
    warnings,
  });
}
