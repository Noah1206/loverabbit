import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  FREE_PREVIEW_LIMITS,
  FREE_PREVIEW_SYSTEM_PROMPT,
  buildFreePreviewFallback,
  buildFreePreviewPrompt,
  buildPreviewFactPacket,
  checkFreePreviewBudget,
  previewCacheKey,
  toSentence,
  validateFreePreview,
  type FreePreviewResult,
  type PreviewFactPacket,
} from "@/lib/free-preview";
import { estimateTokens } from "@/lib/ai-pricing";
import type { ReadingRule } from "@/lib/reading-rules";

const rule = (id: string, claim = "표현이 한 박자 늦게 나간다", forbidden: string[] = []): ReadingRule => ({
  id,
  priority: 10,
  when: {},
  claim,
  safePhrasing: "하고 싶은 말이 한 박자 늦게 나오는 편이에요",
  forbidden,
  source: "test",
});

const packetOf = (rules: ReadingRule[]) =>
  buildPreviewFactPacket({
    rules,
    product: "sokgunghap",
    relationshipStatus: "dating",
    dayMasterElement: "수",
  });

const RULES = [rule("TG-SANGGWAN-01"), rule("REL-CHUNG-01"), rule("SIN-HWAGAE-01"), rule("LUCK-YEAR-01")];

describe("근거 패킷", () => {
  it("같은 규칙군은 하나만 싣는다", () => {
    const packet = packetOf([rule("TG-SANGGWAN-01"), rule("TG-SANGGWAN-02"), rule("REL-CHUNG-01"), rule("SIN-HWAGAE-01")]);
    const families = packet!.evidence.map((e) => e.sourceRuleId.split("-").slice(0, 2).join("-"));
    assert.equal(new Set(families).size, families.length);
  });

  it("근거가 셋도 안 되면 만들지 않는다 — 지어내서 채우지 않는다", () => {
    assert.equal(packetOf([rule("TG-SANGGWAN-01"), rule("REL-CHUNG-01")]), null);
  });

  it("다섯 개를 넘기지 않는다", () => {
    const many = ["A-1", "B-1", "C-1", "D-1", "E-1", "F-1", "G-1"].map((id) => rule(id));
    assert.equal(packetOf(many)!.evidence.length, FREE_PREVIEW_LIMITS.maxEvidence);
  });

  it("basis 와 allowedMeaning 을 상한까지 줄인다", () => {
    const packet = packetOf([rule("A-1", "가".repeat(300)), rule("B-1"), rule("C-1")])!;
    assert.ok((packet.evidence[0].basis.length) <= (FREE_PREVIEW_LIMITS.maxBasisChars));
    assert.ok((packet.evidence[0].allowedMeaning.length) <= (FREE_PREVIEW_LIMITS.maxMeaningChars));
  });

  it("규칙 앞머리로 주제를 가른다", () => {
    const packet = packetOf(RULES)!;
    const byId = Object.fromEntries(packet.evidence.map((e) => [e.sourceRuleId, e.subject]));
    assert.equal(byId["REL-CHUNG-01"], "relationship");
    assert.equal(byId["LUCK-YEAR-01"], "timing");
    assert.equal(byId["TG-SANGGWAN-01"], "self");
  });
});

