// 후기가 지키는 한 줄: "산 사람이 쓴 것만 올라간다."
//
// 자격 확인(리딩 주인인지, 해금됐는지)은 DB를 붙들고 있어서 여기서 못 돌린다.
// 대신 그 앞뒤에서 화면에 나가는 값을 다루는 것들을 못 박아 둔다 — 이름이 통째로
// 새 나가지 않는지, 별점·본문이 아무 값이나 통과하지 않는지.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  REVIEW_BODY_MAX,
  maskName,
  normalizeRating,
  normalizeReviewBody,
  readableName,
} from "@/lib/reviews";

describe("이름 가리기", () => {
  it("가운데를 별로 덮는다", () => {
    assert.equal(maskName("박서농"), "박*농");
    assert.equal(maskName("김환"), "김*");
    assert.equal(maskName("남궁민수"), "남**수");
  });

  it("한 글자는 통째로 가린다", () => {
    assert.equal(maskName("이"), "*");
  });

  it("이름이 없으면 이메일 앞부분을 같은 규칙으로 가린다", () => {
    assert.equal(maskName(null, "hong@example.com"), "h**g");
    assert.equal(maskName("", "u6@example.com"), "u*");
  });

  it("이름도 이메일도 없으면 아무것도 흘리지 않는다", () => {
    assert.equal(maskName(null, null), "**");
    assert.equal(maskName("   ", ""), "**");
  });

  it("이메일 도메인은 어떤 경우에도 나가지 않는다", () => {
    for (const masked of [
      maskName(null, "someone@gmail.com"),
      maskName("", "a.very.long.address@naver.com"),
    ]) {
      assert.ok(!masked.includes("@"), `@가 남았다: ${masked}`);
      assert.ok(!masked.includes("."), `도메인이 남았다: ${masked}`);
    }
  });
});

describe("별점", () => {
  it("1~5의 정수만 받는다", () => {
    for (const n of [1, 2, 3, 4, 5]) assert.equal(normalizeRating(n), n);
  });

  it("범위 밖이거나 정수가 아니면 거절한다", () => {
    for (const bad of [0, 6, -1, 4.5, "5", null, undefined, NaN, "다섯"]) {
      assert.equal(normalizeRating(bad), null, `통과하면 안 된다: ${String(bad)}`);
    }
  });
});

describe("본문", () => {
  it("별점만 남기는 것도 후기다 — 빈 본문은 null 로 통과한다", () => {
    assert.deepEqual(normalizeReviewBody(""), { body: null });
    assert.deepEqual(normalizeReviewBody("   "), { body: null });
    assert.deepEqual(normalizeReviewBody(undefined), { body: null });
  });

  it("앞뒤 공백은 털어낸다", () => {
    assert.deepEqual(normalizeReviewBody("  잘 맞았어요  "), { body: "잘 맞았어요" });
  });

  it("한 글자짜리도 후기다 — 짧다고 막지 않는다", () => {
    // 실제로 들어오는 후기의 상당수가 "굿", "좋아요", "Good" 한 마디다.
    for (const body of ["굿", "Good", "조아용"]) {
      assert.deepEqual(normalizeReviewBody(body), { body });
    }
  });

  it("길이 상한을 넘기면 거절한다 — 잘라서 저장하지 않는다", () => {
    const result = normalizeReviewBody("가".repeat(REVIEW_BODY_MAX + 1));
    assert.equal(result.body, null);
    assert.ok(result.error);
  });

  it("상한에 딱 맞는 것은 통과한다", () => {
    const body = "가".repeat(REVIEW_BODY_MAX);
    assert.deepEqual(normalizeReviewBody(body), { body });
  });
});

describe("후기 모듈에는 후기 데이터가 없다", () => {
  // 지어낸 후기가 코드에 박히는 순간 표시광고법 위반이다. 누가 편의로
  // 상수 배열을 되살리면 이 테스트가 먼저 말한다.
  it("lib/reviews 는 후기 배열을 내보내지 않는다", async () => {
    const module = (await import("@/lib/reviews")) as Record<string, unknown>;
    const arrays = Object.entries(module).filter(([, value]) => Array.isArray(value));
    assert.deepEqual(
      arrays.map(([name]) => name),
      [],
      "후기는 DB(lr_reviews)에서만 온다. 코드에 상수로 넣지 마라."
    );
  });
});

