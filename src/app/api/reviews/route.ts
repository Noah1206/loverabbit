import { NextRequest, NextResponse } from "next/server";

import {
  createReview,
  getReviewForReading,
  isDatabaseConfigured,
  listPublishedReviews,
  type ReviewRejection,
} from "@/lib/database";
import {
  maskName,
  normalizeRating,
  normalizeReviewBody,
  readableName,
  type PublicReview,
  type ReviewSummary,
} from "@/lib/reviews";
import { resolveUserToken } from "@/lib/tokens";

// 후기 — 홈이 읽어 가는 곳(GET)이자, 리딩을 다 읽은 사람이 남기는 곳(POST).
//
// 여기로 들어오지 않은 후기는 사이트에 존재하지 않는다. 손으로 넣을 자리를
// 만들지 않은 것은 의도다. 후기의 값어치는 전부 "산 사람이 썼다"에서 나온다.

const DEFAULT_LIMIT = 20;
// 홈은 한 번에 다 받아 두고 "더 보기"로 펼친다. 후기가 이보다 많아지면
// 그때는 페이지를 나눠야 한다 — 지금 조용히 잘리면 눈치채기 어렵다.
const MAX_LIMIT = 100;

const EMPTY: ReviewSummary = { reviews: [], total: 0, average: null, ratedCount: 0 };

export async function GET(request: NextRequest) {
  // DB가 아직 안 붙은 환경(로컬·프리뷰)에서는 후기가 없는 것과 같이 다룬다.
  // 화면은 빈 결과를 받으면 섹션 자체를 그리지 않는다.
  if (!isDatabaseConfigured()) return NextResponse.json(EMPTY);

  const params = request.nextUrl.searchParams;
  const requested = Number(params.get("limit"));
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const productId = params.get("product")?.trim() || undefined;

  try {
    const { rows, total, average, ratedCount } = await listPublishedReviews({ limit, productId });
    // 이름은 나가는 자리에서 한 번 더 가린다. 저장할 때 가리는 길(createReview)만
    // 믿으면 그 길을 안 거친 행 - 베타 후기처럼 사람이 직접 넣은 것 - 이 실명 그대로
    // 나간다. 실제로 그랬다. maskName 은 이미 가린 이름에 다시 걸어도 그대로라
    // (박*농 -> 박*농) 무조건 거는 쪽이 안전하다. 관리자 화면은 식별이 필요해 예외다.
    const reviews: PublicReview[] = rows.map((row) => ({
      id: row.id,
      source: row.source,
      name: readableName(maskName(row.displayName)),
      rating: row.rating,
      productId: row.productId,
      productLabel: row.productLabel,
      purchaseCount: row.purchaseCount,
      body: row.body,
      createdAt: row.createdAt,
    }));
    return NextResponse.json(
      { reviews, total, average, ratedCount } satisfies ReviewSummary,
      // 후기는 자주 바뀌지 않는다. 1분 캐시로 홈 첫 화면을 가볍게 둔다.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("후기 조회 실패:", error);
    return NextResponse.json(EMPTY);
  }
}

const REJECTION_MESSAGE: Record<ReviewRejection, string> = {
  not_found: "후기를 남길 리딩을 찾지 못했어요.",
  not_owner: "본인이 받은 리딩에만 후기를 남길 수 있어요.",
  locked: "리딩을 열어 본 뒤에 후기를 남길 수 있어요.",
  already_reviewed: "이 리딩에는 이미 후기를 남기셨어요.",
};

interface Body {
  userToken?: string;
  readingId?: string;
  rating?: unknown;
  body?: unknown;
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "후기 접수를 준비 중입니다." }, { status: 503 });
  }

  const payload = (await request.json().catch(() => ({}))) as Body;

  const user = await resolveUserToken(payload.userToken).catch(() => null);
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인 후에 후기를 남길 수 있어요." }, { status: 401 });
  }

  const readingId = (payload.readingId ?? "").trim();
  if (!readingId) {
    return NextResponse.json({ error: "어떤 리딩의 후기인지 알 수 없어요." }, { status: 400 });
  }

  const rating = normalizeRating(payload.rating);
  if (rating === null) {
    return NextResponse.json({ error: "별점을 선택해주세요." }, { status: 400 });
  }

  const { body, error: bodyError } = normalizeReviewBody(payload.body);
  if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });

  try {
    const existing = await getReviewForReading(readingId);
    if (existing) {
      return NextResponse.json(
        { error: REJECTION_MESSAGE.already_reviewed },
        { status: 409 }
      );
    }

    const result = await createReview({ userId: user.userId, readingId, rating, body });

    if ("rejected" in result) {
      const status = result.rejected === "already_reviewed" ? 409 : 403;
      return NextResponse.json({ error: REJECTION_MESSAGE[result.rejected] }, { status });
    }

    console.log(`[후기접수] id=${result.review.id} userId=${user.userId} rating=${rating}`);
    return NextResponse.json({ reviewId: result.review.id, rating: result.review.rating });
  } catch (error) {
    console.error("후기 저장 실패:", error);
    return NextResponse.json(
      { error: "후기를 저장하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }
}
