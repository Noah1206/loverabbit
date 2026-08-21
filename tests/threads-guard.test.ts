// 가드가 무엇을 잡고 무엇을 놓아주는지.
//
// Threads 쪽에서 가장 잦은 실패는 리딩과 다르다. 리딩은 근거 없이 길어졌고,
// Threads는 패턴의 모양을 맞추려고 없는 순위를 만든다. SS-P01·SS-P02가 순위
// 패턴이라, 순위 입력이 없는 글에 "1위"가 들어오는 것을 반드시 잡아야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { loadCorpus } from "@/lib/threads-corpus";
import { checkThreadDraft, duplicateOfPrevious, verbatimOverlap } from "@/lib/threads-guard";
import {
  countChars,
  type AuthorizedReuseMode,
  type DirectCopySpan,
  type LoveRabbitContentInput,
  type ThreadPostBody,
} from "@/lib/threads-content";
import type { ThreadDraftOut } from "@/lib/threads-prompt";

const corpus = loadCorpus().rows;

function inputWith(over: Partial<LoveRabbitContentInput> = {}): LoveRabbitContentInput {
  return {
    id: "t1",
    contentLane: "inner_world",
    goal: "engagement",
    selectedPatternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
    approvedFacts: [
      { ruleId: "TG-JEONGGWAN", claimId: "TG-JEONGGWAN#claim", safePhrasing: "그런 결", scope: "기질" },
    ],
    variables: { date: "2026-08-21", cta: { type: "comment", text: "댓글로 알려줘요." } },
    ...over,
  };
}

function draftWith(over: Partial<ThreadDraftOut> = {}): ThreadDraftOut {
  return {
    patternId: "SS-P03-SECRET-INSIDE-OUTSIDE",
    benchmarkSourcePostIds: ["SS-20260805-HIDDEN-PAIN"],
    directCopySourcePostIds: [],
    directCopyExcerpts: [],
    directCopySpans: [],
    sourceTransformLog: [],
    posts: [{ sequence: 1, body: "겉으로는 단단해 보여도 안에서 오래 재는 결이 있어요." }],
    ruleIdsUsed: ["TG-JEONGGWAN"],
    claimIdsUsed: ["TG-JEONGGWAN#claim"],
    cta: { type: "comment", text: "댓글로 알려줘요." },
    explanation: "",
    ...over,
  };
}

const postsOf = (draft: ThreadDraftOut): ThreadPostBody[] =>
  draft.posts.map((p) => ({ sequence: p.sequence, body: p.body, charCount: countChars(p.body) }));

function check(
  draft: ThreadDraftOut,
  input = inputWith(),
  allowDirectCopy = false,
  reuseMode: AuthorizedReuseMode = "pattern_only"
) {
  return checkThreadDraft(draft, postsOf(draft), { input, corpus, allowDirectCopy, reuseMode });
}

describe("500자를 넘으면 막는다", () => {
  it("501자는 blocking", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "가".repeat(501) }] });
    const hit = check(draft).violations.filter((v) => v.kind === "길이" && v.blocking);
    assert.equal(hit.length, 1);
  });

  it("500자는 통과한다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "가".repeat(500) }] });
    const hit = check(draft).violations.filter((v) => v.kind === "길이" && v.blocking);
    assert.deepEqual(hit, []);
  });

  it("체인이 6개면 막는다", () => {
    const posts = Array.from({ length: 6 }, (_, i) => ({ sequence: i + 1, body: `${i}번 글이에요.` }));
    const hit = check(draftWith({ posts })).violations.filter((v) => v.kind === "길이" && v.blocking);
    assert.equal(hit.length >= 1, true);
  });
});

