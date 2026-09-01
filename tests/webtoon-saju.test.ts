import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bubbleAt,
  BUBBLE_GAP,
  BUBBLE_WIDTH,
  buildShareText,
  buildWebtoonContent,
  FORTUNE_TYPES,
  FREE_PANEL_COUNT,
  isFortuneType,
  nicknameFromEmail,
  panelsForState,
  webtoonUnlockRef,
  WEBTOON_FORTUNE_CONFIG,
} from "../src/lib/webtoon-saju";

describe("웹툰 사주 운세 분리", () => {
  it("세 운세가 서로 다른 패널 id·이미지·텍스트를 쓴다", () => {
    const contents = FORTUNE_TYPES.map((t) => buildWebtoonContent(t, "테스터"));
    const allPanelIds = contents.flatMap((c) => c.panels.map((p) => p.id));
    assert.equal(new Set(allPanelIds).size, allPanelIds.length, "패널 id 가 운세 간에 겹친다");

    // 이미지도 운세 간 교집합이 없어야 데이터가 섞이지 않는다
    const imageSets = contents.map((c) => new Set(c.panels.map((p) => p.imageUrl)));
    for (let a = 0; a < imageSets.length; a += 1) {
      for (let b = a + 1; b < imageSets.length; b += 1) {
        for (const url of imageSets[a]) {
          assert.ok(!imageSets[b].has(url), `${url} 이 두 운세에 같이 쓰인다`);
        }
      }
    }
  });

  it("모든 패널에 alt 와 이미지가 있고 앞 2패널만 무료다", () => {
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      panels.forEach((panel, i) => {
        assert.ok(panel.alt.length > 0, `${panel.id} 에 alt 가 없다`);
        assert.ok(panel.imageUrl.startsWith("/assets/webtoon-saju/"));
        assert.equal(panel.isPreview, i < FREE_PANEL_COUNT);
      });
    }
  });

  it("잠금 상태 응답에서는 뒤 패널의 문장이 비어 있다", () => {
    const { panels } = buildWebtoonContent("money", "테스터");
    const locked = panelsForState(panels, false);
    locked.forEach((panel, i) => {
      if (i < FREE_PANEL_COUNT) assert.ok(panel.overlays.length > 0);
      else assert.equal(panel.overlays.length, 0, "유료 패널 문장이 미해금 응답으로 샌다");
    });
    // 해금이면 전부 온전하다
    const open = panelsForState(panels, true);
    assert.ok(open.every((p, i) => p.overlays.length === panels[i].overlays.length));
  });

  it("이별운은 이별을 확정적으로 예언하지 않는다", () => {
    const { previewText, fullParagraphs } = buildWebtoonContent("breakup", "테스터");
    const all = [previewText, ...fullParagraphs].join(" ");
    for (const banned of ["헤어질 거", "이별할 거", "끝날 거", "헤어지게 된다"]) {
      assert.ok(!all.includes(banned), `확정 예언 표현: ${banned}`);
    }
  });
});

describe("해금 키와 비용", () => {
  it("운세별 해금 ref 가 리딩·운세 단위로 유일하다", () => {
    assert.equal(webtoonUnlockRef("abc", "money"), "webtoon:abc:money");
    const refs = FORTUNE_TYPES.map((t) => webtoonUnlockRef("abc", t));
    assert.equal(new Set(refs).size, 3);
  });

  it("세 운세 모두 서버 비용이 29 러빗이다", () => {
    for (const type of FORTUNE_TYPES) {
      assert.equal(WEBTOON_FORTUNE_CONFIG[type].unlockCost, 29);
    }
  });

  it("isFortuneType 이 이상한 값을 거른다", () => {
    assert.ok(isFortuneType("money") && isFortuneType("love") && isFortuneType("breakup"));
    assert.ok(!isFortuneType("weekly-ranking") && !isFortuneType(null) && !isFortuneType(""));
  });
});

