import { NextRequest, NextResponse } from "next/server";
import { getReading, markReadingViewed, markUnlocked } from "@/lib/store";
import { open } from "@/lib/crypto";
import type { StructuredReport } from "@/lib/reading-prompt";
import {
  createOrder,
  createPendingTransferOrder,
  getOrderByProviderOrderId,
  getUsableCoupon,
  isDatabaseConfigured,
  issueBundleCoupons,
  reserveCoupon,
  settleCouponsForOrder,
} from "@/lib/database";
import { couponPrice, couponSaving } from "@/lib/coupons";
import { saleCreditCost } from "@/lib/credits";
import { InsufficientCreditsError, applyCredit, getCreditBalance, countOpenedReadings } from "@/lib/credits-db";
import { resolveUserToken } from "@/lib/tokens";
import { finishReading } from "@/lib/reading-finish";
import type { SealedScore } from "@/lib/saju-score";
import { normalizeAttribution } from "@/lib/attribution";
import { snapshotMetaMatch } from "@/lib/meta-capi";
import { notifyAdmin } from "@/lib/telegram";
import { finalizePortOnePayment } from "@/lib/portone-payment";
import { claimReadingForPayment } from "@/lib/reading-claim";
import { bundleOfReading, bundleRest } from "@/lib/bundles";
import { reviewOrderAndFollowUp } from "@/lib/order-review";
import { PortOnePaymentError } from "@/lib/portone-validation";

// 유료 본문을 여기서 만든다. 이 경로가 이 서비스에서 가장 오래 도는 자리다.
//
// 선언이 없어서 그동안 플랫폼 기본값에 기대고 있었다. /api/reading 에는 300 이
// 박혀 있는데 정작 더 무거운 쪽이 비어 있었다 - 게다가 슬림 무료 미리보기를 켠
// 뒤로는 결제 전에 한 절도 안 만들므로, 여기서 머리부터 전부 만든다.
//
// 여기서 시간이 끊기면 돈은 받고 글은 못 준 상태가 된다. 다시 열면 이어 만들지만,
// 그 사이의 화면은 사용자가 보기에 그냥 고장이다.
export const maxDuration = 300;

// 풀 리딩 해금 — 결제 방식 2가지:
// 1) transfer: 계좌이체 승인 요청만 저장. 관리자가 입금을 확인하고 승인해야 해금된다.
// 2) toss-pg: TOSS_SECRET_KEY가 있으면 토스페이먼츠 결제 승인 API로 실결제 검증.
// 3) mock: 키·방식 지정 없을 때 개발용 모의결제.
//
// 리딩 원문은 Supabase에서 읽고, 클라이언트의 암호화 blob은 이전 리딩 호환용으로만 복원한다.

interface Body {
  readingId: string;
  blob?: string;
  method?: "transfer" | "toss-pg" | "portone-pg" | "referral" | "credits";
  userToken?: string; // 회원가입 토큰 — 유료 해금은 가입 필수
  depositorCode?: string;
  paymentKey?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  /** 광고 유입 표시 (utm/fbclid). 주소에서 온 값이라 그대로 믿지 않는다. */
  attribution?: unknown;
  /** 마케팅 쿠키에 동의했는가. 동의는 기기에만 있어서 브라우저가 말해줘야 안다. */
  marketingConsent?: boolean;
  /** 결제창에서 고른 쿠폰 (계좌이체). 서버가 다시 확인하고 금액을 정한다. */
  couponId?: string;
}

interface SealedReading {
  id: string;
  full: string;
  price: number;
  /** 발급 시점에 봉인된 지수 한 덩어리 (DB에 같은 것이 있다 — 이건 사본) */
  scoreSeal?: SealedScore | null;
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
  // 어느 광고가 이 결제를 만들었는가. Meta 집계는 픽셀이 막히거나 동의를 안 받으면
  // 비므로, 실제로 판 소재를 아는 유일한 정본은 이 주문 기록이다.
  // normalizeAttribution 이 길이·제어문자·바깥 주소를 걸러 낸다.
  const attribution = normalizeAttribution(body.attribution);

  /*
    전환을 나중에 보내기 위해 지금을 떠 둔다.

    계좌이체는 승인이 몇 시간 뒤에 난다. 그때는 브라우저도, 쿠키도, IP 도 없다 —
    Meta 는 user_data 가 비면 이벤트를 받지 않으므로, 그 순간에 만들 수 있는
    전환은 애초에 없다. 그래서 사람이 화면 앞에 있는 지금 떠서 주문에 적어 둔다.

    동의도 지금 받아 적는다. 동의는 기기에만 있고 서버는 모른다. 승인 시점에
    물어볼 곳이 없으니, 물어볼 수 있을 때 물어 둔다 — 동의하지 않은 사람의
    전환은 나중에도 나가지 않는다.
  */
  const metaSnapshot = snapshotMetaMatch(req, attribution, body.marketingConsent === true);

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

