import type { Metadata } from "next";

// 검수 중이라 색인에서 뺀다 (2026-09-01).
//
// 루트 레이아웃이 index: true 를 켜 두므로, 여기서 덮지 않으면 준비도 안 된
// 화면이 검색에 걸린다. 운영 키로 막아 둔 것과 별개의 문제다 — 검색 결과에
// 제목이 뜨는 것만으로 "이런 걸 만들고 있다"가 새어 나간다.
//
// 기능을 열 때 이 파일을 통째로 지운다.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
