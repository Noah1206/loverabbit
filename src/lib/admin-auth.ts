import "server-only";

import { timingSafeEqual } from "crypto";

export function isAdminApprovalConfigured(): boolean {
  return Boolean(process.env.ADMIN_APPROVAL_KEY && process.env.ADMIN_APPROVAL_KEY.length >= 16);
}

export function verifyAdminApprovalKey(value?: string | null): boolean {
  const expected = process.env.ADMIN_APPROVAL_KEY;
  if (!expected || expected.length < 16 || !value) return false;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function adminKeyFromAuthorization(header?: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}