describe("승인 사실 밖의 rule / claim은 막는다", () => {
  it("없는 rule_id", () => {
    const hit = check(draftWith({ ruleIdsUsed: ["SIN-DOHWA"] })).violations.filter((v) => v.kind === "사실");
    assert.equal(hit.some((v) => v.blocking && /rule_id/.test(v.detail)), true);
  });

  it("없는 claim_id", () => {
    const hit = check(draftWith({ claimIdsUsed: ["TG-SANGGWAN#claim"] })).violations.filter((v) => v.kind === "사실");
    assert.equal(hit.some((v) => v.blocking && /claim_id/.test(v.detail)), true);
  });

  it("승인 사실을 줬는데 아무 규칙도 안 썼으면 막는다", () => {
    const hit = check(draftWith({ ruleIdsUsed: [] })).violations.filter((v) => v.kind === "사실");
    assert.equal(hit.some((v) => v.blocking), true);
  });
});

describe("입력에 없는 축이 본문에 나타나면 막는다", () => {
  it("순위 입력이 없는데 1위가 나오면", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "1위 정관, 오늘은 먼저 말해도 좋아요." }] });
    const hit = check(draft).violations.filter((v) => v.kind === "사실" && v.blocking);
    assert.equal(hit.some((v) => /순위 표현/.test(v.detail)), true);
  });

  it("TOP5도 잡는다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "이번 주 관계가 열리는 결 TOP5예요." }] });
    assert.equal(
      check(draft).violations.some((v) => v.kind === "사실" && v.blocking),
      true
    );
  });

  it("간지 입력이 없는데 간지가 나오면", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "병오일에는 말이 멀리 가요." }] });
    const hit = check(draft).violations.filter((v) => v.kind === "사실" && v.blocking);
    assert.equal(hit.some((v) => /간지/.test(v.detail)), true);
  });

  // 천간·지지 표를 그대로 이어 붙이면 흔한 낱말이 걸린다. 실제로 "갑자기" 가
  // 갑+자로 잡혀 멀쩡한 초안 하나가 막혔다. 그때 잃은 것은 초안 하나가 아니라
  // 신호다 — 멀쩡한 글이 걸리기 시작하면 blocking 을 아무도 안 본다.
  for (const word of [
    "가까운 사람 앞에서 갑자기 말수가 줄었던 적 있나요.",
    "무술을 배우는 사람에게도 같은 결이 있어요.",
    "관계가 나아질 기미가 보일 때가 있어요.",
    "경신하듯 관계를 다시 세우는 편이에요.",
  ]) {
    it(`흔한 낱말은 간지로 세지 않는다 — "${word.slice(0, 12)}…"`, () => {
      const draft = draftWith({ posts: [{ sequence: 1, body: word }] });
      const hit = check(draft).violations.filter((v) => v.kind === "사실" && /간지/.test(v.detail));
      assert.deepEqual(hit, [], "흔한 낱말을 간지로 잡았다");
    });
  }

  it("색 입력이 없는데 행운색이 나오면", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "오늘 피할 색은 빨강이에요." }] });
    assert.equal(check(draft).violations.some((v) => v.kind === "사실" && v.blocking), true);
  });

  it("입력에 준 순위는 그대로 나와야 한다", () => {
    const input = inputWith({
      variables: {
        date: "2026-08-21",
        ranking: [{ rank: 1, label: "무토" }],
        cta: { type: "comment", text: "댓글로 알려줘요." },
      },
    });
    const draft = draftWith({ posts: [{ sequence: 1, body: "1위는 경금이에요." }] });
    const hit = check(draft, input).violations.filter((v) => v.kind === "사실" && v.blocking);
    assert.equal(hit.some((v) => /무토/.test(v.detail)), true);
  });
});

