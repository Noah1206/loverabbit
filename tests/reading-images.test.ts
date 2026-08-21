// 그림 지시문 — 여기서 막지 못하면 사용자의 실제 연인이 그려진다.
//
// 프롬프트에 "얼굴을 그리지 마라" 를 적어 두긴 했지만, 지시만으로는 부족하다.
// 모델은 "뒷모습이니까 괜찮겠지" 같은 판단을 끼워 넣고, 그 판단은 선을 넘는다.
// 그래서 나온 지시문을 한 번 더 거른다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { __test } from "@/lib/reading-images";

const chapters = [
  { chapter: 1, title: "끌림의 이유", gist: "요약" },
  { chapter: 2, title: "남은 마음", gist: "요약" },
];

const parse = (rows: unknown) => __test.parsePrompts(JSON.stringify({ prompts: rows }), chapters);

describe("선을 넘은 지시문은 그림을 그리지 않는다", () => {
  for (const [label, prompt] of [
    ["얼굴", "여자의 얼굴이 클로즈업된 장면. 표정이 잘 보인다."],
    ["표정", "창가에 앉은 사람의 표정을 담는다."],
    ["두 사람", "두 사람이 마주 앉아 이야기하는 카페."],
    ["간판", "네온 간판에 '재회'라고 적혀 있다."],
    ["점집 소품", "책상 위에 부적과 사주 도표가 놓여 있다."],
    ["고통", "눈물을 흘리며 쓰러진 사람."],
  ] as [string, string][]) {
    it(label, () => {
      const out = parse([{ chapter: 1, prompt, alt: "설명" }]);
      assert.deepEqual(out, [], `걸러지지 않았다: ${prompt}`);
    });
  }
});

describe("괜찮은 지시문은 통과시킨다", () => {
  it("장소·빛·사물 하나", () => {
    const prompt =
      "새벽 다섯 시, 한국 도시의 버스 정류장. 벤치에 놓인 식은 커피 한 잔만 보인다. 결이 고운 일러스트, 절제된 색.";
    const out = parse([{ chapter: 1, prompt, alt: "새벽 정류장의 빈 벤치" }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].chapter, 1);
    assert.equal(out[0].alt, "새벽 정류장의 빈 벤치");
  });

  it("한 장이 걸려도 나머지는 살린다", () => {
    const out = parse([
      { chapter: 1, prompt: "얼굴이 보이는 장면", alt: "a" },
      { chapter: 2, prompt: "늦은 밤 아파트 복도의 센서등. 결이 고운 일러스트.", alt: "b" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].chapter, 2);
  });
});

describe("망가진 응답에도 터지지 않는다", () => {
  it("모르는 장 번호는 버린다", () => {
    assert.deepEqual(parse([{ chapter: 99, prompt: "빈 골목", alt: "a" }]), []);
  });

  it("지시문이 비어 있으면 버린다", () => {
    assert.deepEqual(parse([{ chapter: 1, prompt: "  ", alt: "a" }]), []);
  });

  it("JSON 이 아니면 빈 배열", () => {
    assert.deepEqual(__test.parsePrompts("이건 JSON이 아니에요", chapters), []);
  });

  it("코드펜스에 싸여 와도 읽는다", () => {
    const body = '```json\n{"prompts":[{"chapter":1,"prompt":"빈 정류장","alt":"a"}]}\n```';
    assert.equal(__test.parsePrompts(body, chapters).length, 1);
  });
});
