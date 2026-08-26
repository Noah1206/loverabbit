import "server-only";

import { timingSafeEqual } from "crypto";

import { verifySessionToken } from "@/lib/admin-passkey";

export function isAdminApprovalConfigured(): boolean {
  return Boolean(process.env.ADMIN_APPROVAL_KEY && process.env.ADMIN_APPROVAL_KEY.length >= 16);
}

/**
 * 관리자인가.
 *
 * 두 가지를 받는다 — 원래의 승인 키, 그리고 Face ID 를 통과하고 받은 표
 * (admin-passkey.ts). 호출부는 구분하지 않는다. 관문은 하나여야 하고, 관문이
 * 둘이면 한쪽에만 조건을 더하는 사고가 난다.
 */
export function verifyAdminApprovalKey(value?: string | null): boolean {
  if (!value) return false;

  const expected = process.env.ADMIN_APPROVAL_KEY;
  if (expected && expected.length >= 16) {
    const actualBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return true;
    }
  }

  return verifySessionToken(value);
}

export function adminKeyFromAuthorization(header?: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}
