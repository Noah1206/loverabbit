import type { Metadata } from "next";
import AppHome from "@/components/AppHome";

export const metadata: Metadata = {
  title: "러브레빗 — 테마 설정",
  robots: { index: false, follow: false }, // 이전 다크 시안 주소 호환용
};

export default function DarkHome() {
  return <AppHome />;
}
