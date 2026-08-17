"use client";

export type ReferralRewardChoice = "reading_unlock" | "chat_credits";

export interface PendingReferral {
  referralCode: string;
  referralReadingId?: string;
  referralReward: ReferralRewardChoice;
  capturedAt: number;
}

const KEY = "loverabbit_referral_v1";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function captureReferralFromLocation(): PendingReferral | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref")?.trim().toUpperCase() ?? "";
    const referralReward = params.get("reward") as ReferralRewardChoice | null;
    const referralReadingId = params.get("rid")?.trim() ?? undefined;
    if (!/^[A-Z0-9]{6,16}$/.test(referralCode)) return getPendingReferral();
    if (referralReward !== "reading_unlock" && referralReward !== "chat_credits") {
      return getPendingReferral();
    }
    if (referralReward === "reading_unlock" && (!referralReadingId || !UUID_RE.test(referralReadingId))) {
      return getPendingReferral();
    }
    const pending: PendingReferral = {
      referralCode,
      referralReward,
      referralReadingId: referralReward === "reading_unlock" ? referralReadingId : undefined,
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
      !pending.referralReward ||
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
