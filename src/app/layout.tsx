import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import FunnelTracker from "@/components/FunnelTracker";
import "./globals.css";
import AttributionCapture from "@/components/AttributionCapture";
import AuthCodeRescue from "@/components/AuthCodeRescue";
import BottomNav from "@/components/BottomNav";
import ConsentBanner from "@/components/ConsentBanner";
import MetaPixel from "@/components/MetaPixel";
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
  metadataBase: new URL(SITE_URL),
  title: "러브레빗 LoveRabbit — 속궁합·연애운 AI 사주",
  description:
    "마음과 인연의 흐름을 섬세하게 풀어보는 속궁합·연애운 리딩. 3분이면 확인할 수 있어요.",
  openGraph: {
    title: "러브레빗 — 마음과 인연을 읽다 🐰",
    description: "속궁합·재회·연애운을 3분 만에 섬세하게 풀어보는 AI 사주 리딩.",
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Pretendard. globals.css 의 font-family 첫 자리에 오래 적혀 있었지만
          정작 불러온 적이 없어서, 윈도우에서는 내내 맑은고딕으로 떨어지고 있었다.
          긴 글을 읽히는 화면이라 글꼴 하나가 가독성을 가장 크게 바꾼다.

          dynamic-subset 은 한글 11,172자를 통째로 받지 않고 페이지에 실제로 쓰인
          글자만 조각으로 받는다. 한글 웹폰트는 이 방식이 아니면 첫 화면이 늦는다.
        */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Script id="loverabbit-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          <AttributionCapture />
          <FunnelTracker />
          <AuthCodeRescue />
          <div className="app-viewport">{children}</div>
          <BottomNav />
        </ThemeProvider>
        <ConsentBanner />
        <MetaPixel />
        <Analytics />
      </body>
    </html>
  );
}
