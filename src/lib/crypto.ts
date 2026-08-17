// 풀 리딩 봉인 토큰 — AES-256-GCM.
import "server-only";

// DB 장애·이전 리딩 호환을 위해 풀 리딩 사본을 서버 키로 암호화해 클라이언트에도 맡긴다.
// 결제 확인 시 서버만 열 수 있으며, 클라이언트는 키가 없어 내용을 볼 수 없고 변조 시 복호화가 실패한다.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.READING_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("운영 환경에는 READING_SECRET이 필요합니다.");
  }
  return createHash("sha256").update(secret ?? "dev-secret-change-me").digest();
}

export function seal(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function open<T>(token: string): T | null {
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
