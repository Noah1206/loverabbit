import type { Metadata } from "next";
import Link from "next/link";

import InviteTracker from "@/components/InviteTracker";
import { PRODUCT_MAP } from "@/lib/products";

/*
  "그 사람에게 보내기"가 닿는 자리 (2026-09-04).

  궁합·재회 리딩의 절반은 상대 이야기다 — 그 상대가 이 링크를 받는다.
  리딩 내용은 한 글자도 싣지 않는다: 명리 주장은 규칙 표를 거친 리딩 안에만
  산다. 여기는 "당신 이야기가 절반"이라는 사실과 시작하는 길만 있다.

  ref 쿼리는 보낸 사람의 초대 코드다. CTA 가 /reading 으로 넘기면
  captureReferralFromLocation 이 집어 간다 — 가입하면 보낸 사람에게 보상이
  간다(기존 추천인 파이프라인 그대로).
*/

export const metadata: Metadata = {
  title: "당신 이야기가 절반이에요 — 러브레빗",
  description: "당신과의 사주 리딩을 본 사람이 있어요. 그 리딩의 절반은 당신 이야기예요.",
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const product = params.c ? PRODUCT_MAP[params.c] : undefined;
  const label = product?.badge ?? "사주";
  const ref = /^[A-Z0-9]{6,16}$/.test(params.ref ?? "") ? params.ref : undefined;

  const cta = new URLSearchParams();
  if (product) cta.set("c", product.id);
  if (ref) {
    cta.set("ref", ref);
    cta.set("reward", "chat_credits");
  }

  return (
    <main className="guide invite">
      <InviteTracker product={product?.id} />
      <section className="guide-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guide-rabbit anim-float" src="/assets/today/rabbit-hello-hanbok.webp" alt="" width={180} height={180} />
        <p className="guide-eyebrow">L O V E R A B B I T</p>
        <h1 className="guide-h1">
          당신과의 {label}을
          <br />
          <em>본 사람</em>이 있어요
        </h1>
        <p className="guide-sub">
          이 링크를 보낸 사람은 당신의 생년월일로 {label} 리딩을 봤어요.
          그 리딩의 절반은 <strong>당신 이야기</strong>예요 — 당신이 이 관계에서
          어떤 사람인지, 어떤 마음으로 움직이는지.
        </p>
      </section>

      <section className="guide-section">
        <h2 className="guide-h2">당신 쪽에서 보면 어떨까요?</h2>
        <p className="guide-accent-line">이번엔 당신이 중심인 리딩</p>
        <p className="guide-body">
          같은 두 사람이라도 누구 명식을 중심에 두느냐에 따라 보이는 게 달라요.
          당신의 생년월일로 세우면, 그 사람이 당신에게 어떤 기운인지가 보여요.
        </p>
        <div className="guide-card">
          <p className="guide-card-label">지금 시작하면</p>
          <ul>
            <li>가입 선물 — 3,000원 환영 쿠폰</li>
            <li>생년월일 하나면 3분 안에 나와요</li>
          </ul>
        </div>
      </section>

      <section className="guide-cta">
        <Link href={`/reading${cta.size ? `?${cta.toString()}` : ""}`} className="guide-cta-btn">
          내 쪽에서 보기 →
        </Link>
        <Link href="/" className="guide-cta-sub">
          러브레빗 둘러보기
        </Link>
      </section>
    </main>
  );
}
