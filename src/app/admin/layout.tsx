import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "결제 승인 관리 — LoveRabbit",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
