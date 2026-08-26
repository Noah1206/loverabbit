import { NextRequest, NextResponse } from "next/server";

import {
  adminKeyFromAuthorization,
  isAdminApprovalConfigured,
  verifyAdminApprovalKey,
} from "@/lib/admin-auth";
import {
  checkRegistrationChallenge,
  deletePasskey,
  issueChallenge,
  issueSession,
  listPasskeys,
  relyingParty,
  savePasskey,
  verifyAssertion,
} from "@/lib/admin-passkey";
import { isDatabaseConfigured } from "@/lib/database";

/*
  관리자 패스키 — 등록과 인증을 한 자리에서 받는다.

  세 동작이 같은 도전값·같은 도메인 규칙을 공유하므로 파일을 가르면 그 규칙이
  세 곳에 흩어진다. action 하나로 나눈다.

    challenge  도전값을 낸다 (누구나 부를 수 있다 — 이것만으로는 아무것도 못 연다)
    register   이 기기를 등록한다 (관리자 키가 있어야 한다)
    verify     Face ID 서명을 확인하고 12시간짜리 표를 내준다

  등록은 반드시 관리자 키를 요구한다. 패스키로 패스키를 등록할 수 있게 두면,
  표를 한 번 훔친 사람이 자기 기기를 심어 영구 접근을 만든다.
*/

export const runtime = "nodejs";

interface Body {
  action?: "challenge" | "register" | "verify" | "list" | "delete";
  label?: string;
  credentialId?: string;
  publicKey?: string;
  algorithm?: number;
  authenticatorData?: string;
  clientDataJSON?: string;
  signature?: string;
  challengeToken?: string;
}

function hasAdminKey(request: NextRequest): boolean {
  return verifyAdminApprovalKey(adminKeyFromAuthorization(request.headers.get("authorization")));
}

export async function POST(request: NextRequest) {
  if (!isAdminApprovalConfigured()) {
    return NextResponse.json({ error: "관리자 승인 키가 설정되지 않았어요." }, { status: 503 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결을 준비 중입니다." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const rp = relyingParty();

  if (body.action === "challenge") {
    const { challenge, token } = issueChallenge();
    let registered: { credentialId: string; label: string | null }[] = [];
    try {
      registered = (await listPasskeys()).map((key) => ({
        credentialId: key.credentialId,
        label: key.label,
      }));
    } catch (error) {
      console.error("패스키 목록 조회 실패:", error);
    }
    return NextResponse.json(
      { challenge, challengeToken: token, rpId: rp.id, registered },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  if (body.action === "register") {
    // 등록만은 관리자 키를 요구한다. 패스키 표로 새 패스키를 심게 두면
    // 표를 한 번 훔친 사람이 영구 접근을 만든다.
    if (!hasAdminKey(request)) {
      return NextResponse.json({ error: "등록에는 관리자 키가 필요해요." }, { status: 401 });
    }
    if (!body.challengeToken || !body.clientDataJSON || !body.credentialId || !body.publicKey) {
      return NextResponse.json({ error: "등록 정보가 모자라요." }, { status: 400 });
    }
    const problem = checkRegistrationChallenge(body.challengeToken, body.clientDataJSON);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    try {
      await savePasskey({
        credentialId: body.credentialId,
        publicKey: body.publicKey,
        algorithm: Number(body.algorithm ?? -7),
        label: body.label,
      });
    } catch (error) {
      console.error("패스키 등록 실패:", error);
      return NextResponse.json({ error: "기기를 등록하지 못했어요." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "verify") {
    if (
      !body.credentialId ||
      !body.authenticatorData ||
      !body.clientDataJSON ||
      !body.signature ||
      !body.challengeToken
    ) {
      return NextResponse.json({ error: "인증 정보가 모자라요." }, { status: 400 });
    }
    let result;
    try {
      result = await verifyAssertion({
        credentialId: body.credentialId,
        authenticatorData: body.authenticatorData,
        clientDataJSON: body.clientDataJSON,
        signature: body.signature,
        challengeToken: body.challengeToken,
      });
    } catch (error) {
      console.error("패스키 검증 실패:", error);
      return NextResponse.json({ error: "인증을 확인하지 못했어요." }, { status: 503 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.reason ?? "인증에 실패했어요." }, { status: 401 });
    }
    const session = issueSession(result.credentialId ?? body.credentialId);
    return NextResponse.json(
      { token: session.token, expiresAt: session.expiresAt },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  if (body.action === "list") {
    if (!hasAdminKey(request)) {
      return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
    }
    const keys = await listPasskeys();
    return NextResponse.json({
      keys: keys.map((key) => ({ credentialId: key.credentialId, label: key.label })),
    });
  }

  if (body.action === "delete") {
    if (!hasAdminKey(request)) {
      return NextResponse.json({ error: "관리자 인증에 실패했어요." }, { status: 401 });
    }
    if (!body.credentialId) {
      return NextResponse.json({ error: "지울 기기를 골라주세요." }, { status: 400 });
    }
    await deletePasskey(body.credentialId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
}