describe("단정과 브랜드", () => {
  it("단정 표현을 잡는다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "반드시 연락이 와요." }] });
    assert.equal(check(draft).violations.some((v) => v.kind === "단정" && v.blocking), true);
  });

  it("다른 계정 이름이 남으면 잡는다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "안녕, 사주시바야. 오늘 결을 볼게." }] });
    assert.equal(check(draft).violations.some((v) => v.kind === "브랜드" && v.blocking), true);
  });

  it("생년월일시가 본문에 있으면 잡는다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body: "1993년 1월 24일생이라면 이런 결이에요." }] });
    assert.equal(check(draft).violations.some((v) => v.kind === "개인정보" && v.blocking), true);
  });
});

describe("코퍼스 밖 출처는 막는다", () => {
  it("모르는 post_id를 출처로 적으면", () => {
    const draft = draftWith({ benchmarkSourcePostIds: ["OTHER-ACCOUNT-001"] });
    assert.equal(check(draft).violations.some((v) => v.kind === "출처" && v.blocking), true);
  });
});

describe("원문 재사용", () => {
  // 코퍼스에 실제로 있는 문장. 12자보다 길어야 검출된다.
  const lifted = "겉은 세 보이는데 속으로 혼자 우는";
  const SOURCE = "SS-20260805-HIDDEN-PAIN";
  const body = `${lifted} 결이 있어요.`;

  const span = (over: Partial<DirectCopySpan> = {}): DirectCopySpan => ({
    sourcePostId: SOURCE,
    sourceStart: 0,
    sourceEnd: lifted.length,
    text: lifted,
    reuseMode: "verbatim_excerpt",
    ...over,
  });

  it("pattern_only에서 원문을 옮기면 막는다", () => {
    const draft = draftWith({ posts: [{ sequence: 1, body }] });
    const hit = check(draft).violations.filter((v) => v.kind === "재사용" && v.blocking);
    assert.equal(hit.length >= 1, true, "원문 겹침을 놓쳤다");
  });

  it("pattern_only인데 재사용을 신고하면 막는다", () => {
    const draft = draftWith({
      directCopySourcePostIds: [SOURCE],
      directCopySpans: [span()],
    });
    assert.equal(check(draft).violations.some((v) => v.kind === "재사용" && v.blocking), true);
  });

  // 증빙 세 줄이 비어 있는 것이 현재 상태다. 레지스트리가 verbatim_excerpt 를
  // 허용해도, 증빙이 없으면 열리지 않는다는 것을 여기서 붙잡아 둔다.
  it("증빙이 비어 있으면 verbatim_excerpt도 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body }],
      directCopySourcePostIds: [SOURCE],
      directCopySpans: [span()],
    });
    const result = check(draft, inputWith(), true, "verbatim_excerpt");
    assert.equal(result.mustRetry, true, "증빙 없이 열렸다");
    assert.equal(
      result.violations.some((v) => /needs_permission_metadata/.test(v.detail)),
      true,
      "왜 막혔는지가 상태로 남아야 한다"
    );
  });

  it("verbatim_excerpt인데 span이 비면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body }],
      directCopySourcePostIds: [SOURCE],
    });
    const result = check(draft, inputWith(), true, "verbatim_excerpt");
    assert.equal(
      result.violations.some((v) => v.blocking && /directCopySpans 가 비었다/.test(v.detail)),
      true
    );
  });

  it("신고한 구간이 원문에 없으면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "원문에 없는 문장을 옮겼다고 신고해요." }],
      directCopySourcePostIds: [SOURCE],
      directCopySpans: [span({ text: "이 문장은 원문에 없는 말이에요" })],
    });
    const result = check(draft, inputWith(), true, "verbatim_excerpt");
    assert.equal(
      result.violations.some((v) => v.blocking && /원문에 없다/.test(v.detail)),
      true
    );
  });

  it("코퍼스 밖 원문을 재사용으로 신고하면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "아무 말이나 써요." }],
      directCopySourcePostIds: ["OTHER-ACCOUNT-001"],
      directCopySpans: [span({ sourcePostId: "OTHER-ACCOUNT-001" })],
    });
    const result = check(draft, inputWith(), true, "verbatim_excerpt");
    assert.equal(result.mustRetry, true);
  });

  it("문맥이 잘린 원문은 verbatim으로 못 쓴다", () => {
    const truncated = "SS-20260731-WEEKLY-LOVE-REPLIES";
    const draft = draftWith({
      posts: [{ sequence: 1, body: "아무 말이나 써요." }],
      directCopySourcePostIds: [truncated],
      directCopySpans: [span({ sourcePostId: truncated, text: "삼 위, 병오 일주" })],
    });
    const result = check(draft, inputWith(), true, "verbatim_excerpt");
    assert.equal(result.mustRetry, true);
  });

  it("close_adaptation은 span이 비어도 된다", () => {
    const draft = draftWith({
      sourceTransformLog: [
        {
          sourcePostId: SOURCE,
          sourceSection: "훅",
          originalText: "겉은 세 보이는데",
          transformedText: "겉으로는 단단해 보이는데",
          reason: "brand_swap",
        },
      ],
    });
    const result = check(draft, inputWith(), true, "close_adaptation");
    assert.equal(result.mustRetry, false, "변형만 했는데 막혔다");
  });

  it("close_adaptation인데 변형 기록이 없으면 검토로 올린다", () => {
    const result = check(draftWith(), inputWith(), true, "close_adaptation");
    assert.equal(
      result.violations.some((v) => !v.blocking && /무엇을 바꿨는지 기록이 없다/.test(v.detail)),
      true
    );
  });

  it("짧은 관용구는 겹침으로 세지 않는다", () => {
    assert.deepEqual(verbatimOverlap("먼저 연락해 보세요.", corpus), []);
  });
});

