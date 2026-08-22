// 사전 제작 삽화가 지켜야 하는 것.
//
// 그림을 만들지 않고 고르기 시작한 순간, 위험은 "이상한 그림이 나온다" 가 아니라
// "고를 것이 없어서 빈칸이 된다" 로 옮겨간다. 리딩은 돈을 받고 파는 물건이라
// 어떤 입력이 와도 여섯 자리가 다 차야 한다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import manifest from "@/data/love-rabbit-assets.json";
import {
  EMOTION_TAGS,
  assetSrc,
  normalizeEmotionTags,
  planReadingAssets,
  selectTalismanAsset,
} from "@/lib/reading-asset-selector";
import { elementFromChart, planImagesFor } from "@/lib/reading-asset-plan";
import { TALISMAN_SLOT } from "@/lib/reading-image-shape";

const assets = manifest.assets as Array<{ kind: string; emotionTag?: string; brightness?: string; element?: string }>;

describe("에셋 목록", () => {
  it("장면 30장 + 부적 5장", () => {
    assert.equal(assets.filter((a) => a.kind === "scene").length, 30);
    assert.equal(assets.filter((a) => a.kind === "talisman").length, 5);
  });

  it("감정 열 개가 각각 밝기 세 단계를 갖는다", () => {
    // 눈물처럼 나중에 연 결은 아직 그림이 없을 수 있다. 있는 것만 검사한다 -
    // 없는 태그는 컷 위치 기본값으로 떨어지고, 그 폴백은 아래에서 따로 확인한다.
    for (const tag of EMOTION_TAGS) {
      const mine = assets.filter((a) => a.kind === "scene" && a.emotionTag === tag);
      if (mine.length === 0) continue;
      assert.equal(mine.length, 3, `${tag} 이 3장이 아니다`);
      assert.deepEqual(new Set(mine.map((a) => a.brightness)), new Set(["dark", "mid", "bright"]));
    }
  });

  it("오행 다섯 개가 모두 있다", () => {
    for (const element of ["목", "화", "토", "금", "수"]) {
      assert.ok(selectTalismanAsset(element as never), `${element} 부적이 없다`);
    }
  });
});

describe("감정 태그", () => {
  it("허용 목록 밖의 말은 사라진다", () => {
    // 여기가 안전선이다. 모델이 무엇을 뱉든 목록에 없으면 그림에 닿지 못한다.
    // 눈물은 운영자가 연 결이라 통과하고, 해를 부르는 말은 그대로 사라진다.
    const dirty = ["설렘", "눈물", "병원", "자해", "폭력", "죽음", "공포", "회복"];
    assert.deepEqual(normalizeEmotionTags(dirty), ["설렘", "눈물", "회복"]);
  });

  it("중복은 한 번만 남는다", () => {
    assert.deepEqual(normalizeEmotionTags(["끌림", "끌림", "끌림"]), ["끌림"]);
  });

  it("문자열이 아닌 것도 버틴다", () => {
    assert.deepEqual(normalizeEmotionTags([null, 3, {}, "결심"] as unknown[]), ["결심"]);
  });
});