describe("예산 차단선", () => {
  it("슬림 프롬프트는 입력 상한 안에 들어온다", () => {
    const packet = packetOf(RULES)!;
    const verdict = checkFreePreviewBudget(packet, "gpt-5-mini");
    assert.equal(verdict.ok, true);
    assert.ok((verdict.estimatedInputTokens) <= (FREE_PREVIEW_LIMITS.maxInputTokensEstimated));
  });

  it("설계가 잡은 소프트 상한 안에서 끝난다", () => {
    const verdict = checkFreePreviewBudget(packetOf(RULES)!, "gpt-5-mini");
    assert.notEqual(verdict.estimatedUsd, null);
    assert.ok((verdict.estimatedUsd!) <= (FREE_PREVIEW_LIMITS.llmSoftUsd));
  });

  it("비싼 모델이면 부르기 전에 막는다", () => {
    const verdict = checkFreePreviewBudget(packetOf(RULES)!, "claude-sonnet-5");
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason ?? "", /상한/);
  });

  it("단가를 모르는 모델은 금액으로 막지 못한다는 사실을 남긴다", () => {
    const verdict = checkFreePreviewBudget(packetOf(RULES)!, "무명모델");
    assert.equal(verdict.ok, true);
    assert.equal(verdict.estimatedUsd, null);
  });

  it("유료 리포트 프롬프트는 이 상한을 못 지킨다 — 슬림을 따로 둔 이유", () => {
    // 유료 시스템 프롬프트는 11,453자다. 그 하나만으로 이미 상한을 넘는다.
    assert.ok((estimateTokens(11_453)) > (FREE_PREVIEW_LIMITS.maxInputTokensEstimated));
    assert.ok((estimateTokens(FREE_PREVIEW_SYSTEM_PROMPT.length)) < (FREE_PREVIEW_LIMITS.maxInputTokensEstimated));
  });
});

describe("응답 검사", () => {
  const packet = packetOf(RULES)!;
  const ok = (): FreePreviewResult => ({
    hook: "먼저 말하지 못하고 삼키는 밤이 있어요.",
    summary: "지금은 결론보다 서로의 속도를 확인하는 구간으로 보여요.",
    cards: packet.evidence.slice(0, 3).map((e) => ({
      title: "관계에서의 나",
      paragraphs: ["하고 싶은 말이 한 박자 늦게 나오는 편이야.", "그래서 먼저 꺼내는 쪽이 늘 상대가 되기도 해."],
      evidenceIds: [e.sourceRuleId],
      emotionTags: ["망설임" as const],
    })),
    reflectionQuestion: "내가 확인하고 싶은 건 상대의 답일까요, 내 기준일까요?",
    paidTeaser: "연락의 타이밍과 관계의 갈림길은 심화 리딩에서 더 볼 수 있어요.",
    selectedEvidenceIds: packet.evidence.slice(0, 3).map((e) => e.sourceRuleId),
  });

  it("정상 응답은 통과한다", () => {
    assert.equal(validateFreePreview(ok(), packet).ok, true);
  });

  it("패킷에 없는 근거를 붙이면 잡는다", () => {
    const bad = ok();
    bad.cards[0].evidenceIds = ["없는규칙-99"];
    const result = validateFreePreview(bad, packet);
    assert.equal(result.ok, false);
    assert.match(result.problems.join(" "), /패킷에 없다/);
  });

  it("확정 표현을 잡는다", () => {
    const bad = ok();
    bad.paidTeaser = "두 분은 반드시 재회합니다.";
    assert.equal(validateFreePreview(bad, packet).ok, false);
  });

  it("의료·투자 영역의 말을 잡는다", () => {
    const bad = ok();
    bad.summary = "우울증 진단을 받아보는 편이 좋아요.";
    assert.equal(validateFreePreview(bad, packet).ok, false);
  });

  it("그 규칙이 금지한 표현을 잡는다", () => {
    const withBan = packetOf([rule("A-1", "근거", ["바람"]), rule("B-1"), rule("C-1")])!;
    const bad = ok();
    bad.cards = withBan.evidence.slice(0, 3).map((e) => ({
      title: "관계에서의 나",
      paragraphs: ["상대에게 바람 기운이 보여."],
      evidenceIds: [e.sourceRuleId],
      emotionTags: ["망설임" as const],
    }));
    bad.selectedEvidenceIds = withBan.evidence.slice(0, 3).map((e) => e.sourceRuleId);
    assert.equal(validateFreePreview(bad, withBan).ok, false);
  });
});

describe("폴백", () => {
  it("모델 없이도 카드 세 장을 만든다", () => {
    const packet = packetOf(RULES)!;
    const fallback = buildFreePreviewFallback(packet);
    assert.equal((fallback.cards).length, 3);
    assert.equal(validateFreePreview(fallback, packet).ok, true);
  });

  it("폴백도 승인된 근거만 가리킨다", () => {
    const packet = packetOf(RULES)!;
    const allowed = new Set(packet.evidence.map((e) => e.sourceRuleId));
    for (const id of buildFreePreviewFallback(packet).selectedEvidenceIds) {
      assert.equal(allowed.has(id), true);
    }
  });
});

