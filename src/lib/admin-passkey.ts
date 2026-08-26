import "server-only";

import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "crypto";

import { seal, open } from "@/lib/crypto";
import { SITE_URL } from "@/lib/site";
import { databaseError, getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  아이폰 Face ID 로 관리자 승인하기 (WebAuthn).

  라이브러리를 쓰지 않는다. 등록에서 attestationObject 를 파싱하지 않기 때문이다 —
  브라우저의 getPublicKey() 가 공개키를 SPKI DER 로 바로 준다(iOS 16+, 크롬 85+).
  그래서 CBOR 도 attestation 검증도 필요 없고, 남는 일은 서명 검증 하나다.

  attestation 을 none 으로 두는 것은 의도적이다. 우리가 알고 싶은 것은 "어느 회사가
  만든 인증기인가" 가 아니라 "등록할 때와 같은 기기가 지금 서명했는가" 다.

  도전값(challenge)은 표에 두지 않는다. seal() 로 봉인해 클라이언트에 맡기고 돌려
  받는다 — 서버리스에서 메모리에 두면 다음 요청이 다른 인스턴스로 간다.
*/

const CHALLENGE_TTL_MS = 3 * 60 * 1000;
/** Face ID 한 번으로 열려 있는 시간. 승인은 몰아서 하는 일이라 짧게 둘 이유가 없다. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** 이 서비스의 도메인. 패스키는 도메인에 묶인다 — 다른 도메인에서는 쓰이지 않는다. */
export function relyingParty(): { id: string; origin: string } {
  const origin = SITE_URL.replace(/\/+$/, "");
  return { id: new URL(origin).hostname, origin };
}

interface ChallengeToken {
  kind: "admin-passkey-challenge";
  challenge: string;
  exp: number;
}

interface SessionToken {
  kind: "admin-session";
  credentialId: string;
  exp: number;
}

export function issueChallenge(): { challenge: string; token: string } {
  const challenge = randomBytes(32).toString("base64url");
  const payload: ChallengeToken = {
    kind: "admin-passkey-challenge",
    challenge,
    exp: Date.now() + CHALLENGE_TTL_MS,
  };
  return { challenge, token: seal(payload) };
}

function readChallenge(token: string): string | null {
  const payload = open<ChallengeToken>(token);
  if (!payload || payload.kind !== "admin-passkey-challenge") return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload.challenge;
}

/** Face ID 를 통과한 뒤 브라우저가 들고 다니는 표. Bearer 로 그대로 보낸다. */
export function issueSession(credentialId: string): { token: string; expiresAt: number } {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload: SessionToken = { kind: "admin-session", credentialId, exp };
  return { token: seal(payload), expiresAt: exp };
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token) return false;
  const payload = open<SessionToken>(token);
  return Boolean(
    payload &&
      payload.kind === "admin-session" &&
      typeof payload.exp === "number" &&
      payload.exp > Date.now()
  );
}

// ── 저장 ──────────────────────────────────────────────────────────────────

export interface StoredPasskey {
  credentialId: string;
  publicKey: string;
  algorithm: number;
  label: string | null;
  signCount: number;
}

export async function listPasskeys(): Promise<StoredPasskey[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("lr_admin_passkeys")
    .select("credential_id,public_key,algorithm,label,sign_count")
    .order("created_at", { ascending: true });
  if (error) throw databaseError("패스키 조회", error);
  return (data ?? []).map((row) => ({
    credentialId: String(row.credential_id),
    publicKey: String(row.public_key),
    algorithm: Number(row.algorithm),
    label: typeof row.label === "string" ? row.label : null,
    signCount: Number(row.sign_count ?? 0),
  }));
}

export async function savePasskey(input: {
  credentialId: string;
  publicKey: string;
  algorithm: number;
  label?: string;
}): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("DB 연결이 없습니다.");
  const { error } = await db.from("lr_admin_passkeys").upsert(
    {
      credential_id: input.credentialId,
      public_key: input.publicKey,
      algorithm: input.algorithm,
      label: input.label?.slice(0, 40) ?? null,
    },
    { onConflict: "credential_id" }
  );
  if (error) throw databaseError("패스키 등록", error);
}

export async function deletePasskey(credentialId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db.from("lr_admin_passkeys").delete().eq("credential_id", credentialId);
  if (error) throw databaseError("패스키 삭제", error);
}

async function touchPasskey(credentialId: string, signCount: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("lr_admin_passkeys")
    .update({ sign_count: signCount, last_used_at: new Date().toISOString() })
    .eq("credential_id", credentialId);
}

// ── 검증 ──────────────────────────────────────────────────────────────────

