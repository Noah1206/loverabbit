"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { hasMarketingConsent, onConsentChange } from "@/lib/consent";
import { META_PIXEL_ID, trackPageView } from "@/lib/meta-events";

// Meta Pixel 로더 — 마케팅 쿠키에 동의한 뒤에만 스크립트를 주입한다.
// 동의 전에는 <script> 자체가 페이지에 들어가지 않는다.
export default function MetaPixel() {
  const [granted, setGranted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setGranted(hasMarketingConsent());
    return onConsentChange((state) => setGranted(state === "granted"));
  }, []);

  // SPA 라우팅에서도 화면 전환마다 PageView를 남긴다.
  useEffect(() => {
    if (!granted) return;
    trackPageView();
  }, [granted, pathname]);

  if (!META_PIXEL_ID || !granted) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
        t=b.createElement(e);t.async=!0;t.src=v;
        s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
        (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        // autoConfig=false — Meta의 '자동 고급 매칭'과 자동 이벤트 감지를 끈다.
        // 이게 켜져 있으면 Pixel이 페이지의 폼 필드를 긁어가는데, /reading 폼에는
        // 생년월일·성별 입력이 있어 그대로 두면 광고 플랫폼으로 넘어간다.
        // 이벤트는 전부 meta-events.ts에서 명시적으로만 보낸다.
        fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
        fbq('init', '${META_PIXEL_ID}');
      `}
    </Script>
  );
}
