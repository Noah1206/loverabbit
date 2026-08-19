"use client";

// 내 상담 보관함 — 계정 없이 localStorage에 저장 (기기·브라우저 단위).
// blob(봉인 리딩)을 함께 보관하므로, 미해금 리딩은 보관함에서 나중에 해금할 수 있고
// 해금된 리딩은 추가 상담도 이어서 할 수 있다.

import type { StructuredReport } from "@/lib/reading-prompt";

export interface ArchiveEntry {
  readingId: string;
  blob: string;
  category: string;
  offerId?: string;
  label: string; // 상품명 (저장 시점의 표기)
  characterId: string;
  teaser: string;
  full: string | null; // 해금 후 채워짐
  pendingOrderId?: number; // 계좌이체 승인 대기 중인 주문
  chart: { me: string; partner: string | null };
  price: number;
  createdAt: number;
  // 기사형 리포트(/reading/[id])에서 잠금 상태를 그대로 재현하기 위한 정보
  previewSections?: { title: string; excerpt: string }[];
  lockedSectionTitles?: string[];
  scoreLabel?: string | null;
  score?: number | null;
  /** 지수가 어느 구간인지 — 상품 meterLabels의 문구 */
  scoreBand?: string | null;
  /** 그 지수가 어디서 나왔는지. 해금 후에만 채워진다. */
  scoreFactors?: { label: string; delta: number; basis: string }[];
  /** 구조화 리포트 원본 — 근거와 주의점이 여기에 남는다. 해금 후에만 채워진다. */
  report?: StructuredReport | null;
  demo?: boolean;
  // 리포트 상단 요약 카드 — 결제 전에도 보여주는 무료 구조 정보
  summaryCards?: { label: string; value: string; detail: string }[];
  // 리포트 하단 고지 — 결과가 어떤 성격의 해석인지, 계산의 한계가 무엇인지
  disclaimer?: string;
  confidenceNote?: string;
}

const KEY = "loverabbit_archive_v1";
const MAX = 50;

export function listArchive(): ArchiveEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveToArchive(entry: ArchiveEntry): void {
  const list = [entry, ...listArchive().filter((e) => e.readingId !== entry.readingId)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function updateArchive(readingId: string, patch: Partial<ArchiveEntry>): void {
  const list = listArchive().map((e) => (e.readingId === readingId ? { ...e, ...patch } : e));
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeFromArchive(readingId: string): void {
  localStorage.setItem(KEY, JSON.stringify(listArchive().filter((e) => e.readingId !== readingId)));
}
