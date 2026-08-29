"use client";

/**
 * 초대 링크의 보상 값.
 *
 * 캐릭터챗 시절 이름이 그대로 남았다 — lr_referrals.reward_type 체크 제약과,
 * 그 행이 생길 때 5,000원 쿠폰을 발행하는 트리거가 이 문자열에 걸려 있다.
 * 이름을 바꾸려면 마이그레이션이 먼저다. 사용자가 받는 것은 쿠폰이다.
 */
export const REFERRAL_REWARD_PARAM = "chat_credits";

export type ReferralRewardChoice = typeof REFERRAL_REWARD_PARAM;

export interface PendingReferral {
  referralCode: string;
  referralReadingId?: string;
  referralReward: ReferralRewardChoice;
  capturedAt: number;
}

const KEY = "loverabbit_referral_v1";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function captureReferralFromLocation(): PendingReferral | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref")?.trim().toUpperCase() ?? "";
    const referralReward = params.get("reward") as ReferralRewardChoice | null;
    if (!/^[A-Z0-9]{6,16}$/.test(referralCode)) return getPendingReferral();
    if (referralReward !== REFERRAL_REWARD_PARAM) {
      return getPendingReferral();
    }
    const pending: PendingReferral = {
      referralCode,
      referralReward,
      referralReadingId: undefined,
      capturedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(pending));
    // 클릭 보상 — 초대인에게 5크레딧. 서버가 기기 쿠키로 한 번만 준다.
    // 실패해도 링크는 그대로 산다; 보상은 덤이지 관문이 아니다.
    fetch("/api/referral/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: referralCode }),
      keepalive: true,
    }).catch(() => {});
    return pending;
  } catch {
    return null;
  }
}

export function getPendingReferral(): PendingReferral | null {
  try {
    const pending = JSON.parse(localStorage.getItem(KEY) ?? "null") as PendingReferral | null;
    if (
      !pending?.referralCode ||
      pending.referralReward !== REFERRAL_REWARD_PARAM ||
      Date.now() - pending.capturedAt > MAX_AGE
    ) {
      localStorage.removeItem(KEY);
      return null;
    }
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  localStorage.removeItem(KEY);
}
