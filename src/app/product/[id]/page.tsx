import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/products";

// 상품 상세 판매 페이지 — "돈을 낼만한 이유"를 만드는 설득 구조:
// 후킹 질문 → ??% 게이지 → 비전(秘傳) 서사 → 대상 체크 → 풀이 원리 → 리포트 목차 → CTA

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = PRODUCT_MAP[id];
  return p ? { title: `${p.title} — ${p.headline}`, description: p.sub } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = PRODUCT_MAP[id];
  if (!p) notFound();

  const cta = `/reading?c=${p.id}`;

  return (
    <main className="product-page" data-product={p.id}>
      {/* ── 히어로 ── */}
      <section className="product-hero">
        <div aria-hidden className="product-hero-art" style={{ background: `linear-gradient(160deg, ${p.grad[0]}, ${p.grad[1]})` }}>
          <Image
            src={`/cards-pastel/${p.id}.jpg`}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            style={{ objectFit: "cover", objectPosition: "center 18%" }}
          />
        </div>
        <div aria-hidden className="product-hero-shade" />
        <div className="product-hero-copy">
          <span className="badge">{p.badge}</span>
          <h1 style={{ color: "#fff", fontSize: "1.7rem", lineHeight: 1.3, margin: "8px 0 6px" }}>{p.headline}</h1>
          <p style={{ color: "rgba(255,255,255,0.82)", fontSize: "0.9rem" }}>{p.sub}</p>
        </div>
      </section>

      <div style={{ padding: "20px 20px 0", display: "grid", gap: 26 }}>
        {/* ── ??% 게이지 ── */}
        <section className="card product-score-card">
          <p className="product-score-question">우리의 {p.scoreLabel}은?</p>
          <div className="product-score-result">
            <p>상위 <span>??</span>%</p>
            <span className="product-score-orb" aria-hidden>{p.emoji}</span>
          </div>
          <p className="product-score-caption">{p.gaugeCaption}</p>
          <div className="product-score-meter" aria-hidden><span /></div>
          <div className="product-score-labels">
            {p.meterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
            <strong aria-label="결과 미공개">?</strong>
          </div>
        </section>

        {/* ── 비전(秘傳) 서사 ── */}
        <section className="card product-story-card" style={{ position: "relative", overflow: "hidden" }}>
          <span aria-hidden style={{ position: "absolute", right: -6, top: -18, fontSize: "5.5rem", fontFamily: "serif", fontWeight: 900, color: "var(--accent)", opacity: 0.08 }}>秘傳</span>
          <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--gold)", letterSpacing: "0.1em", marginBottom: 6 }}>본 사주 분석의 뿌리</p>
          <strong style={{ fontSize: "1.05rem" }}>필사본으로만 전해진 연애 명리 비전, 「연담비결(戀談秘訣)」</strong>
          <ul style={{ margin: "10px 0 0 18px", display: "grid", gap: 6, fontSize: "0.88rem", color: "var(--text)" }}>
            <li>이름을 남기지 않은 한 명리가가 평생 연애 사주만 파고들어 남긴 필사본</li>
            <li>책으로 출간된 적 없이 필사로만 이어져 온 관계 풀이 원리</li>
            <li>그 풀이 체계를 현대 명리로 복원해, 당신의 명식에 그대로 적용합니다</li>
          </ul>
        </section>

        {/* ── 리포트 구성 ── */}
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>전체 리포트 구성</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12 }}>
            무료 미리보기 이후, {p.toc.length}개 섹션의 심층 리포트로 정리해드립니다
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.keywords.map((k) => (
              <span key={k} className="badge">{k}</span>
            ))}
          </div>
        </section>

        {/* ── 대상 ── */}
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>이 사주는 누가 보면 좋을까요?</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {p.audience.map((a) => (
              <div key={a} className="card" style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--accent)", fontWeight: 900 }}>✓</span>
                <span style={{ fontSize: "0.9rem" }}>{a}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 풀이 원리 ── */}
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>이런 원리로 풀이해요</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {p.principles.map(([t, d]) => (
              <div key={t} className="card" style={{ padding: "14px 16px" }}>
                <strong style={{ fontSize: "0.95rem" }}>{t}</strong>
                <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginTop: 4 }}>{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 목차 ── */}
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>이런 결과를 받아요</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: 12 }}>풀 리딩 리포트 목차</p>
          <div className="card" style={{ padding: "6px 0" }}>
            {p.toc.map((t, i) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "9px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "var(--accent)", fontSize: "0.8rem", minWidth: 22 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: "0.88rem" }}>{t}</span>
              </div>
            ))}
          </div>
        </section>

        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", textAlign: "center" }}>
          본 리딩은 오락 목적의 콘텐츠이며, 무료 미리보기 후 결제 여부를 결정할 수 있습니다.
        </p>
      </div>

      {/* ── 고정 CTA ── */}
      <div className="product-sticky-shell">
        <span className="product-sticky-hook">{p.emoji} {p.ctaHook}</span>
        <Link href={cta} className="product-sticky-cta">
          <span className="product-sticky-icon" aria-hidden>{p.emoji}</span>
          <span className="product-sticky-copy">
            <strong>{p.ctaLabel}</strong>
            <small>결과 일부 공개 · 전체 리포트는 확인 후 선택</small>
          </span>
          <span className="product-sticky-arrow" aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}