  // 지수는 절대 다시 계산하지 않는다. 발급 때 봉인한 값을 그대로 읽는다.
  // 대운·세운이 섞인 값이라 지금 다시 돌리면 다른 숫자가 나오고, 그건 산 사람이
  // 산 리딩이 아니게 된다. DB의 봉인이 정본이고, 없으면(봉인 이전 리딩) 클라이언트
  // blob의 사본을, 그것도 없으면 DB에 따로 있던 숫자를 쓴다.
  const seal = stored?.scoreSeal ?? fromBlob?.scoreSeal ?? null;
  const score = seal?.value ?? stored?.score ?? fromBlob?.score;
  const scoreLabel = seal?.label ?? stored?.scoreLabel ?? fromBlob?.scoreLabel ?? null;
  const scoreBand = seal?.band ?? fromBlob?.scoreBand ?? null;
  const scoreFactors = seal?.factors ?? fromBlob?.scoreFactors ?? [];
  // 어느 운을 보고 낸 값인지. 화면에서 "발급 시점 기준"이라고 밝히는 근거가 된다.
  const scoreAsOf = seal ? { ...seal.asOf, issuedAt: seal.issuedAt } : null;
  const report = fromBlob?.report ?? null;

  /*
    없는 리딩과 아직 안 쓴 리딩은 다르다.

    결제 전에 만들지 않는 흐름(reading-gate.ts)에서는 발급 직후 full 이 빈
    문자열이다. 여기서 !full 로 걸러 버리면 그 리딩은 결제 자체를 시작할 수
    없다 — 만들어지지 않았으니 팔 수 없고, 팔리지 않으니 만들어지지 않는다.
    확인해야 할 것은 "글이 있는가" 가 아니라 "리딩을 찾았는가" 다.
  */
  if (typeof full !== "string" || !price) {
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
      return NextResponse.json(
        {
          error: "결제는 확인됐어요. 본문을 마저 준비하는 중이니 잠시 후 다시 열어주세요.",
          paid: true,
        },
        { status: 503 }
      );
    }
    if (finished.incomplete) {
      return NextResponse.json(
        {
          error: "결제는 확인됐어요. 본문을 마저 준비하는 중이니 잠시 후 다시 열어주세요.",
          paid: true,
        },
        { status: 503 }
      );
    }
    // 전문이 실제로 나가는 유일한 자리. 여기를 지나야 "돈 낸 사람이 물건을
    // 받아 갔다"고 말할 수 있다. 계좌이체는 승인이 몇 시간 뒤에 나므로 본문이
    // 완성된 시각과 읽은 시각이 다르고, 그 차이가 여기서만 드러난다.
    // await — void 로 던지면 응답 직후 함수가 얼어 기록이 유실된다.
    await markReadingViewed(body.readingId, { paid: true });

