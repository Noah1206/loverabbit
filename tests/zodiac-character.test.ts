import assert from "node:assert/strict";
import test from "node:test";
import { computeSaju, JIJI, JIJI_ANIMAL } from "../src/lib/saju";
import {
  ZODIAC,
  ZODIAC_ART_READY,
  hasZodiacArt,
  zodiacOf,
} from "../src/lib/zodiac-character";

// 이 표가 틀리면 사람에게 남의 띠가 보인다. 계산이 아니라 배열 순서로 맞추는
// 자리라, 한 칸만 밀려도 조용히 어긋난다 — 그래서 순서를 못 박는다.

test("십이지 표는 지지·띠 순서와 한 칸도 어긋나지 않는다", () => {
  assert.equal(ZODIAC.length, 12);
  ZODIAC.forEach((z, i) => {
    assert.equal(z.animal, JIJI_ANIMAL[i]);
    assert.equal(z.branch, JIJI[i]);
  });
});

test("띠 이름으로 찾으면 그 띠가 나온다", () => {
  assert.equal(zodiacOf("토끼")?.branch, "묘");
  assert.equal(zodiacOf("쥐")?.branch, "자");
  assert.equal(zodiacOf("돼지")?.branch, "해");
  // 공백이 섞여 들어와도 찾는다 — 값이 화면을 거쳐 오는 자리다
  assert.equal(zodiacOf(" 용 ")?.branch, "진");
});

test("모르는 값이나 빈 값은 null 이다 — 화면은 띠 없이 그린다", () => {
  assert.equal(zodiacOf("유니콘"), null);
  assert.equal(zodiacOf(""), null);
  assert.equal(zodiacOf(null), null);
  assert.equal(zodiacOf(undefined), null);
});

test("computeSaju 가 내주는 띠는 반드시 표에 있다", () => {
  // 연주 지지가 열둘을 다 돌도록 열두 해를 훑는다. 실제 계산값과 표가
  // 만나는 유일한 지점이라, 여기가 통과해야 화면이 그림을 찾을 수 있다.
  for (let year = 2000; year < 2012; year += 1) {
    const chart = computeSaju({ year, month: 6, day: 15, hour: 12, minute: 0 });
    assert.ok(
      zodiacOf(chart.animal),
      `${year}년 띠 "${chart.animal}" 를 십이지 표에서 못 찾았다`
    );
  }
});

test("그림 등재부에 없는 띠는 아직 그림이 없다고 답한다", () => {
  // 없는 파일을 걸면 깨진 이미지가 뜬다 — 이모지로 떨어지는 갈래를 지킨다.
  for (const z of ZODIAC) {
    if (!ZODIAC_ART_READY.has(z.animal)) {
      assert.equal(hasZodiacArt(z.animal), false);
    }
  }
  assert.equal(hasZodiacArt("유니콘"), false);
});

test("등재부에 적는 이름은 실제 띠 이름이어야 한다", () => {
  // 오타로 "토끼 " 같은 것이 들어가면 영원히 안 켜진다. 조용한 실패라
  // 여기서 막는다.
  for (const name of ZODIAC_ART_READY) {
    assert.ok(zodiacOf(name), `등재부의 "${name}" 는 십이지에 없는 이름이다`);
  }
});

test("그림 경로는 띠마다 다르고 아스키로만 이루어진다", () => {
  const paths = new Set(ZODIAC.map((z) => z.art));
  assert.equal(paths.size, 12, "두 띠가 같은 그림을 가리킨다");
  for (const z of ZODIAC) {
    // 한글 파일명은 배포·CDN 에서 인코딩이 갈린다
    assert.match(z.art, /^\/assets\/zodiac\/[a-z]+-hanbok\.webp$/);
  }
});

test("등재부가 그림이 있다고 한 띠는 파일이 실제로 있다", async () => {
  // 등재부는 사람이 손으로 적는다. 파일 없이 이름만 더하면 화면에 깨진
  // 이미지가 뜨는데, 그건 이모지 폴백보다 나쁘다 — 그 실수를 여기서 막는다.
  const { access } = await import("node:fs/promises");
  for (const z of ZODIAC) {
    if (!ZODIAC_ART_READY.has(z.animal)) continue;
    await assert.doesNotReject(
      access(new URL(`../public${z.art}`, import.meta.url)),
      `${z.animal}: ${z.art} 파일이 없다`
    );
  }
});

test('"토끼띠" 처럼 접미사가 붙어 와도 찾는다', () => {
  // 만세력은 "띠" 를 붙여 저장한다(manseryeok.ts:321). 처음에 이걸 놓쳐서
  // 만세력 화면의 띠 표식이 조용히 사라졌다 — 실패가 눈에 안 띄는 종류다.
  assert.equal(zodiacOf("토끼띠")?.branch, "묘");
  assert.equal(zodiacOf("쥐띠")?.branch, "자");
  assert.equal(zodiacOf(" 돼지띠 ")?.branch, "해");
  // 접미사를 벗겨도 없는 이름은 여전히 없다
  assert.equal(zodiacOf("유니콘띠"), null);
});
