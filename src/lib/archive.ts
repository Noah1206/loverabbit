"use client";

// 내 상담 보관함 — 계정 없이 localStorage에 저장 (기기·브라우저 단위).
// blob(봉인 리딩)을 함께 보관하므로, 미해금 리딩은 보관함에서 나중에 해금할 수 있고
// 해금된 리딩은 추가 상담도 이어서 할 수 있다.

export interface ArchiveEntry {
  readingId: string;
  blob: string;
  category: string;
  label: string; // 상품명 (저장 시점의 표기)
  characterId: string;
  teaser: string;
  full: string | null; // 해금 후 채워짐
  chart: { me: string; partner: string | null };
  price: number;
  createdAt: number;
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
