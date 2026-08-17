import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";

const themeInitScript = `
  (function () {
    try {
      var savedTheme = window.localStorage.getItem("loverabbit-theme");
      var theme = savedTheme === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://loverabbit-ai.vercel.app"),
  title: "러브레빗 LoveRabbit — 궁합·연애운 AI 사주",
  description:
    "마음과 인연의 흐름을 섬세하게 풀어보는 궁합·연애운 리딩. 3분이면 확인할 수 있어요.",
  openGraph: {
    title: "러브레빗 — 마음과 인연을 읽다 🐰",
    description: "궁합·재회·인연 타이밍을 3분 만에 섬세하게 풀어보는 AI 사주 리딩.",
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body>
        <Script id="loverabbit-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          <div className="app-viewport">
            {children}
            <footer className="app-footer">
              <p>러브레빗 LoveRabbit · AI 기반 연애·인연 리딩 서비스</p>
              <p>본 서비스의 리딩은 오락 목적이며 의학적·법률적 조언이 아닙니다.</p>
            </footer>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
