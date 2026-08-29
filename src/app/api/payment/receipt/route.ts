import { NextRequest, NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/database";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdminPhoto, reviewButtons } from "@/lib/telegram";
import { resolveUserToken } from "@/lib/tokens";

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
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "이체 화면 사진을 골라주세요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "사진이 너무 커요. 5MB 이하로 올려주세요." }, { status: 413 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `${orderId}/${Date.now()}.${ext}`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(key, bytes, { contentType: file.type });
  if (upErr) {
    console.error("이체 캡처 저장 실패:", upErr.message);
    return NextResponse.json({ error: "사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const at = new Date().toISOString();
  await db
    .from("lr_orders")
    .update({ metadata: { ...metadata, receipts: [...receipts, { key, at }] }, updated_at: at })
    .eq("id", orderId);

  const sent = await notifyAdminPhoto(
    { bytes, filename: `receipt-${orderId}.${ext}`, contentType: file.type },
    [
      `[이체 캡처] 리딩 주문 #${orderId} · ${Number(order.amount).toLocaleString()}원`,
      `입금코드 ${order.depositor_code ?? "-"} · 사진 ${receipts.length + 1}/${MAX_PER_ORDER}`,
      "사진의 금액·받는 계좌를 확인하고 승인하세요.",
    ].join("\n"),
    reviewButtons(orderId)
  );
  console.log(`[이체캡처] order=${orderId} key=${key} telegram=${sent}`);
  return NextResponse.json({ ok: true, count: receipts.length + 1 });
}
