"use client";

// 간편 회원 — 이메일만으로 3초 가입. 서버가 서명한 토큰을 기기(localStorage)에 보관한다.
// 결제 요청에 이 토큰이 붙어 서버 로그에 이메일이 남는다 (입금 대조·CRM의 시작점).
// ⚠️ 비밀번호·DB 없는 MVP 방식 — 스케일업 시 Clerk/NextAuth + DB로 교체.

export interface User {
  token: string;
  email: string;
  authProvider?: "google" | "kakao" | "x";
  referralCode?: string;
  referralClaimed?: boolean;
}

const KEY = "loverabbit_user_v1";

export function getUser(): User | null {
  try {
    const u = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return u?.token && u?.email ? u : null;
  } catch {
    return null;
  }
}

/**
 * 로그인 정보를 기기에 남긴다. 실패하면 false — 던지지 않는다.
 *
 * 프라이빗 모드나 저장이 막힌 브라우저에서 setItem 은 예외를 던진다. 예전에는
 * 그 예외가 로그인 완료 화면의 catch 까지 올라가 **성공한 로그인이 "실패"로
 * 표시**됐다. 다시 시도해도 같은 자리에서 또 걸리니 빠져나갈 수가 없었다.
 *
 * 저장에 실패해도 이번 세션은 살아 있다 — 부르는 쪽이 그 사실을 안내하도록
 * 결과만 돌려준다.
 */
export function saveUser(u: User): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
    return true;
  } catch {
    return false;
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지우지 못해도 할 수 있는 일이 없다. 로그아웃 자체를 막지는 않는다.
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearUser();
  }
}
