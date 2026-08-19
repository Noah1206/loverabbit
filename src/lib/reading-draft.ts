"use client";

// 사주 입력 초안 — 폼(/reading), 로그인 복귀, 생성 대기 화면(/reading/generating)이 함께 쓴다.
// sessionStorage에 두어 탭을 닫으면 사라지고, 2시간이 지난 초안은 무효로 본다.

import { PRODUCTS } from "@/lib/products";

export interface PersonForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  gender: string;
}

export interface ReadingDraft {
  category: string;
  offerId?: string;
  me: PersonForm;
  partner: PersonForm;
  withPartner: boolean;
  createdAt: number;
}

export const emptyPerson: PersonForm = { year: "", month: "", day: "", hour: "unknown", gender: "F" };

const KEY = "loverabbit_reading_draft_v1";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function parsePerson(p: PersonForm) {
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour: p.hour === "unknown" ? null : parseInt(p.hour, 10),
    gender: p.gender,
  };
}

export function saveReadingDraft(draft: ReadingDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 저장이 막힌 브라우저에서도 로그인 창 자체는 정상적으로 열리게 둔다.
  }
}

export function clearReadingDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 이미 제거됐거나 스토리지를 사용할 수 없으면 무시한다.
  }
}

function readDraft(): ReadingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ReadingDraft;
    if (
      !PRODUCTS.some((item) => item.id === draft?.category) ||
      !draft.me ||
      !draft.partner ||
      !Number.isFinite(draft.createdAt) ||
      Date.now() - draft.createdAt > MAX_AGE_MS
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** 초안을 남겨둔 채로 읽는다 (폼 복원·이동 판단용). */
export function peekReadingDraft(): ReadingDraft | null {
  const draft = readDraft();
  if (!draft) clearReadingDraft();
  return draft;
}

/** 초안을 읽고 즉시 비운다. 생성 화면이 한 번만 소비하도록 해 재시도 루프를 막는다. */
export function takeReadingDraft(): ReadingDraft | null {
  const draft = readDraft();
  clearReadingDraft();
  return draft;
}