describe("개인정보", () => {
  it("공유 문구·경로에 리딩 id 나 생년월일이 없다", () => {
    for (const type of FORTUNE_TYPES) {
      const { text, path } = buildShareText(type);
      assert.equal(path, "/");
      assert.ok(!/\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test(text), "날짜 형식이 공유 문구에 있다");
    }
  });

  it("이름 같은 아이디만 부른다 — 계정 문자열은 화면에 띄우지 않는다", () => {
    assert.equal(nicknameFromEmail("rabbit@example.com"), "rabbit");
    assert.equal(nicknameFromEmail("달토끼@example.com"), "달토끼");
    // 숫자가 섞였거나 너무 길면 아이디로 본다 — "ab40905045님" 은 이름이 아니다
    assert.equal(nicknameFromEmail("ab40905045@example.com"), "여행자");
    assert.equal(nicknameFromEmail("user123@example.com"), "여행자");
    assert.equal(nicknameFromEmail("verylongnickname@example.com"), "여행자");
    assert.equal(nicknameFromEmail(""), "여행자");
    assert.equal(nicknameFromEmail(undefined), "여행자");
  });

  it("패널 오버레이 본문에 생년월일 형식이 없다", () => {
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      for (const overlay of panels.flatMap((p) => p.overlays)) {
        assert.ok(!/\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test(overlay.text));
      }
    }
  });
});

describe("말풍선 기하", () => {
  it("말풍선이 위에서부터 순서대로 쌓인다", () => {
    const first = bubbleAt("left", 0, 2);
    const second = bubbleAt("left", 1, 2);
    assert.ok(first.y < second.y, "두 번째가 아래로 와야 한다");
  });

  it("간격이 말풍선 몸통 높이보다 넓다 — 겹치면 테두리가 물린다", () => {
    const first = bubbleAt("left", 0, 2);
    const second = bubbleAt("left", 1, 2);
    // 몸통 높이: 폭 × (130/200) × (1024/1365). 이 값을 눈대중으로 정했다가 8% 겹쳤다.
    const bodyHeight = BUBBLE_WIDTH * (130 / 200) * (1024 / 1365);
    assert.ok(second.y - first.y >= bodyHeight, `간격 ${second.y - first.y} < 몸통 ${bodyHeight}`);
    assert.equal(BUBBLE_GAP, bodyHeight + 2);
  });

  it("꼬리는 마지막 말풍선에만 붙는다", () => {
    // 앞 풍선에도 달면 그 꼬리가 뒤 풍선을 뚫는다. 웹툰의 관행이기도 하다.
    assert.equal(bubbleAt("left", 0, 2).tail, undefined, "앞 풍선에 꼬리가 있다");
    assert.ok(bubbleAt("left", 1, 2).tail, "마지막 풍선에 꼬리가 없다");
    assert.ok(bubbleAt("right", 0, 1).tail, "단독이면 꼬리가 있어야 한다");
  });

  it("꼬리는 말풍선이 앉은 쪽이 아니라 화자를 가리킨다", () => {
    /*
      side 는 말풍선이 앉을 쪽일 뿐이다. 둘을 같은 값으로 쓰다가 꼬리가 허공을
      가리켰다 — 컷 15장 중 14장에서 토끼는 정중앙(45~59%)에 있는데 꼬리는
      말풍선 쪽 끝으로 내려갔다.
    */
    // 왼쪽 말풍선(중심 30%) + 오른쪽에 선 화자(70%) → 꼬리는 오른쪽으로
    assert.equal(bubbleAt("left", 0, 1, 70).tail, "bottom-right");
    // 오른쪽 말풍선(중심 70%) + 왼쪽에 선 화자(20%) → 꼬리는 왼쪽으로
    assert.equal(bubbleAt("right", 0, 1, 20).tail, "bottom-left");
    // 화자가 말풍선 바로 아래면 가운데로 내린다
    const left = bubbleAt("left", 0, 1);
    assert.equal(bubbleAt("left", 0, 1, left.x + BUBBLE_WIDTH / 2).tail, "bottom-center");
  });

  it("모든 말풍선이 패널 안에 들어온다", () => {
    for (const side of ["left", "right"] as const) {
      for (let i = 0; i < 2; i += 1) {
        const b = bubbleAt(side, i, 2);
        assert.ok(b.y >= 0 && b.y + BUBBLE_GAP <= 100, `${side}:${i} 세로가 넘친다`);
        assert.ok(b.x >= 0 && b.x + b.width <= 100, `${side}:${i} 가로가 넘친다`);
      }
    }
  });

  it("실제 패널의 말풍선이 그림 위쪽 빈 자리에 앉는다", () => {
    // 이미지 계약: 위쪽 45% 가 비어 있다 (public/assets/webtoon-saju/README.md).
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      for (const panel of panels) {
        const speech = panel.overlays.filter((o) => o.type === "speech");
        speech.forEach((o, i) => {
          assert.ok(o.y < 45, `${o.id} 가 빈 자리를 벗어났다 (y=${o.y})`);
          const last = i === speech.length - 1;
          assert.equal(Boolean(o.tail), last, `${o.id} 꼬리 규칙 위반`);
        });
      }
    }
  });
});

