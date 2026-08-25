import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOrder, isDatabaseConfigured } from "@/lib/database";
import { getPortOneNoticeUrl } from "@/lib/portone-notice-url";
import { getPortOneServerConfig, hasAnyPortOneServerSetting } from "@/lib/portone-payment";
import { getReading } from "@/lib/store";
import { resolveUserToken } from "@/lib/tokens";
import { normalizeAttribution } from "@/lib/attribution";
import { claimReadingForPayment } from "@/lib/reading-claim";
import { snapshotMetaMatch } from "@/lib/meta-capi";

interface Body {
  readingId?: string;
  userToken?: string;
  /** 광고 유입 표시. 주소에서 온 값이라 그대로 믿지 않는다. */
  attribution?: unknown;
  /** 마케팅 쿠키 동의. 동의는 기기에만 있어 브라우저가 말해줘야 안다. */
  marketingConsent?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const portOneConfig = getPortOneServerConfig();
  const usePortOne = Boolean(portOneConfig);
  if (hasAnyPortOneServerSetting() && !portOneConfig) {
    return NextResponse.json(
      { error: "포트원 결제 키 설정을 확인해주세요." },
      { status: 503 }
    );
  }
  if (!usePortOne && (!process.env.TOSS_SECRET_KEY || !process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY)) {
    return NextResponse.json(
      { error: "토스페이먼츠 결제 키 설정이 아직 완료되지 않았어요." },
      { status: 503 }
    );
  }
  if (process.env.NODE_ENV === "production" && !isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }
  if (usePortOne && !isDatabaseConfigured()) {
    return NextResponse.json({ error: "포트원 결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("결제 주문 회원 확인 실패:", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "결제하려면 먼저 로그인해주세요.", needSignup: true }, { status: 401 });
  }

  let reading;
  try {
    reading = await getReading(body.readingId ?? "");
  } catch (error) {
    console.error("결제 주문 리딩 조회 실패:", error);
    return NextResponse.json({ error: "리딩을 확인하지 못했어요." }, { status: 503 });
  }
  if (!reading) {
    return NextResponse.json({ error: "결제할 리딩을 찾을 수 없어요." }, { status: 404 });
  }
  if (reading.userId && reading.userId !== user.userId) {
    return NextResponse.json({ error: "이 리딩을 결제할 권한이 없어요." }, { status: 403 });
  }
  if (reading.unlocked) {
    return NextResponse.json({ error: "이미 열린 리딩이에요." }, { status: 409 });
  }
  {
    const claim = await claimReadingForPayment(reading, user.userId);
    if (claim) return NextResponse.json({ error: claim.error }, { status: claim.status });
  }

  const attribution = normalizeAttribution(body.attribution);
  const orderId = `${usePortOne ? "LRP" : "LR"}_${randomUUID().replace(/-/g, "")}`;
  try {
    await createOrder({
      userId: user.userId,
      readingId: reading.id,
      kind: "reading",
      method: usePortOne ? "portone-pg" : "toss-pg",
      status: "pending",
      amount: reading.price,
      providerOrderId: orderId,
      metadata: {
        checkout_created_at: new Date().toISOString(),
        ...(attribution ? { attribution } : {}),
        // 결제가 웹훅으로 끝나면 그때는 브라우저가 없다. 전환을 만들 재료를
        // 사람이 화면 앞에 있는 지금 떠 둔다.
        meta: snapshotMetaMatch(request, attribution, body.marketingConsent === true),
      },
    });
  } catch (error) {
    console.error("결제 주문 생성 실패:", error);
    return NextResponse.json({ error: "결제 주문을 만들지 못했어요." }, { status: 503 });
  }

  return NextResponse.json({
    orderId,
    paymentId: orderId,
    amount: reading.price,
    orderName: "러브레빗 사주 전문 리딩",
    provider: usePortOne ? "portone" : "toss",
    ...(usePortOne ? { noticeUrl: getPortOneNoticeUrl(request.nextUrl.origin) } : {}),
  });
}
