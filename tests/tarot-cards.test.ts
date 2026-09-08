import assert from "node:assert/strict";
import test from "node:test";
import { ABSOLUTE_PATTERNS } from "../src/lib/reading-guard";
import { MAJOR_ARCANA, cardOf, drawThree } from "../src/lib/tarot-cards";

test("메이저 스물두 장이 빠짐없이 있다", () => {
  assert.equal(MAJOR_ARCANA.length, 22);
  assert.equal(new Set(MAJOR_ARCANA.map((c) => c.id)).size, 22, "id 가 겹친다");
  assert.equal(new Set(MAJOR_ARCANA.map((c) => c.name)).size, 22, "이름이 겹친다");
});

test("카드마다 뜻과 금지선이 채워져 있다", () => {
  // 뜻이 비면 해석이 근거 없이 나가고, 금지선이 비면 그 카드가 늘 미끄러지는
  // 방향(죽음→사망, 탑→재난)을 막을 것이 없다.
  for (const c of MAJOR_ARCANA) {
    assert.ok(c.meaning.length > 15, `${c.name} 의 뜻이 너무 짧다`);
    assert.ok(c.keywords.length >= 3, `${c.name} 의 키워드가 적다`);
    assert.ok(c.forbidden.length >= 2, `${c.name} 에 금지선이 없다`);
  }
});

test("카드 뜻 자체가 단정하지 않는다", () => {
  // 표가 이미 단정하면 그 위에 무엇을 써도 단정이 된다.
  for (const c of MAJOR_ARCANA) {
    for (const [pattern, label] of ABSOLUTE_PATTERNS) {
      assert.ok(!pattern.test(c.meaning), `${c.name} 의 뜻에 "${label}" 가 있다`);
    }
  }
});

test("무거운 카드에는 그 카드가 미끄러지는 방향이 막혀 있다", () => {
  // 이 셋이 타로에서 가장 자주 오해되는 카드다 — 금지선이 비면 안 된다.
  const death = cardOf("death")!;
  assert.ok(death.forbidden.some((f) => f.includes("죽음") || f.includes("사망")));
  const tower = cardOf("the-tower")!;
  assert.ok(tower.forbidden.some((f) => f.includes("사고") || f.includes("재난")));
  const devil = cardOf("the-devil")!;
  assert.ok(devil.forbidden.some((f) => f.includes("중독") || f.includes("진단")));
});

test("세 장은 서로 다른 카드다", () => {
  // 같은 카드가 두 번 나오면 자리마다 다른 말을 할 수 없다.
  for (let seed = 0; seed < 200; seed += 1) {
    let n = seed;
    const rand = () => {
      n = (n * 1103515245 + 12345) % 2147483648;
      return n / 2147483648;
    };
    const three = drawThree(rand);
    assert.equal(three.length, 3);
    assert.equal(new Set(three.map((c) => c.id)).size, 3, `seed ${seed} 에서 카드가 겹쳤다`);
  }
});

test("뽑기는 스물두 장 전부에 닿는다 — 몇 장만 계속 나오지 않는다", () => {
  const seen = new Set<string>();
  let n = 7;
  const rand = () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
  for (let i = 0; i < 500; i += 1) drawThree(rand).forEach((c) => seen.add(c.id));
  assert.equal(seen.size, 22, `${seen.size}장만 나온다`);
});

test("모르는 카드 id 는 null 이다", () => {
  assert.equal(cardOf("the-unicorn"), null);
  assert.equal(cardOf(""), null);
  assert.equal(cardOf(null), null);
});