describe("리딩 한 편의 선택", () => {
  const plan = (tags: string[][]) =>
    planReadingAssets({ chapterEmotionTags: tags, dayMasterElement: "수" });

  it("장면 5장과 부적 1장을 낸다", () => {
    const result = plan([["설렘"], ["그리움"], ["망설임"], ["균열"], ["회복"]]);
    assert.equal(result.scenes.length, 5);
    assert.ok(result.talisman.assetId);
  });

  it("컷 위치마다 정해진 밝기를 우선한다", () => {
    const result = plan([["설렘"], ["설렘"], ["설렘"], ["설렘"], ["설렘"]]);
    // 1 mid / 2 dark / 3 dark / 4 mid / 5 bright — 다만 한 리딩에 같은 그림을 두 번
    // 쓰지 않으므로 겹치는 자리(2·3, 1·4)는 두 번째가 다른 밝기로 밀린다.
    assert.equal(result.scenes[0].brightness, "mid");
    assert.equal(result.scenes[1].brightness, "dark");
    assert.equal(result.scenes[4].brightness, "bright");
  });

  it("한 리딩 안에서 같은 그림을 두 번 쓰지 않는다", () => {
    const result = plan([["설렘"], ["설렘"], ["설렘"], ["설렘"], ["설렘"]]);
    assert.equal(new Set(result.scenes.map((s) => s.assetId)).size, 5);
  });

  it("태그가 없어도 다섯 자리가 다 찬다", () => {
    const result = plan([[], [], [], [], []]);
    assert.equal(result.scenes.filter((s) => s.assetId).length, 5);
  });

  it("태그가 전부 쓰레기여도 다섯 자리가 다 찬다", () => {
    const result = plan([["자해"], ["병원"], ["폭력"], ["죽음"], ["공포"]]);
    assert.equal(result.scenes.filter((s) => s.assetId).length, 5);
    assert.equal(new Set(result.scenes.map((s) => s.assetId)).size, 5);
  });

  it("그림이 아직 없는 태그가 와도 다섯 자리가 다 찬다", () => {
    // 눈물은 열렸지만 에셋은 아직 없다. 여기서 빈칸이 생기면 돈 받고 판 리딩이 깨진다.
    const result = plan([["눈물"], ["눈물"], ["눈물"], ["눈물"], ["눈물"]]);
    assert.equal(result.scenes.filter((s) => s.assetId).length, 5);
    assert.equal(new Set(result.scenes.map((s) => s.assetId)).size, 5);
  });

  it("장이 다섯 개보다 적어도 터지지 않는다", () => {
    const result = plan([["설렘"]]);
    assert.equal(result.scenes.length, 5);
  });
});

describe("일간 오행", () => {
  it("명식에서 일간 오행을 읽는다", () => {
    // chartSummary 모양: "연주 갑자 (띠: 쥐), 월주 병인, 일주 무진 (일간 오행: 토), 시주 경신"
    assert.equal(elementFromChart("연주 갑자 (띠: 쥐), 월주 병인, 일주 무진 (일간 오행: 토), 시주 경신"), "토");
  });

  it("명식을 못 읽으면 토로 떨어진다", () => {
    assert.equal(elementFromChart(null), "토");
    assert.equal(elementFromChart("알 수 없음"), "토");
  });
});

describe("화면이 쓰는 모양", () => {
  const images = planImagesFor({
    chapterNumbers: [1, 2, 3, 4, 5],
    chapterEmotionTags: [["설렘"], ["기다림"], ["망설임"], ["끌림"], ["회복"]],
    chart: "일주 무진 (일간 오행: 토)",
    label: "이별 부검",
  });

  it("여섯 자리가 전부 ready 다 — 기다릴 것이 없다", () => {
    assert.equal(images.length, 6);
    assert.ok(images.every((image) => image.status === "ready"), "pending 이 남아 있다");
    assert.ok(images.every((image) => image.url), "주소가 빈 자리가 있다");
  });

  it("부적은 0번 자리에 앉는다", () => {
    assert.equal(images.filter((image) => image.chapter === TALISMAN_SLOT).length, 1);
  });

  it("주소는 public 아래 webp 를 가리킨다", () => {
    for (const image of images) {
      assert.match(image.url ?? "", /^\/assets\/love-rabbit\/(scenes|talismans)\/[a-z_]+\.webp$/);
    }
  });

  it("낭독기가 읽을 설명이 비어 있지 않다", () => {
    assert.ok(images.every((image) => (image.alt ?? "").length > 0));
  });

  it("설명에 금지된 말이 없다", () => {
    // 눈물·울음은 운영자가 열었다. 해를 부르는 말만 막는다.
    const banned = /쓰러|의식을 잃|병원|병실|상해|사망|자해|폭력|공포|위협|구속/;
    for (const image of images) assert.doesNotMatch(image.alt ?? "", banned);
  });
});

describe("에셋 경로", () => {
  it("매니페스트의 png 를 화면용 webp 로 바꾼다", () => {
    assert.equal(assetSrc({ path: "scenes/scene_thrill_mid.png" }), "/assets/love-rabbit/scenes/scene_thrill_mid.webp");
  });
});