describe("8컷 구성", () => {
  it("운세마다 8컷이고 앞 3컷이 무료다", () => {
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      assert.equal(panels.length, 8, `${type} 컷 수`);
      panels.forEach((p, i) => assert.equal(p.isPreview, i < 3, `${p.id} 무료 여부`));
    }
  });

  it("화자 컷과 연결 컷이 번갈아 나온다", () => {
    // 말하는 얼굴만 이어지면 대화록이지 웹툰이 아니다.
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      const speaking = panels.filter((p) => p.overlays.some((o) => o.type === "speech"));
      const bridging = panels.filter((p) => p.overlays.some((o) => o.type === "caption"));
      assert.equal(speaking.length, 5, `${type} 화자 컷`);
      assert.equal(bridging.length, 3, `${type} 연결 컷`);
    }
  });

  it("연결 컷에는 말풍선이 없다 — 화자가 그림에 없으므로", () => {
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      for (const p of panels) {
        const hasCap = p.overlays.some((o) => o.type === "caption");
        const hasSay = p.overlays.some((o) => o.type === "speech");
        assert.ok(!(hasCap && hasSay), `${p.id} 에 캡션과 말풍선이 함께 있다`);
      }
    }
  });

  it("별명이 문장에 실제로 들어간다", () => {
    const { previewText, panels, fullParagraphs } = buildWebtoonContent("money", "토깽");
    assert.ok(previewText.includes("토깽"));
    assert.ok(fullParagraphs.some((x) => x.includes("토깽")));
    const all = panels.flatMap((p) => p.overlays.map((o) => o.text)).join(" ");
    assert.ok(all.includes("토깽"), "말풍선에 별명이 없다");
    // 치환 자리가 남아 있으면 화면에 {nick} 이 그대로 나간다
    assert.ok(!all.includes("{nick}"), "치환되지 않은 자리가 있다");
  });
});

describe("웹툰 컷 자산", () => {
  it("패널·표지가 가리키는 파일이 실제로 있다", async () => {
    const fs = await import("node:fs");
    for (const type of FORTUNE_TYPES) {
      const content = buildWebtoonContent(type, "테스터");
      const urls = [content.coverImageUrl, ...content.panels.map((p) => p.imageUrl)];
      for (const url of urls) {
        const path = `public${url}`;
        assert.ok(fs.existsSync(path), `${path} 가 없다 — 화면에 깨진 그림이 나간다`);
      }
    }
  });
});

describe("화면에 나가는 문자", () => {
  it("HTML 태그가 문장에 섞이지 않는다", () => {
    // React 는 문자열을 이스케이프하므로 <br> 이 글자 그대로 화면에 나온다.
    // HTML 프로토타입에서 옮겨 적을 때 실제로 그랬다 — 27군데였다.
    for (const type of FORTUNE_TYPES) {
      const c = buildWebtoonContent(type, "테스터");
      const all = [
        c.previewText,
        ...c.previewPoints,
        ...c.fullParagraphs,
        ...c.panels.flatMap((p) => p.overlays.map((o) => o.text)),
      ];
      for (const text of all) {
        assert.ok(!/<[a-z/][^>]*>/i.test(text), `HTML 태그가 남아 있다: ${text}`);
      }
    }
  });

  it("줄바꿈은 개행 문자로 들어간다", () => {
    // 말풍선은 타원이라 어디서 끊을지가 중요하다. 자동 줄바꿈에 맡기지 않는다.
    const { panels } = buildWebtoonContent("money", "테스터");
    const speech = panels.flatMap((p) => p.overlays.filter((o) => o.type === "speech"));
    assert.ok(speech.some((o) => o.text.includes("\n")), "의도한 줄바꿈이 하나도 없다");
  });
});