describe("캐시 열쇠", () => {
  const base = {
    normalizedBirthInput: "1996-04-09T13:00|F",
    relationshipStatus: "dating" as const,
    product: "sokgunghap",
    engineVersion: "e1",
    ruleSetVersion: "r1",
  };

  it("같은 입력은 같은 열쇠", () => {
    assert.equal(previewCacheKey(base), previewCacheKey({ ...base }));
  });

  it("규칙이 바뀌면 열쇠가 바뀐다 — 옛 문장이 남으면 안 된다", () => {
    assert.notEqual(previewCacheKey(base), previewCacheKey({ ...base, ruleSetVersion: "r2" }));
  });

  it("생년 정보가 열쇠에 그대로 남지 않는다", () => {
    assert.ok(!(previewCacheKey(base)).includes("1996"));
  });
});

describe("프롬프트", () => {
  it("사용자 프롬프트에 패킷이 통째로 들어간다", () => {
    const packet = packetOf(RULES)!;
    assert.ok((buildFreePreviewPrompt(packet)).includes(packet.evidence[0].sourceRuleId));
  });

  it("시스템 프롬프트가 규칙 id 노출을 막는다", () => {
    assert.match(FREE_PREVIEW_SYSTEM_PROMPT, /rule IDs/);
  });
});

describe("문장 맺기", () => {
  // 규칙 71개의 claim 이 전부 명사로 끝난다. 그대로 화면에 놓으면 말이 끊긴다.
  it("받침이 있으면 이야, 없으면 야", () => {
    assert.equal(toSentence("그런 진폭을 가진 편"), "그런 진폭을 가진 편이야");
    assert.equal(toSentence("온도가 오르내리는 구조"), "온도가 오르내리는 구조야");
    assert.equal(toSentence("말이 앞서는 흐름"), "말이 앞서는 흐름이야");
  });

  it("이미 문장이면 그대로 둔다", () => {
    assert.equal(toSentence("먼저 말하지 못할 때가 있어"), "먼저 말하지 못할 때가 있어");
    assert.equal(toSentence("그런 편이다"), "그런 편이다");
  });

  it("한글이 아니면 손대지 않는다", () => {
    assert.equal(toSentence("TG-SANGGWAN"), "TG-SANGGWAN");
  });
});

describe("폴백은 토막이 아니라 문장이다", () => {
  // 실제로 뽑아 보고 알았다. allowedMeaning 은 "그 자리에 걸려 있는" 같은
  // 조각이라, 그걸 훅에 쓰면 말이 끊긴 채로 나간다. 폴백은 모델이 실패할
  // 때마다 나가는 문장이라 그 상태로 켰으면 실패한 사람 전원이 그걸 봤다.
  const packet = buildPreviewFactPacket({
    rules: [
      rule("A-1", "마음이 붙는 속도는 빠른데 그 열을 오래 유지하지 못하는 구조"),
      rule("B-1", "표현이 앞서 나가 상대가 따라오기 전에 먼저 달아오르는 편"),
      rule("C-1", "자기 요구를 뒤로 미루고 그것이 서운함으로 남는 경향"),
    ],
    product: "sokgunghap",
    relationshipStatus: "dating",
    dayMasterElement: "수",
  })!;

  it("훅과 카드가 모두 문장으로 끝난다", () => {
    const fallback = buildFreePreviewFallback(packet);
    assert.match(fallback.hook, /(야|어|아|지|다)[.]?$/);
    for (const card of fallback.cards) assert.match(card.paragraphs[0], /(야|어|아|지|다)[.]?$/);
  });

  it("조각(allowedMeaning)을 본문에 쓰지 않는다", () => {
    const fragment = packet.evidence[0].allowedMeaning;
    const fallback = buildFreePreviewFallback(packet);
    assert.notEqual(fallback.hook, fragment);
    assert.notEqual(fallback.cards[0].paragraphs[0], fragment);
  });
});
