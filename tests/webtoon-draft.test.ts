import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDraft, guardDraft, parseDraft, type WebtoonDraft } from "../src/lib/webtoon-draft";
import { buildWebtoonContent } from "../src/lib/webtoon-saju";

/** 통과하는 초안 한 벌 — 검사마다 한 곳씩만 망가뜨려 쓴다. */
function goodDraft(patch: Partial<WebtoonDraft> = {}): WebtoonDraft {
  return {
    previewText: "테스터, 이번 흐름은 방향을 먼저 잡는 장이에요. 서두르지 않아도 괜찮아요.",
    previewPoints: ["방향이 먼저예요", "새는 곳을 봐요", "반복이 쌓여요"],
    panelLines: [
      { rabbit: "지금은 방향을 먼저 보는 때야." },
      { subject: "내가 진짜 원하는 게 뭘까?" },
      { rabbit: "하나를 정하면 흐름이 모여." },
      { rabbit: "작은 반복이 결국 남아." },
    ],
    captions: ["방향이 속도를 이겨요.", "쌓이는 건 반복이에요."],
    fullParagraphs: [
      "이번 흐름에서 먼저 볼 것은 들어오는 쪽이 아니라 나가는 쪽의 결이에요. 어디서 새는지 알면 손에 남는 양이 달라져요.",
      "판단 기준을 미리 정해두면 좋아요. 지금 아니면 안 될 것 같은 감각은 대개 속도의 착시예요.",
      "작게 정한 규칙 하나를 끊기지 않게 지키는 것이 큰 결심 여러 번보다 멀리 가요.",
      "미루던 정리가 있다면 이번이 매듭짓기 좋은 때예요. 현실적인 선택이 열쇠예요.",
    ],
    ...patch,
  };
}

describe("초안 파싱", () => {
  it("JSON 앞뒤에 말이 붙어도 읽어낸다", () => {
    const text = `여기 있습니다:\n${JSON.stringify(goodDraft())}\n확인해 주세요.`;
    assert.ok(parseDraft(text));
  });

  it("JSON 이 아니면 버린다", () => {
    assert.equal(parseDraft("문장을 그냥 산문으로 썼습니다"), null);
    assert.equal(parseDraft("{ 깨진 json"), null);
    assert.equal(parseDraft(""), null);
  });

  it("모양이 모자라면 버린다 — 반쯤 맞는 초안이 화면에 서지 않게", () => {
    const cases: Partial<WebtoonDraft>[] = [
      { previewText: "짧음" },
      { previewPoints: ["하나", "둘"] },
      { fullParagraphs: ["하나", "둘", "셋"] },
      { captions: ["하나"] },
      { panelLines: [{ rabbit: "하나" }, { rabbit: "둘" }] },
      { panelLines: [{ rabbit: "하나" }, { rabbit: "둘" }, { rabbit: "셋" }, {}] },
    ];
    for (const patch of cases) {
      assert.equal(parseDraft(JSON.stringify(goodDraft(patch))), null, JSON.stringify(patch));
    }
  });
});

describe("문장 가드", () => {
  it("온전한 초안은 통과한다", () => {
    assert.equal(guardDraft(goodDraft()), true);
  });

  it("단정 표현을 막는다", () => {
    for (const bad of ["반드시 이렇게 돼요", "무조건 좋아져요", "이건 운명이에요", "100% 확실해요"]) {
      assert.equal(guardDraft(goodDraft({ previewText: bad })), false, bad);
    }
  });

  it("결과를 확정하는 말을 막는다", () => {
    assert.equal(guardDraft(goodDraft({ captions: ["곧 이별해요.", "둘째 줄"] })), false);
  });

  it("의료·법률·금융 지시를 막는다", () => {
    const bads = ["처방전을 받아 보세요.", "소송을 준비하세요.", "주식 추천해요."];
    for (const bad of bads) {
      assert.equal(guardDraft(goodDraft({ previewPoints: [bad, "둘", "셋"] })), false, bad);
    }
  });

  it("구조 용어가 독자에게 새는 것을 막는다", () => {
    for (const term of ["식신이 강해요", "신약한 명식이에요", "용신은 물이에요", "일간이 무토예요"]) {
      assert.equal(guardDraft(goodDraft({ fullParagraphs: [term, "둘", "셋", "넷"] })), false, term);
    }
  });

  it("패널 말풍선도 검사한다 — 문단만 보면 말풍선으로 샌다", () => {
    const lines = [{ rabbit: "반드시 이렇게 될 거야." }, { subject: "둘" }, { rabbit: "셋" }, { rabbit: "넷" }];
    assert.equal(guardDraft(goodDraft({ panelLines: lines })), false);
  });
});

describe("초안 덮어쓰기", () => {
  it("그림과 좌표는 그대로 두고 문장만 갈아낀다", () => {
    const base = buildWebtoonContent("money", "테스터");
    const out = applyDraft(base, goodDraft());

    assert.equal(out.panels.length, base.panels.length);
    out.panels.forEach((panel, i) => {
      assert.equal(panel.imageUrl, base.panels[i].imageUrl, "그림이 바뀌었다");
      assert.equal(panel.alt, base.panels[i].alt);
      assert.equal(panel.isPreview, base.panels[i].isPreview);
      assert.equal(panel.overlays.length, base.panels[i].overlays.length);
      panel.overlays.forEach((overlay, j) => {
        const before = base.panels[i].overlays[j];
        assert.equal(overlay.x, before.x, "좌표가 바뀌었다");
        assert.equal(overlay.y, before.y);
        assert.equal(overlay.type, before.type);
      });
    });
    assert.equal(out.coverImageUrl, base.coverImageUrl);
  });

  it("말풍선과 캡션에 초안 문장이 들어간다", () => {
    const base = buildWebtoonContent("money", "테스터");
    const draft = goodDraft();
    const out = applyDraft(base, draft);

    const speech = out.panels.flatMap((p) => p.overlays.filter((o) => o.type === "speech").map((o) => o.text));
    assert.ok(speech.includes(draft.panelLines[0].rabbit!), "1번 말풍선이 안 바뀌었다");
    assert.ok(speech.includes(draft.panelLines[1].subject!), "2번 말풍선이 안 바뀌었다");

    const captions = out.panels.flatMap((p) => p.overlays.filter((o) => o.type === "caption").map((o) => o.text));
    assert.deepEqual(captions, draft.captions);

    assert.equal(out.previewText, draft.previewText);
    assert.deepEqual(out.fullParagraphs, draft.fullParagraphs);
  });

  it("세 운세 모두 같은 규칙으로 덮인다", () => {
    for (const type of ["money", "love", "breakup"] as const) {
      const base = buildWebtoonContent(type, "테스터");
      const out = applyDraft(base, goodDraft());
      assert.equal(out.previewText, goodDraft().previewText);
      assert.equal(out.panels.length, base.panels.length);
    }
  });
});
