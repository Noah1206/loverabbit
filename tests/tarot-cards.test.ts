import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ABSOLUTE_PATTERNS } from "../src/lib/reading-guard";
import { MAJOR_ARCANA, cardOf, drawThree } from "../src/lib/tarot-cards";
import { drawFor, drawKey, seoulDay } from "../src/lib/tarot-reading";

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

// ── 씨앗 뽑기 (2026-09-09) ──────────────────────────────
//
// 뽑기를 서버로 옮긴 것만으로는 되돌려 뽑기가 안 막힌다. 뒤로 갔다 다시
// 들어오면 서버가 또 뽑아 새 패를 준다. 씨앗을 (사람×날×물음)으로 두면
// 그 길이 닫히고, 같은 값이 과금 ref 라 이중 청구도 함께 막힌다.
test("같은 열쇠면 같은 패다 — 되돌아와도 안 바뀐다", () => {
  const key = drawKey(7, "love", "2026-09-09");
  const a = drawFor("love", key);
  const b = drawFor("love", key);
  assert.deepEqual(
    a.cards.map((c) => c.card.id),
    b.cards.map((c) => c.card.id)
  );
  assert.equal(a.drawKey, key);
});

test("사람·날·물음 중 하나만 달라도 패가 달라진다", () => {
  const base = drawFor("love", drawKey(7, "love", "2026-09-09")).cards.map((c) => c.card.id);
  const other = drawFor("love", drawKey(8, "love", "2026-09-09")).cards.map((c) => c.card.id);
  const nextDay = drawFor("love", drawKey(7, "love", "2026-09-10")).cards.map((c) => c.card.id);
  const otherTopic = drawFor("work", drawKey(7, "work", "2026-09-09")).cards.map((c) => c.card.id);
  assert.notDeepEqual(base, other, "사람이 달라도 같은 패다");
  assert.notDeepEqual(base, nextDay, "날이 달라도 같은 패다");
  assert.notDeepEqual(base, otherTopic, "물음이 달라도 같은 패다");
});

test("열쇠 없이 부르면 예전처럼 무작위다", () => {
  // 테스트와 미리보기가 쓰는 길. 여기가 막히면 안 된다.
  const runs = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    runs.add(drawFor("love").cards.map((c) => c.card.id).join(","));
  }
  assert.ok(runs.size > 1, "열쇠 없이 불렀는데 늘 같은 패가 나온다");
  assert.equal(drawFor("love").drawKey, null);
});

test("세 장이 겹치지 않는다 — 씨앗을 써도", () => {
  for (let i = 0; i < 300; i += 1) {
    const cards = drawFor("love", drawKey(i, "love", "2026-09-09")).cards;
    assert.equal(new Set(cards.map((c) => c.card.id)).size, 3, `열쇠 ${i} 에서 카드가 겹쳤다`);
  }
});

test("스물두 장이 고르게 나온다 — 몇 장만 도는 뽑기가 아니다", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    for (const c of drawFor("love", drawKey(i, "love", "2026-09-09")).cards) seen.add(c.card.id);
  }
  assert.equal(seen.size, 22, `${seen.size}장만 나왔다`);
});

test("서울 날짜로 하루를 가른다", () => {
  // UTC 로 9/8 늦은 밤이면 서울은 이미 9/9 다. 사용자가 사는 날과 경계가
  // 같아야 "오늘의 카드" 가 말이 된다.
  assert.equal(seoulDay(new Date("2026-09-08T16:00:00Z")), "2026-09-09");
  assert.match(seoulDay(), /^\d{4}-\d{2}-\d{2}$/);
});

test("과금 ref 가 뽑기 열쇠와 같다 — 이중 청구를 실제로 막는다", () => {
  // 예전에는 ref 에 뽑은 시각이 들어갔다. 시각은 요청마다 달라서
  // (reason, ref) unique 가 아무것도 안 잠갔다.
  const key = drawKey(7, "love", "2026-09-09");
  assert.equal(drawFor("love", key).drawKey, key);
  assert.ok(!key.includes("T"), "열쇠에 시각이 들어가면 잠금이 풀린다");
});

// ── 카드 그림 (2026-09-09) ──────────────────────────────
//
// 파일 이름이 곧 카드 id 다(TarotView 가 `/tarot/${card.id}.jpg` 로 건다).
// 표에 카드를 더하고 그림을 안 넣으면 화면에 깨진 그림 표식이 나가므로,
// 두 방향으로 잡는다.
test("메이저 스물두 장 전부 그림이 있다", () => {
  for (const c of MAJOR_ARCANA) {
    const file = path.join(process.cwd(), "public", "tarot", `${c.id}.jpg`);
    assert.ok(fs.existsSync(file), `${c.name}(${c.id}) 의 그림이 없다 — public/tarot/${c.id}.jpg`);
    const bytes = fs.statSync(file).size;
    assert.ok(bytes > 5_000, `${c.id} 이 너무 작다 (${bytes}바이트)`);
    assert.ok(bytes < 1_000_000, `${c.id} 이 ${Math.round(bytes / 1024)}KB 다 — 줄여서 넣는다`);
  }
});

test("마이너 쉰여섯 장의 그림은 미리 넣어 두었다", () => {
  // 카드 표는 아직 메이저만 연다(tarot-cards.ts 첫 주석). 마이너를 열 때
  // 그림부터 다시 그리지 않도록 파일은 먼저 넣어 뒀다 — 그때 이 이름을 쓰면 된다.
  const dir = path.join(process.cwd(), "public", "tarot");
  const suits = ["wands", "cups", "swords", "pentacles"];
  for (const suit of suits) {
    for (let n = 1; n <= 14; n += 1) {
      const id = `${suit}-${String(n).padStart(2, "0")}`;
      assert.ok(fs.existsSync(path.join(dir, `${id}.jpg`)), `${id} 의 그림이 없다`);
    }
  }
});

test("쓰지 않는 그림을 두지 않는다", () => {
  const dir = path.join(process.cwd(), "public", "tarot");
  const known = new Set<string>(MAJOR_ARCANA.map((c) => c.id));
  for (const suit of ["wands", "cups", "swords", "pentacles"]) {
    for (let n = 1; n <= 14; n += 1) known.add(`${suit}-${String(n).padStart(2, "0")}`);
  }
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".jpg")) continue;
    assert.ok(known.has(file.slice(0, -4)), `${file} 은 어느 카드도 아니다`);
  }
});
