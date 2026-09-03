import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdmin, notifyAdminPhoto, reviewButtons } from "@/lib/telegram";
import { reviewOrderAndFollowUp } from "@/lib/order-review";
import { resolveUserToken } from "@/lib/tokens";

// 승인이 곧 생성 시작이라 관리자 승인 라우트와 같은 이유로 길게 잡는다.
export const maxDuration = 300;

/*
  이체 완료 화면 캡처 접수.

  "입금을 마쳤어요" 를 눌렀는데 통장엔 없는 건이 많았다. 운영자는 통장을 뒤지고,
  손님은 왜 안 열리냐고 기다린다. 손님이 이체 화면을 올리면 운영자는 텔레그램에서
  그 사진 밑의 [승인] 을 바로 누른다 — 통장 대조는 나중에 해도 된다.

  사진은 비공개 버킷(lr-receipts)에 남긴다. 텔레그램에만 보내면 나중에 분쟁이
  났을 때 찾을 곳이 없다. 이름·계좌가 찍힌 사진이라 공개 주소는 만들지 않는다.

  대기 중(pending)인 자기 주문에만 올릴 수 있고, 한 주문에 3장까지다.
*/

const BUCKET = "lr-receipts";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_ORDER = 3;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "결제 DB 연결을 준비 중입니다." }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "사진을 읽지 못했어요." }, { status: 400 });
  }
  const orderId = Number(form.get("orderId"));
  const userToken = form.get("userToken");
  const file = form.get("file");
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "주문 번호가 올바르지 않아요." }, { status: 400 });
  }
  // 사진은 선택이다 — 캡처를 안 올리는 손님이 많아 "입금을 마쳤어요"만으로도 승인한다.
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (photo && photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "사진이 너무 커요. 5MB 이하로 올려주세요." }, { status: 413 });
  }
  const ext = photo ? TYPES[photo.type] : null;
  if (photo && !ext) {
    return NextResponse.json({ error: "사진 파일(JPG·PNG)만 올릴 수 있어요." }, { status: 415 });
  }

  let userId: number | null = null;
  try {
    const user = await resolveUserToken(typeof userToken === "string" ? userToken : undefined);
    userId = user?.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: order } = await db
    .from("lr_orders")
    .select("id,user_id,kind,reading_id,status,amount,depositor_code,metadata")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || Number(order.user_id) !== userId) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });
  }
  const metadata = (order.metadata && typeof order.metadata === "object" ? order.metadata : {}) as Record<string, unknown>;
  const receipts = Array.isArray(metadata.receipts) ? (metadata.receipts as unknown[]) : [];
  if (receipts.length >= MAX_PER_ORDER) {
    return NextResponse.json({ error: "사진은 주문당 3장까지 올릴 수 있어요. 이미 접수됐으니 기다려주세요." }, { status: 429 });
  }

  let bytes: Uint8Array | null = null;
  if (photo) {
    bytes = new Uint8Array(await photo.arrayBuffer());
    const key = `${orderId}/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(key, bytes, { contentType: photo.type });
    if (upErr) {
      console.error("이체 캡처 저장 실패:", upErr.message);
      return NextResponse.json({ error: "사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    const at = new Date().toISOString();
    await db
      .from("lr_orders")
      .update({ metadata: { ...metadata, receipts: [...receipts, { key, at }] }, updated_at: at })
      .eq("id", orderId);
  }

  /*
    캡처가 곧 승인이다. 사람이 통장을 열 때까지 손님이 기다리던 구간(#261·#283,
    2026-09-02)을 지웠다 — 사진은 버킷에 남으니 대조는 나중에 해도 된다.
    실패하면 예전처럼 승인 버튼을 붙여 보낸다. 그때만 사람 손이 필요하다.
  */
  const outcome = await reviewOrderAndFollowUp(orderId, "paid", photo ? "이체 캡처 접수 — 자동 승인" : "입금 완료 확인 — 자동 승인");
  const approved = outcome.ok || outcome.reason === "already_reviewed";
  const caption = [
    `[${photo ? "이체 캡처" : "입금 완료"}] 주문 #${orderId} · ${Number(order.amount).toLocaleString()}원`,
    `입금코드 ${order.depositor_code ?? "-"}${photo ? ` · 사진 ${receipts.length + 1}/${MAX_PER_ORDER}` : " · 캡처 없음"}`,
    approved ? "자동 승인 완료 — 통장과 나중에 대조하세요." : "자동 승인 실패 — 확인하고 승인하세요.",
  ].join("\n");
  const buttons = approved ? undefined : reviewButtons(orderId);
  const sent = photo && bytes
    ? await notifyAdminPhoto({ bytes, filename: `receipt-${orderId}.${ext}`, contentType: photo.type }, caption, buttons)
    : (await notifyAdmin(caption, buttons), true);
  console.log(`[이체캡처] order=${orderId} photo=${!!photo} approved=${approved} telegram=${sent}`);
  return NextResponse.json({ ok: true, count: receipts.length + 1, status: approved ? "paid" : "pending" });
}
