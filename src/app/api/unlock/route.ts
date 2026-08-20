import { NextRequest, NextResponse } from "next/server";
import { getReading, markUnlocked } from "@/lib/store";
import { open } from "@/lib/crypto";
import type { StructuredReport } from "@/lib/reading-prompt";
import {
  createOrder,
  createPendingTransferOrder,
  getOrderByProviderOrderId,
  isDatabaseConfigured,
} from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";
import { finishReading } from "@/lib/reading-finish";

// 풀 리딩 해금 — 결제 방식 2가지:
// 1) transfer: 계좌이체 승인 요청만 저장. 관리자가 입금을 확인하고 승인해야 해금된다.
// 2) toss-pg: TOSS_SECRET_KEY가 있으면 토스페이먼츠 결제 승인 API로 실결제 검증.
// 3) mock: 키·방식 지정 없을 때 개발용 모의결제.
//
// 리딩 원문은 Supabase에서 읽고, 클라이언트의 암호화 blob은 이전 리딩 호환용으로만 복원한다.

interface Body {
  readingId: string;
  blob?: string;
  method?: "transfer" | "toss-pg" | "referral";
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
  /** 지수가 어느 구간인지 (상품의 meterLabels 문구) */
  scoreBand?: string | null;
  /** 그 지수가 어디서 나왔는지 — 해금 후 화면에 근거로 보여준다 */
  scoreFactors?: { label: string; delta: number; basis: string }[];
  /** 구조화 리포트 원본. 근거(facts_used)와 주의점이 여기에만 남아 있다. */
  report?: StructuredReport | null;
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
  // 구간과 근거는 DB에 두지 않고 봉인된 blob에만 있다
  const scoreBand = fromBlob?.scoreBand ?? null;
  const scoreFactors = fromBlob?.scoreFactors ?? [];
  const report = fromBlob?.report ?? null;

  if (!full || !price) {
    return NextResponse.json({ error: "리딩을 찾을 수 없습니다." }, { status: 404 });
  }

  /**
   * 권리가 확정된 뒤에 부르는 마무리.
   *
   * 유료 본문은 결제 전에 만들지 않는다(발급 때는 미리보기 몫만 만든다). 여기서
   * 나머지를 이어 만들고 전문을 DB에 쓴다. 이미 다 있거나 옛 리딩이면 그냥 지나간다.
   *
   * 실패하면 503을 내되 해금 상태는 그대로 둔다 — 다시 열면 "이미 해금됨" 경로로
   * 들어와 여기서 한 번 더 시도한다. 돈만 받고 끝나지 않게 하는 지점이다.
   */
  const deliver = async (extra: Record<string, unknown> = {}) => {
    let finished;
    try {
      finished = await finishReading({
        readingId: body.readingId,
        stored,
        partialReport: report,
        storedFull: full,
      });
    } catch (error) {
      console.error("리딩 완성 실패:", error);
      finished = null;
    }
    if (!finished || finished.incomplete) {
      return NextResponse.json(
        { error: "결제는 확인됐어요. 본문을 마저 준비하는 중이니 잠시 후 다시 열어주세요.", paid: true },
        { status: 503 }
      );
    }
    return NextResponse.json({
      full: finished.full,
      score,
      scoreLabel,
      scoreBand,
      scoreFactors,
      report: finished.report,
      ...extra,
    });
  };

  if (body.method === "referral") {
    return NextResponse.json(
      { error: "전문 무료 해금 이벤트는 종료됐어요. 결제 후 전문을 볼 수 있습니다." },
      { status: 410 }
    );
  }

  // 이미 해금된 리딩은 재결제 없이 반환 (새로고침 대응)
  if (stored?.unlocked) {
    let user;
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("해금 리딩 회원 확인 실패:", error);
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
    }
    if (!user?.userId || stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩을 볼 권한이 없어요." }, { status: 403 });
    }
    return deliver();
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
    if (!user?.userId) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    const expectedCode = `레빗-${body.readingId.slice(0, 4).toUpperCase()}`;
    if (body.depositorCode !== expectedCode) {
      return NextResponse.json({ error: "입금코드가 올바르지 않습니다." }, { status: 400 });
    }
    if (isDatabaseConfigured() && !user.userId) {
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요. 다시 가입해주세요." }, { status: 503 });
    }
    if (stored?.userId && stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩의 결제 권한을 확인할 수 없어요." }, { status: 403 });
    }
    try {
      const order = user.userId
        ? await createPendingTransferOrder({
            userId: user.userId,
            readingId: body.readingId,
            amount: price,
            depositorCode: body.depositorCode,
          })
        : null;
      if (!order) throw new Error("승인 대기 주문을 만들 수 없습니다.");
      console.log(
        `[결제승인대기:계좌이체] userId=${user.userId} reading=${body.readingId} order=${order.id} amount=${price}`
      );
      return NextResponse.json({
        orderId: order.id,
        readingId: order.readingId,
        status: order.status,
        method: "transfer",
      });
    } catch (error) {
      console.error("계좌이체 승인 요청 저장 실패:", error);
      return NextResponse.json(
        { error: "입금 확인 요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }
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
    if (!user?.userId) {
      return NextResponse.json({ error: "풀 리딩을 열려면 회원가입이 필요해요.", needSignup: true }, { status: 401 });
    }
    if (!body.paymentKey || !body.orderId || body.amount !== price) {
      return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });
    }
    if (stored?.userId && stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩의 결제 권한을 확인할 수 없어요." }, { status: 403 });
    }

    try {
      const order = await getOrderByProviderOrderId(body.orderId);
      if (
        isDatabaseConfigured() &&
        (!order ||
          order.userId !== user.userId ||
          order.readingId !== body.readingId ||
          order.amount !== price ||
          order.status !== "pending")
      ) {
        return NextResponse.json({ error: "서버에 기록된 결제 주문과 일치하지 않아요." }, { status: 400 });
      }
    } catch (error) {
      console.error("PG 결제 주문 검증 실패:", error);
      return NextResponse.json({ error: "결제 주문을 확인하지 못했어요." }, { status: 503 });
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
    return deliver({ method: "toss-pg" });
  }

  // ── 개발용 모의결제 ──
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "결제 방식을 확인할 수 없습니다." }, { status: 400 });
  }
  await markUnlocked(body.readingId, { method: "mock", at: now });
  return deliver({ method: "mock", mock: true });
}
