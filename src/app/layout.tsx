import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AppFooter from "@/components/AppFooter";
import AuthCodeRescue from "@/components/AuthCodeRescue";
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
  metadataBase: new URL("https://www.loverebbit.xyz"),
  title: "러브레빗 LoveRabbit — 속궁합·연애운 AI 사주",
  description:
    "마음과 인연의 흐름을 섬세하게 풀어보는 속궁합·연애운 리딩. 3분이면 확인할 수 있어요.",
  openGraph: {
    title: "러브레빗 — 마음과 인연을 읽다 🐰",
    description: "속궁합·재회·인연 타이밍을 3분 만에 섬세하게 풀어보는 AI 사주 리딩.",
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
          <AuthCodeRescue />
          <div className="app-viewport">
            {children}
            <AppFooter />
          </div>
          <BottomNav />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
