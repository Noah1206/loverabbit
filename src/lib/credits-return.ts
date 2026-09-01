"use client";

// 러빗 충전을 떠난 자리. 충전이 끝나면 여기로 되돌려 보낸다.
// 포트원 결제창을 다녀와도 같은 탭이면 sessionStorage 가 살아 있다 —
// auth-return.ts 와 같은 이유, 같은 모양이다.

const KEY = "loverabbit_credits_next_v1";

function sanitize(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function rememberCreditsReturn(path: string | null | undefined): void {
  const safe = sanitize(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
  } catch {
    // 프라이빗 모드 등 — 못 남기면 수동 복귀(내 사주함)로 간다
  }
}

export function peekCreditsReturn(): string | null {
  try {
    return sanitize(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
