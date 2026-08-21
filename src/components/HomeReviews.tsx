"use client";

import { useEffect, useState } from "react";
import type { PublicReview, ReviewSummary } from "@/lib/reviews";

// 홈 맨 아래 후기. 사주 카드를 다 훑고 내려온 사람에게 마지막으로 보이는 자리다.
//
// 여기 나오는 것은 전부 /api/reviews 가 내려준 것이고, 손으로 채워 넣을 자리는 없다.
// 출처가 두 가지이고 둘을 구분해서 보여준다:
//
//   live  여기서 결제하고 리딩을 열어 본 사람이 남긴 것 — 별점·상품명·구매 횟수가 있다
//   beta  베타 테스트 때 받은 후기 — 셋 다 없다
//
// 없는 자리를 채우지 마라. 별점은 베타 때 받지 않았고, 상품명은 다른 서비스를
// 가리키고, 구매 횟수는 여기서 산 횟수가 아니다. 후기가 하나도 없으면
// 섹션 자체가 안 나온다.

// 처음엔 몇 개만 편다. 나머지는 "전체보기"를 누른 자리에서 그대로 이어 붙는다 —
// 페이지를 옮기지 않는 것이 핵심이다. 넘어갔다 돌아오면 보던 자리를 잃는다.
const INITIAL = 3;

function formatDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getFullYear()}.${String(at.getMonth() + 1).padStart(2, "0")}`;
}

function ReviewCard({ review }: { review: PublicReview }) {
  const beta = review.source === "beta";
  return (
    <article className="review-card">
      <div className="review-card-head">
        <span className="review-card-avatar" aria-hidden>🐰</span>
        <div className="review-card-who">
          <strong>{review.name}</strong>
          <span>
            {/* 베타 후기의 횟수는 베타 플랫폼에서 산 횟수다. 어디서 산 것인지를
                빼고 적으면 러브레빗에서 그만큼 샀다는 말이 된다. */}
            {review.purchaseCount !== null &&
              review.purchaseCount > 1 &&
              `${beta ? "베타에서 " : ""}${review.purchaseCount.toLocaleString()}번 구매 · `}
            {review.productLabel && `${review.productLabel} · `}
            {formatDate(review.createdAt)}
          </span>
        </div>
        {review.rating !== null ? (
          <span className="review-card-stars" aria-label={`5점 만점에 ${review.rating}점`}>
            <span aria-hidden>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </span>
          </span>
        ) : beta ? (
          <span className="review-card-tag">베타</span>
        ) : null}
      </div>
      <p>{review.body}</p>
    </article>
  );
}

export default function HomeReviews() {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/reviews?limit=100")
      .then((res) => res.json())
      .then((json: ReviewSummary) => {
        if (alive) setData(json);
      })
      .catch(() => {
        // 후기를 못 불러온 것뿐이다. 홈의 나머지는 그대로 쓰게 둔다.
        if (alive) setData({ reviews: [], total: 0, average: null, ratedCount: 0 });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.reviews.length === 0) return null;

  const shown = expanded ? data.reviews : data.reviews.slice(0, INITIAL);
  const rest = data.reviews.length - shown.length;
  const hasBeta = data.reviews.some((r) => r.source === "beta");
  const hasLive = data.reviews.some((r) => r.source === "live");

  return (
    <section className="review-section" aria-labelledby="review-heading">
      <div className="review-head">
        <h3 id="review-heading">💬 먼저 본 사람들</h3>
        <span className="review-head-score">
          {/* 평균은 별점이 달린 후기로만 낸 값이다. 몇 개를 세었는지 같이 밝힌다. */}
          {data.average !== null && (
            <>
              <b aria-hidden>★</b> {data.average.toFixed(1)}
              <em>({data.ratedCount})</em> ·{" "}
            </>
          )}
          후기 {data.total.toLocaleString()}개
        </span>
      </div>

      <div className="review-list" id="review-list">
        {shown.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {rest > 0 && (
        <button
          type="button"
          className="review-more"
          aria-expanded={false}
          aria-controls="review-list"
          onClick={() => setExpanded(true)}
        >
          후기 전체보기 <em>{data.reviews.length.toLocaleString()}개</em> <b aria-hidden>▾</b>
        </button>
      )}

      {expanded && data.reviews.length > INITIAL && (
        <button
          type="button"
          className="review-more"
          aria-expanded
          aria-controls="review-list"
          onClick={() => setExpanded(false)}
        >
          접기 <b aria-hidden>▴</b>
        </button>
      )}

      {/* 후기가 어디서 왔는지 밝히는 자리. 이 문장이 사실이 아니게 되는 변경은 하지 마라. */}
      <p className="review-verified">
        {hasLive && (
          <>
            <span aria-hidden>✓</span> 결제 후 리딩을 열어 본 분만 후기를 남길 수 있어요.
          </>
        )}
        {hasLive && hasBeta && <br />}
        {hasBeta && (
          <>‘베타’ 표시는 베타 테스트 때 받은 후기예요. 작성자 동의를 받아 읽기 쉽게 다듬었어요.</>
        )}
      </p>
    </section>
  );
}
