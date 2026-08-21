"use client";

import { useEffect, useState } from "react";
import { REVIEW_BODY_MAX } from "@/lib/reviews";

// 리딩을 끝까지 읽은 사람에게만 나오는 후기 폼.
//
// 홈에 걸리는 후기는 전부 여기서 들어온다. 그래서 자리도 여기다 —
// 다 읽은 직후가 할 말이 남아 있는 유일한 순간이고, 다음 상품을 권하기 전이다.

const STARS = [1, 2, 3, 4, 5];

export default function ReviewPrompt({
  readingId,
  userToken,
  productLabel,
}: {
  readingId: string;
  userToken: string | null;
  productLabel: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // 이미 남긴 후기가 있으면 폼을 아예 띄우지 않는다. 확인 전에는 아무것도 안 그린다.
  const [checked, setChecked] = useState(false);
  const [already, setAlready] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/reviews/status?readingId=${encodeURIComponent(readingId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        setAlready(Boolean(data?.reviewed));
        setChecked(true);
      })
      .catch(() => {
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [readingId]);

  const submit = async () => {
    if (!rating || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId, userToken, rating, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "후기를 저장하지 못했어요.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  // 로그인해야 후기를 남길 수 있다. 폼을 띄워놓고 보낼 때 막는 것보다,
  // 남길 수 없는 사람에게는 아예 안 보이는 편이 낫다.
  if (!userToken || !checked || already) return null;

  if (done) {
    return (
      <div className="review-prompt review-prompt-done">
        <strong>후기 고맙습니다 🐰</strong>
        <p>남겨주신 후기는 홈에서 다른 분들이 보게 돼요.</p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <div className="review-prompt">
      <span className="badge">후기</span>
      <h2>{productLabel}, 어떠셨어요?</h2>
      <p className="review-prompt-lead">
        홈에 걸리는 후기는 전부 실제로 리딩을 받은 분들이 쓴 거예요. 한 줄이면 충분합니다.
      </p>

      <div
        className="review-prompt-stars"
        role="radiogroup"
        aria-label="별점"
        onMouseLeave={() => setHover(0)}
      >
        {STARS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}점`}
            className={n <= shown ? "on" : ""}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
        {rating > 0 && <span className="review-prompt-rating-text">{rating}점</span>}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
        placeholder="어떤 점이 맞았는지, 아쉬웠던 건 뭔지 편하게 적어주세요. (선택)"
        rows={3}
        maxLength={REVIEW_BODY_MAX}
      />
      <div className="review-prompt-count">
        {body.length}/{REVIEW_BODY_MAX}
      </div>

      {error && <p className="report-error" role="alert">{error}</p>}

      <button
        type="button"
        className="review-prompt-submit"
        onClick={() => void submit()}
        disabled={!rating || sending}
      >
        {sending ? "보내는 중…" : rating ? "후기 남기기" : "별점을 먼저 눌러주세요"}
      </button>
      <small className="review-prompt-note">
        표시는 이름을 가려서 나가요 (예: 김*환). 리딩 내용은 후기에 붙지 않아요.
      </small>
    </div>
  );
}
