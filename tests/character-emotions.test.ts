// 신당 캐릭터의 표정이 지켜야 하는 것 두 가지.
//
//  1. 모델이 붙인 [emotion:...] 꼬리표는 화면에도 이력에도 남으면 안 된다.
//     남으면 손님이 그걸 읽게 되고, 다음 턴에 모델이 자기가 쓴 꼬리표를 대사의
//     일부로 흉내 내기 시작한다.
//  2. 꼬리표가 없어도 표정은 나와야 한다. 모델이 규칙을 잊는 날이 반드시 있고,
//     그날 얼굴이 통째로 멈추면 안 된다 - 지문에서 읽어낸다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { extractEmotionTag, inferEmotion, resolveEmotion } from "@/lib/character-emotions";

describe("표정 꼬리표", () => {
  it("꼬리표를 떼어내고 값을 돌려준다", () => {
    const { text, emotion } = extractEmotionTag("*눈을 마주친다*\n\n오랜만이네.\n[emotion:tease]");
    assert.equal(emotion, "tease");
    assert.ok(!text.includes("emotion"), "꼬리표가 본문에 남았다");
    assert.ok(text.includes("오랜만이네."));
  });

  it("모르는 값은 없는 것으로 친다", () => {
    const { emotion } = extractEmotionTag("어서 와.\n[emotion:잘모르겠음]");
    assert.equal(emotion, null);
  });

  it("꼬리표가 없으면 본문을 그대로 둔다", () => {
    const { text, emotion } = extractEmotionTag("어서 와.");
    assert.equal(emotion, null);
    assert.equal(text, "어서 와.");
  });
});

describe("지문에서 표정 추측", () => {
  it("지문의 낱말로 표정을 고른다", () => {
    assert.equal(inferEmotion("*볼이 발그레해져 눈을 피한다*\n\n...뭐야."), "shy");
    assert.equal(inferEmotion("*인상을 찌푸리며 고개를 젓는다*\n\n그건 아니지."), "disgust");
    assert.equal(inferEmotion("*눈을 크게 뜨고 멈칫한다*\n\n지금 뭐라고?"), "surprise");
  });

  it("지문이 없으면 평온으로 둔다", () => {
    assert.equal(inferEmotion("그래서 그 사람은 뭐라던데?"), "idle");
  });

  it("대사에 있는 낱말에는 흔들리지 않는다 — 지문만 본다", () => {
    // 손님이 웃긴 얘기를 했다고 도령이 웃는 것은 아니다.
    assert.equal(inferEmotion("*조용히 향로를 바라본다*\n\n웃음이 나올 일은 아니야."), "idle");
  });

  it("눈을 피하는 웃음은 웃음이 아니라 부끄러움이다", () => {
    assert.equal(inferEmotion("*웃으며 시선을 돌린다*"), "shy");
  });
});

describe("resolveEmotion", () => {
  it("꼬리표가 있으면 그것을 쓴다", () => {
    const { emotion } = resolveEmotion("*고개를 젓는다*\n\n아니야.\n[emotion:sad]");
    assert.equal(emotion, "sad", "꼬리표가 지문 추측을 이겨야 한다");
  });

  it("꼬리표가 없으면 지문으로 내려간다", () => {
    const { text, emotion } = resolveEmotion("*볼이 붉어진다*\n\n...그런 말 하지 마.");
    assert.equal(emotion, "shy");
    assert.ok(text.startsWith("*볼이 붉어진다*"));
  });

  it("어느 경우에도 표정 하나는 반드시 나온다", () => {
    for (const sample of ["", "안녕", "*무표정하다*", "[emotion:???]"]) {
      assert.ok(resolveEmotion(sample).emotion, `표정이 비었다: ${sample}`);
    }
  });
});
