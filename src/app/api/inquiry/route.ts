import { NextRequest, NextResponse } from "next/server";

import {
  countRecentInquiries,
  createInquiry,
  isDatabaseConfigured,
  type InquiryCategory,
} from "@/lib/database";
import { SITE_URL } from "@/lib/site";
import { notifyAdmin } from "@/lib/telegram";
import { resolveUserToken } from "@/lib/tokens";

// 앱 하단 원버튼에서 들어오는 문의 접수.
// 로그인 없이도 보낼 수 있게 하되, 답장할 곳이 있어야 하므로 이메일은 받는다.

// "chat" 은 받지 않는다 - 캐릭터 대화 상품이 없어졌다. 옛 문의 행에만 남아 있는 값이라
// 라벨(CATEGORY_LABEL)에는 그대로 두고, 새 접수만 막는다.
const CATEGORIES: InquiryCategory[] = ["payment", "reading", "account", "bug", "etc"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_LEN = 5;
const MAX_LEN = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

const CATEGORY_LABEL: Record<InquiryCategory, string> = {
  payment: "결제",
  reading: "리딩",
  chat: "캐릭터 대화 (종료된 상품)",
  account: "계정",
  bug: "오류",
  etc: "기타",
};

interface Body {
  category?: string;
  message?: string;
  email?: string;
  pagePath?: string;
  userToken?: string;
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "문의 접수를 준비 중입니다." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const message = (body.message ?? "").trim();
  const category = (CATEGORIES as string[]).includes(body.category ?? "")
    ? (body.category as InquiryCategory)
    : "etc";

  if (message.length < MIN_LEN) {
    return NextResponse.json({ error: `문의 내용을 ${MIN_LEN}자 이상 적어주세요.` }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `문의 내용은 ${MAX_LEN}자까지 보낼 수 있어요.` }, { status: 400 });
  }

  let userId: number | null = null;
  try {
    const user = await resolveUserToken(body.userToken);
    userId = user?.userId ?? null;
  } catch {
    // 토큰이 상해도 문의 자체는 받는다. 이 경우 이메일로 답장한다.
    userId = null;
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!userId) {
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "답장받을 이메일을 입력해주세요." },
        { status: 400 }
      );
    }
  } else if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "이메일 형식을 확인해주세요." }, { status: 400 });
  }

  // 같은 사람이 10분 안에 3건을 넘기면 잠시 막는다.
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const recent = await countRecentInquiries(userId ? { userId } : { email }, since);
    if (recent >= MAX_PER_WINDOW) {
      return NextResponse.json(
        { error: "방금 보낸 문의를 확인하고 있어요. 잠시 후에 다시 보내주세요." },
        { status: 429 }
      );
    }
  } catch (error) {
    console.error("문의 도배 확인 실패:", error);
  }

  const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 200) : null;

  try {
    const saved = await createInquiry({
      userId,
      email: email || null,
      category,
      message,
      pagePath,
    });
    if (!saved) throw new Error("문의를 저장하지 못했습니다.");
    console.log(`[문의접수] id=${saved.id} userId=${userId ?? "-"} category=${category}`);
    // 접수되는 순간 운영자 텔레그램으로 알린다. 안 알리면 문의는 /admin/inquiries 를
    // 우연히 열 때까지 묻힌다. notifyAdmin 은 던지지 않고 4초 상한이라 접수를 막지 않는다.
    await notifyAdmin(
      [
        `[문의] #${saved.id} · ${CATEGORY_LABEL[category]}`,
        `${email || "(이메일 없음)"}${userId ? ` · 회원 #${userId}` : " · 비회원"}${pagePath ? ` · ${pagePath}` : ""}`,
        "",
        message.length > 600 ? `${message.slice(0, 600)}…` : message,
        "",
        `답변: ${SITE_URL}/admin/inquiries`,
      ].join("\n")
    );
    return NextResponse.json({ inquiryId: saved.id, status: saved.status });
  } catch (error) {
    console.error("문의 저장 실패:", error);
    return NextResponse.json(
      { error: "문의를 접수하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }
}
