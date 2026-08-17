import "server-only";

import { open } from "@/lib/crypto";
import { upsertDatabaseUser } from "@/lib/database";

export interface UserToken {
  type: "user";
  email: string;
  birthdate: string;
  iat: number;
  userId?: number;
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
