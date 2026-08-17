import { NextRequest, NextResponse } from "next/server";
import { getReading, markUnlocked } from "@/lib/store";
import { open } from "@/lib/crypto";

// 풀 리딩 해금 — 결제 방식 3가지:
// 1) transfer: 계좌이체. 입금코드를 기록해 두고 즉시 해금 → 운영자가 통장 내역과 사후 대조.
//    (초기 소액 운영용 신뢰 기반. 미입금이 늘면 오픈뱅킹 입금확인 API나 PG로 전환할 것.)
// 2) toss-pg: TOSS_SECRET_KEY가 있으면 토스페이먼츠 결제 승인 API로 실결제 검증.
// 3) mock: 키·방식 지정 없을 때 개발용 모의결제.
//
// 리딩 원문은 로컬에선 파일 저장소에서, 서버리스(Vercel)에선 클라이언트가 보관한
// 암호화 blob에서 복원한다. blob은 서버 키(READING_SECRET)로만 열린다.

interface Body {
  readingId: string;
  blob?: string;
  method?: "transfer" | "toss-pg" | "membership";
  membershipToken?: string;
  userToken?: string; // 회원가입 토큰 — 유료 해금은 가입 필수
  depositorCode?: string;
  paymentKey?: string;
  orderId?: string;
  amount?: number;
}

// 유료 결제(계좌이체·PG)는 회원가입이 선행돼야 한다 — 이메일이 결제 기록에 묶인다
function requireUser(userToken?: string): { email: string } | null {
  const u = userToken ? open<{ type: string; email: string }>(userToken) : null;
  return u?.type === "user" && u.email ? { email: u.email } : null;
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

  const stored = await getReading(body?.readingId ?? "").catch(() => null);
  const sealed = body.blob ? open<SealedReading>(body.blob) : null;

  // blob 위조 방지: 복호화 성공 + readingId 일치까지 확인
  const fromBlob = sealed && sealed.id === body.readingId ? sealed : null;
  const full = stored?.full ?? fromBlob?.full;
  const price = stored?.price ?? fromBlob?.price;
  const score = fromBlob?.score;
  const scoreLabel = fromBlob?.scoreLabel ?? null;

  if (!full || !price) {
    return NextResponse.json({ error: "리딩을 찾을 수 없습니다." }, { status: 404 });
  }

  // 이미 해금된 리딩은 재결제 없이 반환 (새로고침 대응)
  if (stored?.unlocked) {
    return NextResponse.json({ full, score, scoreLabel });
  }

  const now = new Date().toISOString();

  // ── 멤버십 (30일 무제한 토큰) ──
  if (body.method === "membership") {
    const m = body.membershipToken
      ? open<{ type: string; exp: number }>(body.membershipToken)
      : null;
    if (!m || m.type !== "membership") {
      return NextResponse.json({ error: "유효하지 않은 멤버십입니다." }, { status: 403 });
    }
    if (m.exp < Date.now()) {
      return NextResponse.json({ error: "멤버십이 만료되었습니다. 갱신해주세요." }, { status: 403 });
    }
    console.log(`[멤버십 사용] reading=${body.readingId} exp=${new Date(m.exp).toISOString()}`);
    await markUnlocked(body.readingId, { method: "membership", at: now }).catch(() => null);
    return NextResponse.json({ full, score, scoreLabel, method: "membership" });
  }

  // ── 계좌이체 ──
  if (body.method === "transfer") {
    const user = requireUser(body.userToken);
    if (!user) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    if (!body.depositorCode) {
      return NextResponse.json({ error: "입금코드가 없습니다." }, { status: 400 });
    }
    // 서버리스에서는 파일 기록 대신 로그로 남는다 (Vercel 대시보드 → Logs에서 입금코드 대조)
    console.log(`[결제:계좌이체] user=${user.email} reading=${body.readingId} code=${body.depositorCode} amount=${price} at=${now}`);
    await markUnlocked(body.readingId, {
      method: "transfer",
      depositorCode: body.depositorCode,
      at: now,
    }).catch(() => null);
    return NextResponse.json({ full, score, scoreLabel, method: "transfer" });
  }

  // ── 토스페이먼츠 PG ──
  const secret = process.env.TOSS_SECRET_KEY;
  if (secret && body.paymentKey) {
    if (!requireUser(body.userToken)) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    if (!body.orderId || body.amount !== price) {
      return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });
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
    console.log(`[결제:토스PG] reading=${body.readingId} paymentKey=${body.paymentKey} at=${now}`);
    await markUnlocked(body.readingId, { method: "toss-pg", at: now }).catch(() => null);
    return NextResponse.json({ full, score, scoreLabel, method: "toss-pg" });
  }

  // ── 개발용 모의결제 ──
  await markUnlocked(body.readingId, { method: "mock", at: now }).catch(() => null);
  return NextResponse.json({ full, score, scoreLabel, method: "mock", mock: true });
}
