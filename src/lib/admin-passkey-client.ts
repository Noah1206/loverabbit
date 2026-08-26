/*
  브라우저 쪽 패스키 절차. 서버는 admin-passkey.ts 가 받는다.

  아이폰에서 Face ID 가 실제로 뜨려면 세 가지가 맞아야 한다.
    · HTTPS 이고 rpId 가 그 도메인일 것 — localhost 에서는 등록만 되고 실사용은 안 된다
    · userVerification: "required" — 이게 없으면 생체 없이 통과할 수 있다
    · 사용자의 손짓 안에서 부를 것 — 버튼 클릭 핸들러 안이어야 한다
*/

// ArrayBuffer 로 돌려준다. Uint8Array 를 그대로 넘기면 SharedArrayBuffer 가
// 섞일 수 있다는 이유로 BufferSource 에 안 맞는다.
const toBytes = (base64url: string): ArrayBuffer => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const toBase64Url = (buffer: ArrayBuffer): string =>
  toBase64(buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function passkeySupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}

interface ChallengeReply {
  challenge: string;
  challengeToken: string;
  rpId: string;
  registered: { credentialId: string; label: string | null }[];
  error?: string;
}

async function getChallenge(): Promise<ChallengeReply> {
  const response = await fetch("/api/admin/passkey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "challenge" }),
  });
  const data = (await response.json()) as ChallengeReply;
  if (!response.ok) throw new Error(data.error ?? "인증을 시작하지 못했어요.");
  return data;
}

/** Face ID 로 열고, 12시간짜리 표를 받아 온다. */
export async function unlockWithPasskey(): Promise<string> {
  const { challenge, challengeToken, rpId, registered } = await getChallenge();
  if (registered.length === 0) {
    throw new Error("등록된 기기가 없어요. 관리자 키로 먼저 이 기기를 등록해주세요.");
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: toBytes(challenge),
      rpId,
      allowCredentials: registered.map((key) => ({
        type: "public-key" as const,
        id: toBytes(key.credentialId),
      })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("인증이 취소됐어요.");

  const assertion = credential.response as AuthenticatorAssertionResponse;
  const response = await fetch("/api/admin/passkey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verify",
      challengeToken,
      credentialId: toBase64Url(credential.rawId),
      authenticatorData: toBase64(assertion.authenticatorData),
      clientDataJSON: toBase64(assertion.clientDataJSON),
      signature: toBase64(assertion.signature),
    }),
  });
  const data = (await response.json()) as { token?: string; error?: string };
  if (!response.ok || !data.token) throw new Error(data.error ?? "인증에 실패했어요.");
  return data.token;
}

/** 이 기기를 등록한다. 관리자 키가 있어야 한다. */
export async function registerPasskey(adminKey: string, label: string): Promise<void> {
  const { challenge, challengeToken, rpId } = await getChallenge();

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toBytes(challenge),
      rp: { id: rpId, name: "러브레빗 관리자" },
      // 계정이 하나뿐이라 id 는 고정값이면 된다. 같은 값으로 다시 등록하면
      // 기기가 기존 패스키를 덮어써, 같은 폰에 여러 개가 쌓이지 않는다.
      user: {
        id: new TextEncoder().encode("loverabbit-admin").buffer as ArrayBuffer,
        name: "러브레빗 관리자",
        displayName: "러브레빗 관리자",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        // 폰 자체의 잠금(Face ID)만 받는다. 보안키를 꽂으라고 하지 않는다.
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("등록이 취소됐어요.");

  const attestation = credential.response as AuthenticatorAttestationResponse;
  const publicKey = attestation.getPublicKey?.();
  if (!publicKey) {
    throw new Error("이 브라우저는 패스키 등록을 지원하지 않아요. (iOS 16 이상 필요)");
  }

  const response = await fetch("/api/admin/passkey", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
    body: JSON.stringify({
      action: "register",
      challengeToken,
      label,
      credentialId: toBase64Url(credential.rawId),
      publicKey: toBase64(publicKey),
      algorithm: attestation.getPublicKeyAlgorithm?.() ?? -7,
      clientDataJSON: toBase64(attestation.clientDataJSON),
    }),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "기기를 등록하지 못했어요.");
}
