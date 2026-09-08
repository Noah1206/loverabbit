import assert from "node:assert/strict";
import test from "node:test";
import { checkTarot, type TarotReport } from "../src/lib/tarot-guard";
import { drawFor } from "../src/lib/tarot-reading";

/* 씨앗을 고정해 같은 뽑기를 재현한다 — 검사가 뽑기 운에 좌우되면 안 된다 */
function fixedDraw() {
  let n = 42;
  const rand = () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
  return drawFor("love", rand);
}

/** 그 뽑기에 맞는, 통과해야 하는 리포트 */
function goodReport(draw: ReturnType<typeof fixedDraw>): TarotReport {
  return {
    cards: draw.cards.map((c) => ({
      position: c.positionLabel,
      cardName: c.card.name,
      read: "여기까지 무엇이 있었는지 돌아보면, 마음이 한 곳에 오래 머물지 못한 자리가 보여요. 그 흔들림이 잘못이었다기보다 아직 자리를 못 찾은 결에 가까워요. 지금은 그 결을 알아차리는 것만으로 충분해요.",
    })),
    closing: "세 자리를 겹쳐 보면 지금은 서두르기보다 결을 알아차리는 국면이에요.",
    grainUsed: [],
  };
}

test("규칙을 지킨 리포트는 통과한다", () => {
  const draw = fixedDraw();
  const r = checkTarot(goodReport(draw), draw);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

test("단정하면 막는다", () => {
  const draw = fixedDraw();
  const bad = goodReport(draw);
  bad.closing = "이 관계는 반드시 이어져요.";
  const r = checkTarot(bad, draw);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.kind === "단정"));
});

test("진단·투자 지시는 막는다", () => {
  const draw = fixedDraw();
  const bad = goodReport(draw);
  bad.closing = "처방전을 받아 보세요.";
  assert.equal(checkTarot(bad, draw).ok, false);
});

test("뽑지 않은 카드를 부르면 막는다", () => {
  const draw = fixedDraw();
  const drawn = new Set(draw.cards.map((c) => c.card.name));
  // 뽑히지 않은 것 중 일상어와 안 겹치는 이름 하나를 고른다
  const absent = ["마법사", "여사제", "여황제", "황제", "교황", "은둔자", "전차"].find(
    (n) => !drawn.has(n)
  )!;
  const bad = goodReport(draw);
  bad.closing = `${absent} 카드가 함께 보이는 자리예요.`;
  const r = checkTarot(bad, draw);
  assert.equal(r.ok, false);
  assert.ok(
    r.violations.some((v) => v.detail.includes(absent)),
    `${absent} 를 못 잡았다`
  );
});

test("카드 이름이 자리와 어긋나면 막는다", () => {
  const draw = fixedDraw();
  const bad = goodReport(draw);
  bad.cards[0].cardName = bad.cards[1].cardName; // 첫 자리에 둘째 카드 이름
  const r = checkTarot(bad, draw);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.kind === "구조"));
});

test("카드가 나온 이유를 명식으로 설명하면 막는다", () => {
  const draw = fixedDraw();
  const bad = goodReport(draw);
  bad.closing = "이 카드가 나온 것은 당신 일간이 갑목이기 때문이에요.";
  const r = checkTarot(bad, draw);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.kind === "인과"));
});

test("카드마다 금지된 방향으로 가면 막는다", () => {
  // 죽음 카드가 뽑힐 때까지 돌려, 그 카드의 금지선이 실제로 도는지 본다
  for (let seed = 0; seed < 300; seed += 1) {
    let n = seed;
    const rand = () => {
      n = (n * 1103515245 + 12345) % 2147483648;
      return n / 2147483648;
    };
    const draw = drawFor("love", rand);
    if (!draw.cards.some((c) => c.card.id === "death")) continue;
    const bad = goodReport(draw);
    bad.closing = "이 자리에서 사망을 예고하는 흐름이 보여요.";
    const r = checkTarot(bad, draw);
    assert.equal(r.ok, false, "죽음 카드의 금지선이 안 돈다");
    return;
  }
  assert.fail("300번 안에 죽음 카드가 안 나왔다");
});

test("해석이 너무 짧으면 막는다", () => {
  const draw = fixedDraw();
  const bad = goodReport(draw);
  bad.cards[0].read = "좋아요.";
  assert.equal(checkTarot(bad, draw).ok, false);
});
