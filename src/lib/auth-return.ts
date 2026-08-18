"use client";

// 로그인 팝업을 연 시점의 "돌아갈 경로"를 브라우저 탭에 보관한다.
// OAuth redirect_to 쿼리에 복잡한 경로(?c=... 같은 쿼리 포함)를 실으면
// Supabase 허용 목록 매칭에 실패해 Site URL(홈)로 폴백하기 때문에,
// 정확한 복귀 경로는 sessionStorage로 나르고 redirect_to에는 단순 경로만 남긴다.

const KEY = "loverabbit_auth_return_v1";

function sanitize(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export function rememberAuthReturn(path: string): void {
  const safe = sanitize(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe);
  } catch {
    // 프라이빗 모드 등 저장 실패 시에는 next 쿼리 폴백을 쓴다
  }
}

export function peekAuthReturn(): string | null {
  try {
    return sanitize(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function takeAuthReturn(): string | null {
  const stored = peekAuthReturn();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
  return stored;
}
