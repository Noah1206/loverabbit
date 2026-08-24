// 패턴이 정한 말투를 초안이 지켰는가.
//
// 지금까지 가드는 "한 초안 안에서 섞이지 마라"만 봤고 어느 쪽인지는 안 봤다.
// 그래서 SS-P03(반말이 규격) 으로 쓴 존댓말 초안이 그대로 draft 로 통과했고,
// 다음 주 리뷰가 그 이탈본을 기준 삼아 정상본(반말)을 존댓말로 고치라고
// 두 번 지목했다. 모델은 두 번 다 반말로 냈다 — 모델이 맞았다.
//
// 이 테스트는 실제 패턴 라이브러리를 그대로 읽는다. 가짜 패턴을 지어내면
// 규격이 바뀌었을 때 테스트만 혼자 통과한다.

import assert from "node:assert/strict";
import test from "node:test";

import { checkThreadDraft, patternTone } from "@/lib/threads-guard";
import { countChars } from "@/lib/threads-content";
import library from "@/content/reference/sajushiba/pattern-library.v1.json";
import type { SajushibaPattern } from "@/lib/threads-corpus";
import type { ThreadDraftOut } from "@/lib/threads-prompt";

const patterns = (library as { patterns: SajushibaPattern[] }).patterns;
const byId = (id: string) => patterns.find((p) => p.id === id)!;

test("style_markers 에 적힌 말투가 곧 선언이다", () => {
  const p3 = byId("SS-P03-SECRET-INSIDE-OUTSIDE");
  assert.ok(p3.style_markers.some((m) => m.includes("반말")));
  assert.equal(patternTone(p3), "casual");
});

test("선언이 없으면 패턴 자신의 공식 문장에서 잰다", () => {
  // 이 둘은 style_markers 에 말투가 없다. 공식이 존댓말로 끝난다.
  assert.equal(patternTone(byId("SS-P01-WEEKLY-TOP-RANKING")), "polite");
  assert.equal(patternTone(byId("SS-P02-DAILY-12-ZODIAC-BOARD")), "polite");
  // 이쪽은 공식이 반말이다.
  assert.equal(patternTone(byId("SS-P05-WARNING-WITH-RELIEF")), "casual");
  assert.equal(patternTone(byId("SS-P06-TECHNICAL-TO-EVERYDAY")), "casual");
});

test("판정이 안 서면 아무 말도 하지 않는다 — 애매한 것을 우기지 않는다", () => {
  // SS-P04 는 공식이 말투를 드러내지 않는다. 여기서 억지로 한쪽을 고르면
  // 멀쩡한 초안이 매번 사람 손으로 넘어간다.
  assert.equal(patternTone(byId("SS-P04-FREE-READING-GATE")), null);
  assert.equal(patternTone(undefined), null);
});

test("패턴 여덟 개가 전부 판정되거나, 판정 안 된 것이 무엇인지 드러난다", () => {
  const undecided = patterns.filter((p) => patternTone(p) === null).map((p) => p.id);
  // 지금은 SS-P04 하나다. 늘어나면 이 테스트가 먼저 알려준다 —
  // 말투를 안 보는 패턴이 조용히 늘어나는 것이 이 검사가 무력해지는 길이다.
  assert.deepEqual(undecided, ["SS-P04-FREE-READING-GATE"]);
});

// ── 실제로 가드를 통과시켜 본다 ──
//
// patternTone 이 맞아도 checkThreadDraft 가 그 값을 안 쓰면 아무 일도 안 일어난다.
// 8/20 이탈본이 통과한 것이 정확히 그 모양이었다.

const P3 = byId("SS-P03-SECRET-INSIDE-OUTSIDE");

const input = {
  id: "t1",
  contentLane: "inner_world",
  goal: "engagement",
  selectedPatternId: P3.id,
  approvedFacts: [
    { ruleId: "TG-JEONGGWAN", claimId: "TG-JEONGGWAN#claim", safePhrasing: "그런 결", scope: "기질" },
  ],
  variables: { date: "2026-08-21", cta: { type: "comment", text: "댓글로 알려줘요." } },
} as unknown as Parameters<typeof checkThreadDraft>[2]["input"];

const draftWith = (body: string): ThreadDraftOut =>
  ({
    patternId: P3.id,
    benchmarkSourcePostIds: ["SS-20260805-HIDDEN-PAIN"],
    directCopySourcePostIds: [],
    directCopyExcerpts: [],
    directCopySpans: [],
    sourceTransformLog: [],
    posts: [{ sequence: 1, body }],
    ruleIdsUsed: ["TG-JEONGGWAN"],
    claimIdsUsed: ["TG-JEONGGWAN#claim"],
    cta: { type: "comment", text: "댓글로 알려줘요." },
    explanation: "",
  }) as unknown as ThreadDraftOut;

const toneHits = (body: string, pattern?: SajushibaPattern) => {
  const draft = draftWith(body);
  const posts = draft.posts.map((p) => ({
    sequence: p.sequence,
    body: p.body,
    charCount: countChars(p.body),
  }));
  return checkThreadDraft(draft, posts, {
    input,
    corpus: [],
    allowDirectCopy: false,
    reuseMode: "pattern_only",
    pattern,
  }).violations.filter((v) => v.kind === "말투" && v.detail.includes("규격"));
};

test("반말 규격 패턴에 존댓말로 쓰면 잡는다 — 8/20 이탈본이 통과하던 자리", () => {
  const polite = "겉으로는 단단해 보여요. 속으로는 오래 재는 결이 있어요. 그건 약해서가 아니에요.";
  assert.equal(toneHits(polite, P3).length, 1);
});

test("규격대로 반말로 쓰면 안 잡는다 — 8/24 정상본", () => {
  const casual = "겉으로는 단단해 보이지. 속으로는 오래 재는 결이 있어. 그건 약해서가 아니야.";
  assert.equal(toneHits(casual, P3).length, 0);
});

test("패턴을 안 넘기면 예전처럼 아무 말도 안 한다 — 다른 호출부를 깨지 않는다", () => {
  const polite = "겉으로는 단단해 보여요. 속으로는 오래 재는 결이 있어요. 그건 약해서가 아니에요.";
  assert.equal(toneHits(polite, undefined).length, 0);
});

test("막지는 않는다 — 사람이 보게만 한다", () => {
  const polite = "겉으로는 단단해 보여요. 속으로는 오래 재는 결이 있어요. 그건 약해서가 아니에요.";
  for (const hit of toneHits(polite, P3)) assert.equal(hit.blocking, false);
});

test("한쪽이 한 문장 섞여도 규격은 흔들리지 않는다", () => {
  // SS-P03 공식에는 존댓말로 끝나는 줄이 하나 있다(hook_formula 의 "있습니다").
  // 그 한 줄 때문에 반말 규격이 뒤집히면 안 된다.
  const p3 = byId("SS-P03-SECRET-INSIDE-OUTSIDE");
  assert.ok(/습니다/.test(p3.hook_formula));
  assert.equal(patternTone(p3), "casual");
});