    return NextResponse.json({
      full: finished.full,
      score,
      scoreLabel,
      scoreBand,
      scoreFactors,
      scoreAsOf,
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

  // ── 크레딧 (2026-08-31, 기본 결제 수단) ──
  //
  // 잔액을 깎고 그 자리에서 연다. 이중 차감은 원장이 막는다 —
  // (reason, ref) unique 라 같은 리딩의 두 번째 차감은 지급 없이 현재 잔액만
  // 돌아온다. 그래서 더블클릭·새로고침이 두 번 깎지 못한다.
  if (body.method === "credits") {
    let user;
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("러빗 결제 회원 확인 실패:", error);
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
    }
    if (!user?.userId) {
      return NextResponse.json({ error: "리딩을 열려면 로그인이 필요해요.", needSignup: true }, { status: 401 });
    }
    if (stored?.userId && stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩의 결제 권한을 확인할 수 없어요." }, { status: 403 });
    }
    {
      const claim = await claimReadingForPayment(stored, user.userId);
      if (claim) return NextResponse.json({ error: claim.error }, { status: claim.status });
    }

    // 세트 리딩은 세트 값을 깎고, 나머지 장을 여는 0원 쿠폰이 나간다 —
    // 계좌이체 시절의 세트 흐름 그대로다.
    const bundle = bundleOfReading(stored?.category ?? "", price);
    // 단품 값은 지금까지 열어본 장수에 따라 오른다 (2·4·10러빗). 세는 것은
    // 원장이고, 깎기 직전에 센다 — 화면이 뭐라 적었든 여기가 정본이다.
    const openedCount = bundle ? 0 : await countOpenedReadings(user.userId);
    const cost = saleCreditCost(Boolean(bundle), openedCount);

    try {
      const balance = await getCreditBalance(user.userId);
      if (balance < cost) {
        return NextResponse.json(
          { error: `러빗이 ${cost - balance}만큼 모자라요.`, needCredits: true, balance, cost },
          { status: 402 }
        );
      }
      await applyCredit(user.userId, -cost, "reading", body.readingId);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        const balance = await getCreditBalance(user.userId).catch(() => 0);
        return NextResponse.json(
          { error: "러빗이 모자라요.", needCredits: true, balance, cost },
          { status: 402 }
        );
      }
      console.error("리딩 러빗 차감 실패:", error);
      return NextResponse.json({ error: "러빗을 쓰지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }

    try {
      const unlocked = await markUnlocked(body.readingId, { method: "credits", at: now }, user.userId);
      if (isDatabaseConfigured() && !unlocked) throw new Error("DB에서 리딩을 찾을 수 없습니다.");
      if (bundle) await issueBundleCoupons(user.userId, bundleRest(bundle).length);
    } catch (error) {
      // 깎였는데 못 열었다 — 되돌리고 사정을 말한다. 되돌리기도 실패하면
      // 원장에 reading 만 남아 운영자가 찾을 수 있다.
      console.error("러빗 해금 저장 실패:", error);
      await applyCredit(user.userId, cost, "refund", body.readingId).catch(() => {});
      return NextResponse.json({ error: "결제를 저장하지 못했어요. 러빗은 돌려드렸어요." }, { status: 503 });
    }
    console.log(`[결제:러빗] userId=${user.userId} reading=${body.readingId} cost=${cost}`);
    return deliver({ method: "credits", cost });
  }

  // ── 포트원 V2 · KG이니시스 실시간 계좌이체 ──
  if (body.method === "portone-pg") {
    let user;
    try {
      user = await resolveUserToken(body.userToken);
    } catch (error) {
      console.error("포트원 결제 회원 확인 실패:", error);
      return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
    }
    if (!user?.userId) {
      return NextResponse.json({ error: "풀 리딩을 열려면 로그인이 필요해요." }, { status: 401 });
    }
    if (!body.paymentId) {
      return NextResponse.json({ error: "결제 번호를 확인하지 못했어요." }, { status: 400 });
    }
    if (stored?.userId && stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩의 결제 권한을 확인할 수 없어요." }, { status: 403 });
    }
    {
      const claim = await claimReadingForPayment(stored, user.userId);
      if (claim) return NextResponse.json({ error: claim.error }, { status: claim.status });
    }

    try {
      const completed = await finalizePortOnePayment(body.paymentId, {
        userId: user.userId,
        kind: "reading",
        readingId: body.readingId,
      });
      console.log(
        `[결제:포트원-KG이니시스] userId=${user.userId} reading=${body.readingId} paymentId=${body.paymentId}`
      );
      return deliver({
        method: "portone-pg",
        paymentId: completed.paymentId,
        amount: completed.amount,
      });
    } catch (error) {
      console.error("포트원 결제 검증 실패:", error);
      const status = error instanceof PortOnePaymentError ? error.status : 503;
      return NextResponse.json(
        {
          error:
            error instanceof PortOnePaymentError
              ? error.message
              : "결제 확인 중 오류가 발생했어요. 잠시 후 다시 확인해주세요.",
          paymentId: body.paymentId,
        },
        { status }
      );
    }
  }

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
    {
      const claim = await claimReadingForPayment(stored, user.userId);
      if (claim) return NextResponse.json({ error: claim.error }, { status: claim.status });
    }
    // 쿠폰은 여기서 금액을 깎고 주문에 붙는다. 승인이 나면 소진, 거절되면 풀린다.
    // 한 푼도 안 깎이는 쿠폰은 붙이지 않는다 (api/checkout 과 같은 이유).
    // 세트 리딩에는 쿠폰이 안 붙는다 — 1,900원 환영 쿠폰이 19,900원 세트를
    // 1,900원으로 만들면 안 된다. 세트는 그 자체가 할인이다.
    const bundle = bundleOfReading(stored?.category ?? "", price);
    const picked =
      body.couponId && !bundle ? await getUsableCoupon(body.couponId, user.userId).catch(() => null) : null;
    const coupon = picked && couponSaving(price, picked) > 0 ? picked : null;
    const amount = coupon ? couponPrice(price, coupon) : price;
    try {
      const order = user.userId
        ? await createPendingTransferOrder({
            userId: user.userId,
            readingId: body.readingId,
            amount,
            depositorCode: body.depositorCode,
            metadata: {
              ...(attribution ? { attribution } : {}),
              ...(bundle ? { bundle: bundle.id } : {}),
              meta: metaSnapshot,
              ...(coupon
                ? {
                    coupon: {
                      id: coupon.id,
                      kind: coupon.kind,
                      discount: price - amount,
                      fixedPrice: coupon.fixedPrice,
                      listPrice: price,
                    },
                  }
                : {}),
            },
          })
        : null;
      if (!order) throw new Error("승인 대기 주문을 만들 수 없습니다.");
      // 이미 대기 중이던 주문이 돌아왔으면 그 금액이 정본이다 - 쿠폰을 새로 붙이지 않는다.
      if (coupon && order.amount === amount) await reserveCoupon(coupon.id, user.userId, order.id);

      // 0원 — 세트 쿠폰. 낼 돈이 없으니 사람이 확인할 입금도 없다. 그 자리에서
      // 승인 길을 그대로 태운다 (쿠폰 소진·생성 시작·알림까지 같은 함수).
      if (order.amount === 0 && order.status === "pending") {
        const outcome = await reviewOrderAndFollowUp(order.id, "paid", "세트 쿠폰으로 열림");
        if (!outcome.ok && outcome.reason !== "already_reviewed") {
          throw new Error("세트 쿠폰 승인에 실패했어요.");
        }
        await notifyAdmin(`[세트 쿠폰] 주문 #${order.id} · ${stored?.category ?? "리딩"} 0원으로 열림 (userId=${user.userId})`);
        return NextResponse.json({ orderId: order.id, readingId: order.readingId, status: "paid", method: "transfer" });
      }
      console.log(
        `[결제승인대기:계좌이체] userId=${user.userId} reading=${body.readingId} order=${order.id} amount=${order.amount}`
      );
      // 이체 캡처가 오면 자동 승인된다. 알림은 기록용 — 캡처 없이 입금한 건만
      // 관리자가 /admin/payments 에서 승인한다.
      // 단, 같은 주문은 한 번만 알린다 — "이체했어요"를 다시 눌러도 이미 대기 중인
      // 주문이 돌아오므로, 그때마다 텔레그램에 같은 요청이 쌓이면 안 된다.
      if (order.created) await notifyAdmin(
        [
          "[입금 확인 요청] 리딩",
          `주문 #${order.id} · ${order.amount.toLocaleString()}원${
            order.amount !== price ? ` (정가 ${price.toLocaleString()}원, 쿠폰 적용)` : ""
          }`,
          `상품 ${stored?.category ?? "리딩"} · 입금코드 ${body.depositorCode}`,
          "이체 캡처가 오면 자동 승인됩니다 — https://loverebbit.xyz/admin/payments",
        ].join("\n")
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
    if (!body.paymentKey || !body.orderId || typeof body.amount !== "number") {
      return NextResponse.json({ error: "결제 정보가 올바르지 않습니다." }, { status: 400 });
    }
    if (stored?.userId && stored.userId !== user.userId) {
      return NextResponse.json({ error: "이 리딩의 결제 권한을 확인할 수 없어요." }, { status: 403 });
    }
    {
      const claim = await claimReadingForPayment(stored, user.userId);
      if (claim) return NextResponse.json({ error: claim.error }, { status: claim.status });
    }

    // 낼 돈은 주문서에 적힌 금액이다. 쿠폰이 붙었으면 정가보다 적다.
    let expectedAmount = price;
    let orderMetadata: Record<string, unknown> = {};
    try {
      const order = await getOrderByProviderOrderId(body.orderId);
      if (
        isDatabaseConfigured() &&
        (!order ||
          order.userId !== user.userId ||
          order.readingId !== body.readingId ||
          order.status !== "pending")
      ) {
        return NextResponse.json({ error: "서버에 기록된 결제 주문과 일치하지 않아요." }, { status: 400 });
      }
      if (order) {
        expectedAmount = order.amount;
        orderMetadata = order.metadata;
      }
      if (body.amount !== expectedAmount) {
        return NextResponse.json({ error: "결제 금액이 주문과 일치하지 않아요." }, { status: 400 });
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
        amount: expectedAmount, // 클라이언트 금액이 아닌 서버 확인 금액으로 승인
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
        const paidOrderId = await createOrder({
          userId: user.userId,
          readingId: body.readingId,
          kind: "reading",
          method: "toss-pg",
          status: "paid",
          amount: expectedAmount,
          providerOrderId: body.orderId,
          metadata: { ...orderMetadata, ...(attribution ? { attribution } : {}) },
        });
        if (paidOrderId) await settleCouponsForOrder(paidOrderId, "paid");
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
