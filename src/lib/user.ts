"use client";

// 간편 회원 — 이메일만으로 3초 가입. 서버가 서명한 토큰을 기기(localStorage)에 보관한다.
// 결제 요청에 이 토큰이 붙어 서버 로그에 이메일이 남는다 (입금 대조·CRM의 시작점).
// ⚠️ 비밀번호·DB 없는 MVP 방식 — 스케일업 시 Clerk/NextAuth + DB로 교체.

export interface User {
  token: string;
  email: string;
  authProvider?: "google" | "kakao";
  referralCode?: string;
  chatCredits?: number;
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

export function saveUser(u: User): void {
  localStorage.setItem(KEY, JSON.stringify(u));
}

export function clearUser(): void {
  localStorage.removeItem(KEY);
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearUser();
  }
}
