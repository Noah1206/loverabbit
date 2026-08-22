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

/** 값이 넘어서 반드시 차단되는 모델. 이걸 걸어 두면 호출이 물리적으로 안 나간다. */
function blockCalls() {
  process.env.FREE_PREVIEW_MODEL = "claude-sonnet-5";
}

afterEach(() => {
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
    assert.equal(outcome.result.cards.length, 3);
    assert.ok(outcome.result.paidTeaser.length > 0);
  });

  it("차단된 이유와 추정 금액을 남긴다", async () => {
    blockCalls();
    const { telemetry } = await runFreePreview(input());
    assert.equal(telemetry.model, "claude-sonnet-5");
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
    assert.equal(outcome.result.cards.length, 0);
    assert.equal(outcome.result.selectedEvidenceIds.length, 0);
  });
});

describe("삽화 연결", () => {
  it("카드의 감정 태그로 장면 다섯과 부적 하나가 채워진다", async () => {
    blockCalls();
    const outcome = await runFreePreview(input());
    const tags = emotionTagsForAssets(outcome.result);
    assert.equal(tags.length, 3);

    // 리딩 화면은 자리 여섯을 쓴다. 태그가 셋이어도 빈칸이 남으면 안 된다.
    const images = planImagesFor({
      chapterNumbers: [1, 2, 3, 4, 5],
      chapterEmotionTags: [...tags, [], []],
      chart: "임자 갑진 병오 무신",
    });
    assert.equal(images.length, 6);
    for (const image of images) assert.equal(image.status, "ready");
  });
});
