// 무료 초안과 결제 후 본문이 한 리포트로 이어지는가.
//
// 이 테스트가 지키는 것은 한 줄짜리 조기 반환이다. finishReading 은 원래 부분
// 리포트가 없으면 그 자리에서 포기했다 - 발급 때 머리를 이미 만들어 두는 것이
// 전제였기 때문이다. 예전 FREE_PREVIEW_V2 는 결제 전에 유료 본문을 한 절도 만들지
// 않았고, 지금 경로는 반대로 머리와 첫 절을 서버에 확정해 둔다.
//
// 그대로 뒀으면 무료는 86% 싸지고 유료는 통째로 사라졌을 것이다. 그리고 그
// 사실은 결제한 사람이 화면을 보고서야 드러난다.
//
// **모델을 부르지 않는다.** finishReading 은 complete 를 주입받게 돼 있어서,
// 아무것도 못 만드는 가짜를 넣고 "어디까지 갔는가" 만 본다.

import { strict as assert } from "node:assert";
import { after, describe, it } from "node:test";

import { finishReading } from "@/lib/reading-finish";
import { clearResume, saveResume } from "@/lib/reading-resume";
import { buildSajuFacts } from "@/lib/saju-facts";
import { PRODUCT_MAP } from "@/lib/products";
import type { StructuredReport } from "@/lib/reading-prompt";
import type { StoredReading } from "@/lib/store";

const READING_ID = "00000000-0000-4000-8000-000000000abc";
const facts = buildSajuFacts({ year: 1993, month: 1, day: 24, hour: 14, gender: "F" });

const stored = {
  id: READING_ID,
  category: "sokgunghap",
  teaser: "무료 때 쓴 훅",
  full: "",
  unlocked: true,
} as unknown as StoredReading;

/** 한 조각도 못 만드는 가짜 생성기. 네트워크에 나가지 않는다. */
const deadModel = async () => null;

const firstTitle = PRODUCT_MAP.sokgunghap.toc[0];
const partialReport: StructuredReport = {
  meta: {
    title: "",
    headline: "무료에서 확정한 머리",
    readingTimeMin: 6,
    disclaimer: "오락 및 자기성찰을 위한 참고 해석이에요.",
    confidenceNote: "",
  },
  summaryCards: [],
  sections: [
    {
      id: "core",
      navLabel: firstTitle,
      title: firstTitle,
      verdict: "무료에서 본 결론",
      summary: "무료에서 본 요약",
      paragraphs: ["이 문단은 결제 뒤에도 바뀌면 안 된다."],
      factsUsed: [],
      ruleIds: [],
    },
  ],
  actionQuestions: [],
  nextStep: null,
};

after(async () => {
  await clearResume(READING_ID).catch(() => {});
});

describe("결제 후 이어 만들기", () => {
  it("부분 리포트가 없어도 만들기를 시도한다", async () => {
    await saveResume(READING_ID, {
      category: "sokgunghap",
      facts,
      partnerFacts: null,
      ruleIds: [],
      currentScene: "",
      issuedAt: new Date(2026, 7, 22).toISOString(),
      doneSections: 0,
    });

    const result = await finishReading({
      readingId: READING_ID,
      stored,
      // 슬림 경로는 여기가 비어 있다. 예전에는 이것 때문에 그냥 포기했다.
      partialReport: null,
      storedFull: "",
      complete: deadModel,
    });

    // generated=true 가 핵심이다. 조기 반환이었다면 false 였다 -
    // "시도조차 안 했다" 와 "시도했는데 모델이 죽었다" 는 다른 사건이다.
    assert.equal(result.generated, true);
    // 모델이 죽었으니 미완성인 것은 맞다. 그건 모델 문제지 구조 문제가 아니다.
    assert.equal(result.incomplete, true);
  });

  it("브라우저 blob이 없어도 서버에 저장한 첫 절을 복원한다", async () => {
    await saveResume(READING_ID, {
      category: "sokgunghap",
      facts,
      partnerFacts: null,
      ruleIds: [],
      currentScene: "",
      issuedAt: new Date(2026, 7, 23).toISOString(),
      doneSections: 1,
      outline: PRODUCT_MAP.sokgunghap.toc,
      partialReport,
      provider: "openai",
      model: "gpt-5.6",
      promptVersion: "reading-v3-continuous-preview",
    });

    const calls: string[] = [];
    const result = await finishReading({
      readingId: READING_ID,
      stored,
      // 다른 기기에서 결제하면 클라이언트 blob이 없을 수 있다.
      partialReport: null,
      storedFull: "",
      complete: async (_system, user) => {
        calls.push(user);
        return null;
      },
    });

    assert.equal(result.generated, true);
    assert.equal(result.incomplete, true);
    assert.equal(result.report?.sections[0].title, firstTitle);
    assert.equal(result.report?.sections[0].paragraphs[0], partialReport.sections[0].paragraphs[0]);
    assert.equal(calls.some((prompt) => prompt.startsWith("지시: 머리")), false);
  });

  it("재개 정보가 아예 없으면 옛 리딩으로 보고 손대지 않는다", async () => {
    await clearResume(READING_ID).catch(() => {});
    const result = await finishReading({
      readingId: READING_ID,
      stored,
      partialReport: null,
      storedFull: "옛 리딩의 전문",
      complete: deadModel,
    });
    assert.equal(result.generated, false);
    assert.equal(result.full, "옛 리딩의 전문");
  });
});
