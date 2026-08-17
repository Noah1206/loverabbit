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
  metadataBase: new URL("https://loverabbit-one.vercel.app"),
  title: "러브레빗 LoveRabbit — 19금 속궁합·연애운 AI 사주",
  description:
    "낮의 사주는 잊어라. 성인 전용, 솔직하다 못해 아찔한 속궁합·연애운 리딩. 3분이면 끝.",
  openGraph: {
    title: "러브레빗 — 밤의 사주는 다르다 🐰",
    description: "속궁합·재회·환승·밤 기질, 3분 만에 팩폭 리딩. 만 19세 이상.",
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
  other: {
    // 청소년유해매체물 자율 표시 (RTA 레이블)
    rating: "RTA-5042-1996-1400-1577-RTA",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body>
        <Script id="loverabbit-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>
          {/* 성인 확인은 입장 게이트 대신 회원가입 시 생년월일 검증으로 수행 (SignupModal + /api/signup) */}
          {children}
          <footer
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text-dim)",
              fontSize: "0.8rem",
              borderTop: "1px solid var(--line)",
              marginTop: 60,
            }}
          >
            <p>러브레빗 LoveRabbit · 만 19세 이상 전용 서비스</p>
            <p>본 서비스의 리딩은 오락 목적이며 의학적·법률적 조언이 아닙니다.</p>
          </footer>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
