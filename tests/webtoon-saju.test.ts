import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bubbleAt,
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

  it("별명은 이메일 앞부분만 12자까지 쓴다", () => {
    assert.equal(nicknameFromEmail("rabbit@example.com"), "rabbit");
    assert.equal(nicknameFromEmail("verylongnickname123@example.com").length, 12);
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

describe("말풍선 앵커", () => {
  it("화자 위치에서 말풍선 자리가 나온다", () => {
    const low = bubbleAt("left-low");
    assert.ok(low.y < 40, "화자가 아래면 말풍선은 위에 떠야 한다");
    assert.equal(low.tail, "bottom-left", "꼬리가 화자 쪽을 향해야 한다");

    const high = bubbleAt("left-high");
    assert.ok(high.y > 50, "화자가 위면 말풍선은 아래로 내려와야 한다");
  });

  it("두 번째 말풍선은 겹치지 않게 내려앉는다", () => {
    const first = bubbleAt("left-low", 0);
    const second = bubbleAt("left-low", 1);
    assert.ok(second.y > first.y, "계단식으로 앉아야 한다");
    assert.ok(second.y - first.y >= 12, "간격이 말풍선 높이만큼은 돼야 한다");
  });

  it("모든 말풍선이 패널 안에 들어온다", () => {
    for (const anchor of ["left-low", "right-low", "left-high", "right-high"] as const) {
      for (const i of [0, 1]) {
        const b = bubbleAt(anchor, i);
        assert.ok(b.y >= 0 && b.y <= 80, `${anchor}:${i} y가 화면을 벗어난다`);
        assert.ok(b.x + b.width <= 100, `${anchor}:${i} 가로가 넘친다`);
      }
    }
  });

  it("말풍선이 실제 패널에서 화자를 가리지 않는다", () => {
    // 앵커 규약: 화자는 아래(y>55%), 말풍선은 위(y<40%). 겹치면 화자가 가려진다.
    for (const type of FORTUNE_TYPES) {
      const { panels } = buildWebtoonContent(type, "테스터");
      for (const panel of panels) {
        for (const speech of panel.overlays.filter((o) => o.type === "speech")) {
          assert.ok(speech.y < 45, `${speech.id} 말풍선이 화자 영역까지 내려왔다`);
          assert.ok(speech.tail, `${speech.id} 에 꼬리가 없다 — 누가 말하는지 알 수 없다`);
        }
      }
    }
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
