import assert from "node:assert/strict";
import test from "node:test";

import {
  MAJOR_LUCK_COLUMNS,
  buildManseryeok,
  manseryeokHref,
  parseManseryeokQuery,
} from "../src/lib/manseryeok";

// 만세력 화면은 주소가 곧 입력이다. 주소를 잘못 읽으면 틀린 명식이 맞는 얼굴로
// 나가고, 사용자는 그걸 확인할 방법이 없다. 그래서 파싱과 조립을 함께 잠근다.

const NOW = new Date("2026-08-25T03:00:00Z");

test("주소에서 읽은 값으로 명식이 선다", () => {
  const query = parseManseryeokQuery({ y: "1995", m: "3", d: "14", h: "9", g: "F" });
  assert.ok(query);

  const data = buildManseryeok(query, NOW);
  assert.ok(data);

  // 1995-03-14 09:00 서울 = 을해년 기묘월 갑진일 무진시
  assert.equal(data.pillars.map((p) => p.stem?.hangul ?? "").join(""), "무갑기을");
  assert.equal(data.pillars.map((p) => p.branch?.hangul ?? "").join(""), "진진묘해");
  assert.equal(data.dayMaster.label, "갑목");
  assert.equal(data.animal, "돼지띠");
});

test("일간은 십성을 매기지 않는다 — 기준이 자기 자신이다", () => {
  const query = parseManseryeokQuery({ y: "1995", m: "3", d: "14", h: "9", g: "F" });
  const data = buildManseryeok(query!, NOW)!;
  const day = data.pillars.find((p) => p.label === "일주")!;

  assert.equal(day.stem?.tenGod, "일원");
  // 나머지 자리는 실제 십성이 붙는다
  assert.equal(day.branch?.tenGod, "편재");
});

test("시각을 모르면 시주를 세우지 않는다", () => {
  const query = parseManseryeokQuery({ y: "1988", m: "11", d: "2", h: "unknown", g: "M" });
  const data = buildManseryeok(query!, NOW)!;
  const hour = data.pillars.find((p) => p.label === "시주")!;

  // 모르는 값을 채우면 십성 두 개와 지장간 한 벌이 통째로 지어진다.
  assert.equal(hour.stem, null);
  assert.equal(hour.branch, null);
  assert.deepEqual(hour.hidden, []);
  // 나머지 세 기둥은 그대로 나온다
  assert.equal(data.pillars.find((p) => p.label === "일주")?.stem?.hangul, "신");
});

test("음력은 양력으로 바꿔 계산하고, 윤달은 한 달을 가른다", () => {
  const plain = buildManseryeok(
    parseManseryeokQuery({ y: "1995", m: "8", d: "10", cal: "lunar" })!,
    NOW
  )!;
  const leap = buildManseryeok(
    parseManseryeokQuery({ y: "1995", m: "8", d: "10", cal: "lunar", leap: "1" })!,
    NOW
  )!;

  assert.deepEqual(plain.solar, { year: 1995, month: 9, day: 4 });
  assert.deepEqual(leap.solar, { year: 1995, month: 10, day: 4 });
  // 한 달이 어긋나면 명식이 통째로 달라진다 — 같은 값이 나오면 변환이 죽은 것이다
  assert.notEqual(
    plain.pillars.map((p) => p.branch?.hangul).join(""),
    leap.pillars.map((p) => p.branch?.hangul).join("")
  );
});

test("그 달에 없는 윤달을 요청하면 조용히 평달로 넘기지 않는다", () => {
  const query = parseManseryeokQuery({ y: "1995", m: "3", d: "10", cal: "lunar", leap: "1" });
  assert.ok(query, "파싱은 통과한다 — 윤달 유무는 변환표가 안다");
  assert.equal(buildManseryeok(query, NOW), null);
});

test("말이 안 되는 주소는 명식을 세우지 않는다", () => {
  const bad = [
    { y: "1995", m: "13", d: "1" }, // 없는 달
    { y: "1995", m: "2", d: "30" }, // 그 달에 없는 양력 날짜
    { y: "1800", m: "1", d: "1" }, // 계산 범위 밖
    { y: "1995", m: "3", d: "14", h: "25" }, // 없는 시각
    { m: "3", d: "14" }, // 연도 없음
  ];
  for (const raw of bad) {
    assert.equal(parseManseryeokQuery(raw), null, JSON.stringify(raw));
  }
});

test("대운은 성별로 방향이 갈리고, 지금 걸린 칸이 하나만 표시된다", () => {
  const female = buildManseryeok(
    parseManseryeokQuery({ y: "1995", m: "3", d: "14", h: "9", g: "F" })!,
    NOW
  )!;
  const male = buildManseryeok(
    parseManseryeokQuery({ y: "1995", m: "3", d: "14", h: "9", g: "M" })!,
    NOW
  )!;

  // 을해년은 음간년 — 여자는 순행, 남자는 역행
  assert.equal(female.majorLuck.direction, "순행");
  assert.equal(male.majorLuck.direction, "역행");

  assert.equal(female.majorLuck.columns.length, MAJOR_LUCK_COLUMNS);
  assert.equal(female.majorLuck.columns.filter((c) => c.current).length, 1);

  // 지금 칸은 나이 범위 안에 있어야 한다 (세는나이 = 2026 - 1995 + 1 = 32)
  const current = female.majorLuck.columns.find((c) => c.current)!;
  assert.ok(current.fromAge <= 32 && 32 <= current.toAge);
});

test("주소를 만들고 다시 읽으면 같은 입력이 나온다", () => {
  const inputs = [
    { year: 1995, month: 3, day: 14, hour: 9, gender: "F" as const, calendar: "solar" as const, leapMonth: false },
    { year: 1995, month: 8, day: 10, hour: null, gender: "M" as const, calendar: "lunar" as const, leapMonth: true },
  ];

  for (const input of inputs) {
    const href = manseryeokHref(input);
    const raw = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    assert.deepEqual(parseManseryeokQuery(raw), input, href);
  }
});
