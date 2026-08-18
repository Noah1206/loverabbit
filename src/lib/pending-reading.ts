"use client";

export interface PendingReadingResult {
  readingId: string;
  teaser: string;
  chart: { me: string; partner: string | null };
  price: number;
  blob: string;
  previewSections: { title: string; excerpt: string }[];
  lockedSectionTitles: string[];
  scoreLabel?: string | null;
  demo: boolean;
}

export interface PendingReading {
  source: "reading" | "archive";
  category: string;
  result: PendingReadingResult;
  createdAt: number;
}

const KEY = "loverabbit_pending_reading_v1";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function savePendingReading(value: PendingReading): void {
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function takePendingReading(): PendingReading | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const value = JSON.parse(raw) as PendingReading;
    if (
      !value?.result?.readingId ||
      !value.result.blob ||
      !Number.isFinite(value.createdAt) ||
      Date.now() - value.createdAt > MAX_AGE_MS
    ) {
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}
