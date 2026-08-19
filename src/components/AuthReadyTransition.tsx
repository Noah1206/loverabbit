"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";

const READY_DURATION_MS = 800;

export default function AuthReadyTransition({ href }: { href: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = window.setTimeout(() => router.push(href), READY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [href, router]);

  if (!mounted) return null;

  return createPortal(
    <div className="auth-ready-layer" role="status" aria-live="polite">
      <section className="card auth-card auth-ready-card">
        <div className="auth-rabbit" aria-hidden="true"><BrandMark size={44} /></div>
        <div className="auth-success">
          <span className="auth-success-check" aria-hidden="true">✓</span>
          <h1>준비 완료!</h1>
          <p>선택한 운명을 보러 이동하고 있어요.</p>
        </div>
      </section>
    </div>,
    document.body
  );
}
