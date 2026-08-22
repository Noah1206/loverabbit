// 무료 미리보기가 도는 길.
//
// **이 테스트는 모델을 부르지 않는다.** 부르면 돈이 나가고, 테스트가 돈을 쓰기
// 시작하면 아무도 자주 못 돌린다. 그래서 값이 넘어 차단되는 경로와 캐시 경로만
// 쓴다 - 둘 다 chatComplete 에 닿기 전에 끝난다.
//
// 차단 경로를 고른 것은 겸사겸사다. "상한을 넘으면 정말 안 부르는가" 가
// 이 기능에서 가장 중요한 약속이고, 그걸 확인하는 것이 곧 안전한 테스트다.

import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";

import { clearFreePreviewCache, emotionTagsForAssets, runFreePreview } from "@/lib/free-preview-run";
import { planImagesFor } from "@/lib/reading-asset-plan";
import type { ReadingRule } from "@/lib/reading-rules";

const rule = (id: string): ReadingRule => ({
  id,
  priority: 10,
  when: {},
  claim: "표현이 한 박자 늦게 나간다",
  safePhrasing: "하고 싶은 말이 한 박자 늦게 나오는 편이에요",
  forbidden: [],
  source: "test",
});

const RULES = [rule("TG-SANGGWAN-01"), rule("REL-CHUNG-01"), rule("SIN-HWAGAE-01")];

const input = (overrides: Partial<Parameters<typeof runFreePreview>[0]> = {}) => ({
  rules: RULES,
  product: "sokgunghap",
  relationshipStatus: "dating" as const,
  dayMasterElement: "수" as const,
  normalizedBirthInput: "1993-01-24T14:00|F",
  engineVersion: "e1",
  ruleSetVersion: "r1",
  ...overrides,
});

/**
 * 값이 넘어서 반드시 차단되는 조합. 이걸 걸어 두면 호출이 물리적으로 안 나간다.
 *
 * 제공사도 같이 못 박는다 - 모델 지목은 OpenAI 일 때만 살아 있기 때문이다.
 * (gpt-5-mini 를 Anthropic 에 넘기면 그 호출이 실패하므로 지목을 버린다)
 */
function blockCalls() {
  process.env.AI_PROVIDER = "openai";
  process.env.FREE_PREVIEW_MODEL = "gpt-5.6";
}

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.FREE_PREVIEW_MODEL;
  clearFreePreviewCache();
});

describe("예산 차단", () => {
  it("상한을 넘으면 한 번도 부르지 않는다", async () => {
    blockCalls();
    const outcome = await runFreePreview(input());
    assert.equal(outcome.telemetry.llmCalls, 0);
    assert.equal(outcome.telemetry.source, "fallback");
    assert.match(outcome.telemetry.reason ?? "", /상한/);
  });

  it("차단돼도 화면에 낼 카드 세 장은 나온다", async () => {
    blockCalls();
    const outcome = await runFreePreview(input());
    assert.ok(outcome.result.section.paragraphs.length >= 4);
    assert.ok(outcome.result.paidTeaser.length > 0);
  });

  it("차단된 이유와 추정 금액을 남긴다", async () => {
    blockCalls();
    const { telemetry } = await runFreePreview(input());
    assert.equal(telemetry.model, "gpt-5.6");
    assert.ok((telemetry.estimatedUsd ?? 0) > 0);
  });
});

describe("캐시", () => {
  it("같은 입력을 다시 누르면 값이 0이다", async () => {
    blockCalls();
    const first = await runFreePreview(input());
    const second = await runFreePreview(input());
    assert.equal(first.telemetry.cacheHit, false);
    assert.equal(second.telemetry.cacheHit, true);
    assert.equal(second.telemetry.llmCalls, 0);
    assert.equal(second.telemetry.actualUsd, 0);
  });

  it("규칙 판이 바뀌면 옛 문장을 다시 쓰지 않는다", async () => {
    blockCalls();
    await runFreePreview(input());
    const other = await runFreePreview(input({ ruleSetVersion: "r2" }));
    assert.equal(other.telemetry.cacheHit, false);
  });

  it("다른 사람은 다른 열쇠를 쓴다", async () => {
    blockCalls();
    await runFreePreview(input());
    const other = await runFreePreview(input({ normalizedBirthInput: "1991-07-08T20:00|M" }));
    assert.equal(other.telemetry.cacheHit, false);
  });
});

describe("근거가 모자랄 때", () => {
  it("지어내지 않고, 부르지도 않는다", async () => {
    const outcome = await runFreePreview(input({ rules: [rule("TG-SANGGWAN-01")] }));
    assert.equal(outcome.telemetry.llmCalls, 0);
    assert.equal(outcome.telemetry.reason, "근거 부족");
    assert.equal(outcome.result.section.paragraphs.length, 0);
    assert.equal(outcome.result.selectedEvidenceIds.length, 0);
  });
});

describe("삽화 연결", () => {
  it("카드의 감정 태그로 장면 다섯과 부적 하나가 채워진다", async () => {
    blockCalls();
    const outcome = await runFreePreview(input());
    const tags = emotionTagsForAssets(outcome.result);
    assert.equal(tags.length, 2);

    // 리딩 화면은 자리 여섯을 쓴다. 태그가 셋이어도 빈칸이 남으면 안 된다.
    const images = planImagesFor({
      chapterNumbers: [1, 2, 3, 4, 5],
      chapterEmotionTags: [...tags, [], [], []],
      chart: "임자 갑진 병오 무신",
    });
    assert.equal(images.length, 6);
    for (const image of images) assert.equal(image.status, "ready");
  });
});

describe("모델 지목은 제공사와 맞을 때만 산다", () => {
  it("제공사가 OpenAI 가 아니면 지목을 버린다", async () => {
    // gpt-5-mini 를 Anthropic 에 넘기면 그 호출은 실패하고, 무료 미리보기가
    // 통째로 폴백으로 떨어진다 - 화면은 멀쩡해 보이고 문장만 통조림이 된다.
    process.env.AI_PROVIDER = "anthropic";
    process.env.FREE_PREVIEW_MODEL = "gpt-5.6";
    const { telemetry } = await runFreePreview(input());
    // 지목이 살아 있었다면 gpt-5.6 값으로 계산돼 예산에서 막혔을 것이다.
    assert.notEqual(telemetry.reason, undefined);
    assert.notEqual(telemetry.model, "gpt-5.6");
  });
});