describe("베타 후기 원본", () => {
  // scripts/beta-reviews.json 은 사람이 손으로 옮겨 담는 파일이다. 손이 닿는 곳에는
  // 없던 값이 슬쩍 생기기 마련이라, 여기서 못 박아 둔다.
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), "scripts/beta-reviews.json"), "utf8")
  ) as { reviews: Record<string, unknown>[] };

  it("별점을 달지 않는다 — 베타 원본에 없던 값이다", () => {
    const withRating = raw.reviews.filter((review) => "rating" in review);
    assert.deepEqual(
      withRating,
      [],
      "베타 후기에 별점을 넣지 마라. 없던 것을 채우면 홈의 평균이 거짓말이 된다."
    );
  });

  it("모든 후기에 작성자와 본문이 있다", () => {
    for (const review of raw.reviews) {
      for (const field of ["name", "body"]) {
        const value = review[field];
        assert.ok(
          typeof value === "string" && value.trim().length > 0,
          `${field} 가 비었다: ${JSON.stringify(review)}`
        );
      }
    }
  });

  it("이름은 가려진 채로 있다 — 멀쩡한 이름으로 바꾸지 않는다", () => {
    // 원본은 이미 가려진 이름으로 왔다. 이걸 그럴듯한 실명으로 바꾸면 후기를
    // 편집하는 게 아니라 있지도 않은 고객을 만드는 일이 된다.
    for (const review of raw.reviews) {
      assert.ok(
        String(review.name).includes("*"),
        `가려지지 않은 이름이 있다: ${String(review.name)} — 이름을 지어내지 마라.`
      );
    }
  });

  it("작성 시각은 KST 형식이거나, 모르면 null 이고 이유가 적혀 있다", () => {
    for (const review of raw.reviews) {
      if (review.at === null) {
        assert.ok(
          typeof review.note === "string" && review.note.length > 0,
          `시각이 없으면 왜 없는지 적어야 한다: ${JSON.stringify(review)}`
        );
        continue;
      }
      assert.match(
        String(review.at),
        /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/,
        `시각 형식이 다르다: ${String(review.at)}`
      );
    }
  });

  it("이름·시각·본문 말고는 아무것도 들고 있지 않다", () => {
    // 별점·상품명·구매 횟수는 전부 여기서 셀 근거가 없는 값이라 필드째로 없앴다.
    // 편의로 되살리는 순간 홈에 사실이 아닌 말이 걸린다.
    const ALLOWED = new Set(["name", "at", "body", "note"]);
    for (const review of raw.reviews) {
      const extra = Object.keys(review).filter((key) => !ALLOWED.has(key));
      assert.deepEqual(
        extra,
        [],
        `베타 후기에 없어야 할 값이 붙었다: ${extra.join(", ")} — 별점·상품명·구매 횟수는 만들지 마라.`
      );
    }
  });

  it("어느 칸에도 점술가 이름이 남아 있지 않다", () => {
    const READERS = [
      "청월아씨", "홍연아씨", "백월아씨", "흑월도령", "몽월소녀", "연화무녀", "MZ무당",
    ];
    for (const review of raw.reviews) {
      const blob = JSON.stringify(review);
      const found = READERS.find((reader) => blob.includes(reader));
      assert.equal(found, undefined, `점술가 이름이 남았다: ${found} in ${blob}`);
    }
  });

  it("본문 길이가 저장 한도 안에 있다", () => {
    for (const review of raw.reviews) {
      const body = String(review.body).trim();
      assert.ok(
        body.length >= 1 && body.length <= REVIEW_BODY_MAX,
        `본문이 한도를 벗어난다 (${body.length}자): ${String(review.name)}`
      );
    }
  });
});

describe("깨진 이름 자리", () => {
  it("한글이 없는 마스킹은 '익명'으로 나간다", () => {
    // 원본 마스킹에 'u*6', 's*m', '**' 처럼 한글이 한 글자도 안 남은 것들이 섞여 있다.
    for (const broken of ["**", "u*6", "s*m", "**I", "J*a", "**J"]) {
      assert.equal(readableName(broken), "익명");
    }
  });

  it("읽을 수 있는 이름은 그대로 둔다", () => {
    for (const fine of ["박*농", "김*환", "**영", "미*팍"]) {
      assert.equal(readableName(fine), fine);
    }
  });
});
