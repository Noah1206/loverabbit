import { NextRequest, NextResponse } from "next/server";

import { getReviewForReading, isDatabaseConfigured } from "@/lib/database";

// 이 리딩에 후기가 이미 있는지. 결과 화면이 폼을 띄울지 "고맙습니다"를 띄울지
// 고르는 데만 쓴다. 후기 내용은 내려주지 않는다.

export async function GET(request: NextRequest) {
  const readingId = request.nextUrl.searchParams.get("readingId")?.trim();
  if (!readingId || !isDatabaseConfigured()) {
    return NextResponse.json(
      { reviewed: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  try {
    const review = await getReviewForReading(readingId);
    return NextResponse.json(
      { reviewed: Boolean(review), rating: review?.rating ?? null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("후기 여부 확인 실패:", error);
    // 확인에 실패했다고 폼을 막을 이유는 없다. 중복은 저장 단계에서 걸린다.
    return NextResponse.json({ reviewed: false });
  }
}