describe("원문에 딸려 온 것", () => {
  it("러브레빗 것이 아닌 링크가 남으면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "여기서 확인해요 https://sajushiba.example/app" }],
    });
    assert.equal(check(draft).violations.some((v) => v.kind === "브랜드" && v.blocking), true);
  });

  it("러브레빗 링크는 통과한다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "여기서 확인해요 https://loverebbit.xyz/reading" }],
      cta: { type: "link", text: "링크" },
    });
    assert.deepEqual(
      check(draft).violations.filter((v) => v.kind === "브랜드"),
      []
    );
  });

  it("모집·희소성 조건이 남으면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "테스터 12명을 선착순으로 모아요." }],
    });
    assert.equal(check(draft).violations.some((v) => v.kind === "브랜드" && v.blocking), true);
  });
});

describe("CTA는 하나만", () => {
  it("저장·댓글·링크가 한꺼번에 있으면 막는다", () => {
    const draft = draftWith({
      posts: [{ sequence: 1, body: "저장해두고, 댓글도 남기고, 링크도 눌러줘요 https://a.b" }],
    });
    assert.equal(check(draft).violations.some((v) => v.kind === "CTA" && v.blocking), true);
  });

  it("입력과 다른 CTA 타입이면 막는다", () => {
    const draft = draftWith({ cta: { type: "link", text: "링크" } });
    assert.equal(check(draft).violations.some((v) => v.kind === "CTA" && v.blocking), true);
  });
});

describe("지난 초안과 같은 글은 막는다", () => {
  it("본문이 같으면", () => {
    const posts: ThreadPostBody[] = [{ sequence: 1, body: "같은 글이에요.", charCount: 8 }];
    assert.notEqual(duplicateOfPrevious(posts, ["같은 글이에요."]), null);
  });

  it("다르면 통과한다", () => {
    const posts: ThreadPostBody[] = [{ sequence: 1, body: "다른 글이에요.", charCount: 8 }];
    assert.equal(duplicateOfPrevious(posts, ["같은 글이에요."]), null);
  });
});

describe("멀쩡한 초안은 놓아준다", () => {
  it("위반이 없다", () => {
    const result = check(draftWith());
    assert.deepEqual(
      result.violations.filter((v) => v.blocking),
      []
    );
  });
});
