import { NextRequest, NextResponse } from "next/server";
import { getReading, markUnlocked } from "@/lib/store";
import { open } from "@/lib/crypto";
import { createOrder, isDatabaseConfigured } from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

// 풀 리딩 해금 — 결제 방식 2가지:
// 1) transfer: 계좌이체. 입금코드를 기록해 두고 즉시 해금 → 운영자가 통장 내역과 사후 대조.
//    (초기 소액 운영용 신뢰 기반. 미입금이 늘면 오픈뱅킹 입금확인 API나 PG로 전환할 것.)
// 2) toss-pg: TOSS_SECRET_KEY가 있으면 토스페이먼츠 결제 승인 API로 실결제 검증.
// 3) mock: 키·방식 지정 없을 때 개발용 모의결제.
//
// 리딩 원문은 Supabase에서 읽고, 클라이언트의 암호화 blob은 이전 리딩 호환용으로만 복원한다.

interface Body {
  readingId: string;
  blob?: string;
  method?: "transfer" | "toss-pg";
  userToken?: string; // 회원가입 토큰 — 유료 해금은 가입 필수
  depositorCode?: string;
  paymentKey?: string;
  orderId?: string;
  amount?: number;
}

interface SealedReading {
  id: string;
  full: string;
  price: number;
  score?: number;
  scoreLabel?: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (process.env.NODE_ENV === "production" && !isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  let stored: Awaited<ReturnType<typeof getReading>> = null;
  try {
    stored = await getReading(body?.readingId ?? "");
  } catch (error) {
    console.error("리딩 조회 실패:", error);
    if (isDatabaseConfigured()) {
      return NextResponse.json({ error: "리딩 DB를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
  }
  const sealed = body.blob ? open<SealedReading>(body.blob) : null;

  // blob 위조 방지: 복호화 성공 + readingId 일치까지 확인
  const fromBlob = sealed && sealed.id === body.readingId ? sealed : null;
  const full = stored?.full ?? fromBlob?.full;
  const price = stored?.price ?? fromBlob?.price;
  const score = stored?.score ?? fromBlob?.score;
  const scoreLabel = stored?.scoreLabel ?? fromBlob?.scoreLabel ?? null;

  if (!full || !price) {
    return NextResponse.json({ error: "리딩을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 해금된 리딩은 재결제 없이 반환 (새로고침 대응)
  if (stored?.unlocked) {
    return NextResponse.json({ full, score, scoreLabel });
  }

  const now = new Date().toISOString();

  // ── 계좌이체 ──
  if (body.method === "transfer") {
    let user;
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("결제 회원 확인 실패:", error);
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    if (!user) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    const expectedCode = `레빗-${body.readingId.slice(0, 4).toUpperCase()}`;
    if (body.depositorCode !== expectedCode) {
      return NextResponse.json({ error: "입금코드가 올바르지 않습니다." }, { status: 400 });
    }
    if (isDatabaseConfigured() && !user.userId) {
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 다시 가입해주세요." }, { status: 503 });
    }
    try {
      if (user.userId) {
        await createOrder({
          userId: user.userId,
          readingId: body.readingId,
          kind: "reading",
          method: "transfer",
          status: "pending",
          amount: price,
          depositorCode: body.depositorCode,
        });
      }
      const unlocked = await markUnlocked(
        body.readingId,
        { method: "transfer", depositorCode: body.depositorCode, at: now },
        user.userId
      );
      if (isDatabaseConfigured() && !unlocked) throw new Error("DB에서 리딩을 찾을 수 없습니다.");
    } catch (error) {
      console.error("계좌이체 주문 저장 실패:", error);
      return NextResponse.json({ error: "결제 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    console.log(`[결제:계좌이체] userId=${user.userId ?? "local"} reading=${body.readingId} amount=${price}`);
    return NextResponse.json({ full, score, scoreLabel, method: "transfer" });
  }

  // ── 토스페이먼츠 PG ──
  if (body.method === "toss-pg") {
    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "토스페이먼츠 설정이 완료되지 않았습니다." }, { status: 503 });
    }
    let user;
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("PG 결제 회원 확인 실패:", error);
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    if (!user) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    if (!body.paymentKey || !body.orderId || body.amount !== price) {
      return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });
    }
    if (isDatabaseConfigured() && !user.userId) {
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 다시 가입해주세요." }, { status: 503 });
    }
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        amount: price, // 클라이언트 금액이 아닌 서버 확인 금액으로 승인
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: `결제 승인 실패: ${err?.message ?? res.status}` },
        { status: 402 }
      );
    }
    try {
      if (user.userId) {
        await createOrder({
          userId: user.userId,
          readingId: body.readingId,
          kind: "reading",
          method: "toss-pg",
          status: "paid",
          amount: price,
          providerOrderId: body.orderId,
        });
      }
      const unlocked = await markUnlocked(body.readingId, { method: "toss-pg", at: now }, user.userId);
      if (isDatabaseConfigured() && !unlocked) throw new Error("DB에서 리딩을 찾을 수 없습니다.");
    } catch (error) {
      console.error("PG 승인 결과 저장 실패:", error);
      return NextResponse.json(
        { error: "결제는 승인됐지만 결과 저장에 실패했습니다. 주문번호로 고객센터에 문의해주세요.", orderId: body.orderId },
        { status: 503 }
      );
    }
    console.log(`[결제:토스PG] userId=${user.userId ?? "local"} reading=${body.readingId} orderId=${body.orderId}`);
    return NextResponse.json({ full, score, scoreLabel, method: "toss-pg" });
  }

  // ── 개발용 모의결제 ──
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "결제 방식을 확인할 수 없습니다." }, { status: 400 });
  }
  await markUnlocked(body.readingId, { method: "mock", at: now });
  return NextResponse.json({ full, score, scoreLabel, method: "mock", mock: true });
}