export interface Assertion {
  credentialId: string;
  /** base64 */
  authenticatorData: string;
  /** base64 */
  clientDataJSON: string;
  /** base64 */
  signature: string;
  /** 도전값을 발급할 때 함께 받은 봉인 토큰 */
  challengeToken: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  credentialId?: string;
}

/**
 * 브라우저가 보낸 서명이 등록된 기기의 것인지 확인한다.
 *
 * 확인하는 것 다섯: 도전값이 우리가 낸 것인가, 출처가 우리 도메인인가, rpIdHash 가
 * 맞는가, 사용자 확인(UV) 플래그가 켜졌는가 — Face ID 를 실제로 통과했다는 뜻이다 —
 * 그리고 서명이 등록된 공개키로 열리는가.
 */
export async function verifyAssertion(input: Assertion): Promise<VerifyResult> {
  const expectedChallenge = readChallenge(input.challengeToken);
  if (!expectedChallenge) return { ok: false, reason: "인증 시간이 지났어요. 다시 시도해주세요." };

  const stored = (await listPasskeys()).find((row) => row.credentialId === input.credentialId);
  if (!stored) return { ok: false, reason: "등록되지 않은 기기예요." };

  const clientDataBytes = Buffer.from(input.clientDataJSON, "base64");
  let clientData: { type?: string; challenge?: string; origin?: string };
  try {
    clientData = JSON.parse(clientDataBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "인증 데이터를 읽지 못했어요." };
  }

  const { id: rpId, origin } = relyingParty();
  if (clientData.type !== "webauthn.get") return { ok: false, reason: "인증 종류가 올바르지 않아요." };
  if (clientData.challenge !== expectedChallenge) return { ok: false, reason: "도전값이 일치하지 않아요." };
  if (clientData.origin !== origin) return { ok: false, reason: "허용되지 않은 출처예요." };

  const authData = Buffer.from(input.authenticatorData, "base64");
  if (authData.length < 37) return { ok: false, reason: "인증 데이터가 짧아요." };
  if (!authData.subarray(0, 32).equals(createHash("sha256").update(rpId).digest())) {
    return { ok: false, reason: "도메인이 일치하지 않아요." };
  }
  const flags = authData[32];
  if ((flags & 0x01) === 0) return { ok: false, reason: "기기에서 확인되지 않았어요." };
  // UV = 생체·PIN 을 실제로 통과했다는 표시. 이게 꺼져 있으면 잠긴 폰을 주운
  // 사람도 통과한다 — 승인 화면에서는 이 비트가 요점이다.
  if ((flags & 0x04) === 0) return { ok: false, reason: "Face ID 확인이 필요해요." };

  const signCount = authData.readUInt32BE(33);
  // 인증기가 세는 값이 뒤로 갔다 = 복제 의심. 둘 다 0 이면 세지 않는 기기다(애플).
  if (signCount !== 0 && stored.signCount !== 0 && signCount <= stored.signCount) {
    return { ok: false, reason: "인증 기록이 어긋나요. 관리자 키로 다시 등록해주세요." };
  }

  const signedData = Buffer.concat([authData, createHash("sha256").update(clientDataBytes).digest()]);
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(stored.publicKey, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return { ok: false, reason: "등록된 공개키를 읽지 못했어요." };
  }

  // ES256(-7) 은 P-256 + SHA-256, RS256(-257) 은 RSA + SHA-256.
  // WebAuthn 의 ECDSA 서명은 DER 로 온다.
  const ok = verifySignature(
    "sha256",
    signedData,
    { key: publicKey, dsaEncoding: "der" },
    Buffer.from(input.signature, "base64")
  );
  if (!ok) return { ok: false, reason: "서명을 확인하지 못했어요." };

  await touchPasskey(stored.credentialId, signCount);
  return { ok: true, credentialId: stored.credentialId };
}

/** 등록 요청이 우리가 낸 도전값에 답한 것인가. 공개키 자체는 브라우저가 준다. */
export function checkRegistrationChallenge(
  challengeToken: string,
  clientDataJSON: string
): string | null {
  const expected = readChallenge(challengeToken);
  if (!expected) return "등록 시간이 지났어요. 다시 시도해주세요.";
  let clientData: { type?: string; challenge?: string; origin?: string };
  try {
    clientData = JSON.parse(Buffer.from(clientDataJSON, "base64").toString("utf8"));
  } catch {
    return "등록 데이터를 읽지 못했어요.";
  }
  if (clientData.type !== "webauthn.create") return "등록 종류가 올바르지 않아요.";
  if (clientData.challenge !== expected) return "도전값이 일치하지 않아요.";
  if (clientData.origin !== relyingParty().origin) return "허용되지 않은 출처예요.";
  return null;
}
