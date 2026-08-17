import "server-only";

import { open } from "@/lib/crypto";
import { isActiveMembership, upsertDatabaseUser } from "@/lib/database";

export interface UserToken {
  type: "user";
  email: string;
  birthdate: string;
  iat: number;
  userId?: number;
}

export interface MembershipToken {
  type: "membership";
  exp: number;
  userId?: number;
  membershipId?: number;
}

export function openUserToken(raw?: string): UserToken | null {
  const token = raw ? open<UserToken>(raw) : null;
  if (
    token?.type !== "user" ||
    !token.email ||
    !token.birthdate ||
    !Number.isFinite(token.iat)
  ) {
    return null;
  }
  return { ...token, email: token.email.trim().toLowerCase() };
}

export async function resolveUserToken(raw?: string): Promise<UserToken | null> {
  const token = openUserToken(raw);
  if (!token) return null;
  if (token.userId) return token;

  const user = await upsertDatabaseUser({
    email: token.email,
    birthdate: token.birthdate,
  });
  return user ? { ...token, userId: user.id } : token;
}

export function openMembershipToken(raw?: string): MembershipToken | null {
  const token = raw ? open<MembershipToken>(raw) : null;
  if (token?.type !== "membership" || !Number.isFinite(token.exp)) return null;
  return token;
}

export async function validateMembershipToken(raw?: string): Promise<MembershipToken | null> {
  const token = openMembershipToken(raw);
  if (!token || token.exp <= Date.now()) return null;

  // 배포 전 발급된 레거시 토큰은 서명과 만료 시각으로 계속 인정한다.
  if (!token.userId || !token.membershipId) return token;
  const active = await isActiveMembership({
    membershipId: token.membershipId,
    userId: token.userId,
  });
  return active ? token : null;
}
