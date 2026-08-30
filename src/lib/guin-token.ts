// 귀인 지도의 열쇠들 — 서버에서만 쓴다 (node:crypto).
//
// 공유 토큰: 주소에 실리는 값. 순번이면 /guin/1, /guin/2 를 돌며 남의 지도를
// 훑을 수 있어 무작위 24자로 만든다 (약 143비트).
//
// 소유·참여 키: 관리 권한의 정본. DB 에는 sha256 만 두고 원문은 발급 순간
// 응답으로 한 번 나간 뒤 브라우저 localStorage 에만 산다 — DB 가 새어도
// 남의 지도를 지울 수 있는 키는 나오지 않는다.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function newShareToken(): string {
  return randomBytes(18).toString("base64url"); // 24자
}

export function newSecretKey(): string {
  return randomBytes(24).toString("base64url"); // 32자
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** 키 검증 — 길이가 다르면 그 자체로 불일치라 바로 false. */
export function keyMatches(key: string | null | undefined, storedHash: string): boolean {
  if (!key) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 같은 사람의 중복 참여를 접는 지문 (지시문 10항).
 *
 * 서버 비밀(READING_SECRET)로 HMAC 한다 — 생년월일 평문을 지문으로 쓰지
 * 않는다. 별명까지 넣는 이유: 생일만으로 접으면 생일이 같은 두 친구(쌍둥이
 * 포함)를 한 사람으로 오인해 두 번째 친구의 참여를 막는다.
 */
export function participantFingerprint(mapId: string, birthdate: string, nickname: string): string {
  const secret = process.env.READING_SECRET ?? "dev-secret";
  return createHmac("sha256", secret)
    .update(`${mapId}:${birthdate}:${nickname.trim()}`, "utf8")
    .digest("hex");
}
