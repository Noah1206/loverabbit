"use client";

export type ReferralRewardChoice = "chat_credits";

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
    if (referralReward !== "chat_credits") {
      return getPendingReferral();
    }
    const pending: PendingReferral = {
      referralCode,
      referralReward,
      referralReadingId: undefined,
      capturedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(pending));
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
      pending.referralReward !== "chat_credits" ||
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
