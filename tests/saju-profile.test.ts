import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { buildSajuFacts } from "../src/lib/saju-facts";
import {
  ABSENT_GUIDELINE,
  CYCLE,
  ELEMENT_ART,
  ELEMENT_VIDEO,
  FLAGS,
  flipFlag,
  ELEMENTS,
  EXCESS_GUIDELINE,
  STRENGTH_GUIDELINE,
  TENGOD_GUIDELINE,
  buildSajuProfile,
  sajuProfileOf,
} from "../src/lib/saju-profile";

const BIRTH = { birthdate: "1995-03-14", birthHour: 9, gender: "F" } as const;

test("수치는 명리 엔진이 낸 값을 그대로 옮긴다", () => {
  // 화면이 숫자를 새로 만들면 근거가 사라진다. 같은 명식으로 엔진을 직접
  // 돌린 값과 한 자리도 어긋나면 안 된다.
  const facts = buildSajuFacts({ year: 1995, month: 3, day: 14, hour: 9, gender: "F" });
  const view = buildSajuProfile(facts);

  for (const bar of view.elements) {
    assert.equal(bar.count, facts.elementBalance[bar.ohaeng], `${bar.ohaeng} 개수가 다르다`);
  }
  assert.equal(view.strength.score, facts.strength.score);
  assert.equal(view.strength.label, facts.strength.label);
  assert.equal(view.dayMaster, facts.dayMaster);
  assert.deepEqual(view.absent, facts.absentElements);
  assert.deepEqual(view.hidden, facts.hiddenOnlyElements);
});

test("십성 분포는 자리 개수를 센 것이다", () => {
  const facts = buildSajuFacts({ year: 1995, month: 3, day: 14, hour: 9, gender: "F" });
  const view = buildSajuProfile(facts);

  const summed = view.tenGods.reduce((n, t) => n + t.count, 0);
  assert.equal(summed, facts.tenGods.length, "센 것과 자리 수가 안 맞는다");
  // 많은 것부터
  for (let i = 1; i < view.tenGods.length; i += 1) {
    assert.ok(view.tenGods[i - 1].count >= view.tenGods[i].count, "많은 순이 아니다");
  }
});

test("오행 다섯이 모두 자리를 차지한다", () => {
  const view = sajuProfileOf(BIRTH.birthdate, BIRTH.birthHour, BIRTH.gender);
  assert.equal(view.elements.length, 5);
  assert.deepEqual(view.elements.map((e) => e.ohaeng), ELEMENTS);
  // 0 개인 오행도 빠지지 않는다 — 없는 것도 정보다
  for (const e of view.elements) {
    assert.ok(e.ratio >= 0 && e.ratio <= 100, `${e.ohaeng} 비율이 범위 밖`);
  }
});

test("시간을 몰라도 수치가 나온다", () => {
  const view = sajuProfileOf(BIRTH.birthdate, null, "F");
  assert.equal(view.elements.length, 5);
  assert.ok(view.strength.score >= 0 && view.strength.score <= 100);
  assert.ok(view.guidelines.length >= 1);
});

test("명식이 다르면 지침도 다르다", () => {
  // 같은 지침만 나오면 "수치를 읽었다"가 거짓말이 된다.
  const a = sajuProfileOf("1995-03-14", 9, "F");
  const b = sajuProfileOf("1984-02-05", 12, "M");
  assert.notDeepEqual(
    a.guidelines.map((g) => g.title),
    b.guidelines.map((g) => g.title)
  );
});

test("지침은 최대 세 줄이고 근거가 붙는다", () => {
  for (const [d, h, g] of [
    ["1995-03-14", 9, "F"],
    ["1984-02-05", 12, "M"],
    ["2000-11-30", null, "F"],
    ["1978-07-22", 3, "M"],
  ] as const) {
    const view = sajuProfileOf(d, h, g);
    assert.ok(view.guidelines.length >= 1, `${d}: 지침이 없다`);
    assert.ok(view.guidelines.length <= 3, `${d}: 지침이 너무 많다`);
    for (const rule of view.guidelines) {
      assert.ok(rule.basis.length > 0, `${d}: 근거가 비었다`);
      assert.ok(rule.body.length > 20, `${d}: 지침이 너무 짧다`);
    }
  }
});

test("첫 줄은 언제나 강약이다", () => {
  // 강약이 사람을 가장 크게 가른다. 순서가 흔들리면 읽는 사람이 무엇부터
  // 봐야 하는지 알 수 없다.
  for (const [d, h, g] of [
    ["1995-03-14", 9, "F"],
    ["1984-02-05", 12, "M"],
    ["2000-11-30", null, "F"],
  ] as const) {
    assert.equal(sajuProfileOf(d, h, g).guidelines[0].basis, "강약");
  }
});

// ── 안전 문구 ──────────────────────────────────────────────
//
// 오늘의 액션과 같은 잣대를 쓴다. 여기는 타고난 결을 말하는 자리라
// 단정하기가 더 쉽고, 그래서 더 위험하다.
const FORBIDDEN = [
  "반드시", "무조건", "확실히", "틀림없", "성공한다", "합격한다",
  "돈을 벌", "부자가", "대박", "불행", "운이 나빠", "병이", "질병",
  "치료", "완치", "헤어진다", "이별한다", "결혼한다", "타고난 팔자",
];

test("모든 지침 문구에 단정이 없다", () => {
  const all = [
    ...Object.values(STRENGTH_GUIDELINE),
    ...Object.values(EXCESS_GUIDELINE),
    ...Object.values(ABSENT_GUIDELINE),
    ...Object.values(TENGOD_GUIDELINE),
  ];
  for (const rule of all) {
    const text = `${rule.title} ${rule.body}`;
    for (const word of FORBIDDEN) {
      assert.ok(!text.includes(word), `"${rule.title}" 에 금지 표현 "${word}"`);
    }
  }
});

test("없는 오행을 결함으로 말하지 않는다", () => {
  // "부족하다" 로 쓰면 고쳐야 할 흠으로 읽힌다. 손이 덜 가는 자리일 뿐이다.
  for (const rule of Object.values(ABSENT_GUIDELINE)) {
    for (const word of ["부족", "결핍", "약점", "채워야"]) {
      assert.ok(!`${rule.title} ${rule.body}`.includes(word), `${rule.basis}: "${word}"`);
    }
  }
});

test("표에 빈칸이 없다", () => {
  for (const ohaeng of ELEMENTS) {
    assert.ok(EXCESS_GUIDELINE[ohaeng], `${ohaeng} 과다 지침 없음`);
    assert.ok(ABSENT_GUIDELINE[ohaeng], `${ohaeng} 부재 지침 없음`);
  }
  for (const t of ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]) {
    assert.ok(TENGOD_GUIDELINE[t], `${t} 지침 없음`);
  }
  for (const label of ["신강", "중화", "신약"] as const) {
    assert.ok(STRENGTH_GUIDELINE[label], `${label} 지침 없음`);
  }
});

test("같은 명식은 같은 결과 — 무작위가 없다", () => {
  const a = sajuProfileOf(BIRTH.birthdate, BIRTH.birthHour, BIRTH.gender);
  const b = sajuProfileOf(BIRTH.birthdate, BIRTH.birthHour, BIRTH.gender);
  assert.deepEqual(a, b);
});


// ── 오늘의 깃발 ────────────────────────────────────────────
//
// 여기서 지켜야 할 것은 하나다: **무작위가 아니다.** 난수로 운세를 정하면
// 사주가 아니라 뽑기가 되고, 그 순간 CLAUDE.md 의 첫 규칙을 어긴다.

test("깃발은 다섯이고 오행 자리가 고정이다", () => {
  assert.equal(FLAGS.length, 5);
  assert.deepEqual(FLAGS.map((f) => f.ohaeng), ELEMENTS);
});

test("오행 엠블럼 다섯 장이 실제로 있다", () => {
  for (const ohaeng of ELEMENTS) {
    const art = ELEMENT_ART[ohaeng];
    assert.ok(art.startsWith("/assets/elements/"), `${ohaeng}: 경로가 예상 밖`);
    assert.ok(existsSync(`public${art}`), `${ohaeng}: 파일이 없다 — public${art}`);
  }
  assert.equal(new Set(Object.values(ELEMENT_ART)).size, 5, "엠블럼이 겹친다");
  // 움직이는 판 — 그림과 짝이 맞아야 폴백이 안 튄다
  for (const ohaeng of ELEMENTS) {
    const v = ELEMENT_VIDEO[ohaeng];
    assert.ok(existsSync(`public${v}`), `${ohaeng}: 영상이 없다 — public${v}`);
    assert.equal(
      v.replace(/\.webm$/, ""),
      ELEMENT_ART[ohaeng].replace(/\.webp$/, ""),
      `${ohaeng}: 영상과 그림이 다른 것을 가리킨다`
    );
  }
});

test("오방기 그림 다섯 장이 실제로 있다", () => {
  for (const flag of FLAGS) {
    assert.ok(flag.art.startsWith("/assets/flags/"), `${flag.ohaeng}: 경로가 예상 밖`);
    assert.ok(existsSync(`public${flag.art}`), `${flag.ohaeng}: 파일이 없다 — public${flag.art}`);
    assert.ok(existsSync(`public${flag.video}`), `${flag.ohaeng}: 영상이 없다 — public${flag.video}`);
  }
  // 다섯이 서로 다른 그림이어야 한다 — 같으면 고를 이유가 없다
  assert.equal(new Set(FLAGS.map((f) => f.art)).size, 5, "깃발 그림이 겹친다");
});

test("전통 오방색 이름이 오행과 맞는다", () => {
  // 청목·적화·황토·백금·흑수. 화면의 오행 막대 색(목=초록)과 다른 축이다.
  const expected: Record<string, string> = { 목: "청", 화: "적", 토: "황", 금: "백", 수: "흑" };
  for (const flag of FLAGS) {
    assert.equal(flag.color, expected[flag.ohaeng], `${flag.ohaeng} 의 오방색이 틀렸다`);
  }
});

test("어느 깃발을 골라도 답은 하나다", () => {
  // 고르는 것은 사용자 자유지만 결과는 오늘의 일진이 정한다.
  const first = flipFlag("목", "화");
  for (let i = 0; i < 20; i += 1) {
    assert.deepEqual(flipFlag("목", "화"), first, "같은 입력에 다른 답이 나왔다");
  }
});

test("오행 생극이 명리와 맞는다", () => {
  // 목생화 — 내가 화를 낳으니 내보내는 자리
  assert.equal(flipFlag("목", "화").relation, "생해줌");
  // 수생목 — 수가 나를 낳으니 받는 자리
  assert.equal(flipFlag("목", "수").relation, "생받음");
  // 목극토 — 내가 토를 누른다
  assert.equal(flipFlag("목", "토").relation, "내가 이김");
  // 금극목 — 금이 나를 누른다
  assert.equal(flipFlag("목", "금").relation, "나를 누름");
  // 같은 오행
  assert.equal(flipFlag("목", "목").relation, "같은 편");
});

test("다섯 관계가 모두 나올 수 있다", () => {
  const seen = new Set(ELEMENTS.map((today) => flipFlag("목", today).relation));
  assert.equal(seen.size, 5, "관계가 겹친다 — 생극 표가 틀렸다");
});

test("모든 오행 짝에 문구가 있다", () => {
  for (const mine of ELEMENTS) {
    for (const today of ELEMENTS) {
      const r = flipFlag(mine, today);
      assert.ok(r.title.length > 4, `${mine}/${today}: 제목이 비었다`);
      assert.ok(r.body.length > 20, `${mine}/${today}: 설명이 짧다`);
    }
  }
});

test("깃발 문구에도 단정이 없다", () => {
  for (const mine of ELEMENTS) {
    for (const today of ELEMENTS) {
      const r = flipFlag(mine, today);
      for (const word of FORBIDDEN) {
        assert.ok(!`${r.title} ${r.body}`.includes(word), `${mine}/${today}: "${word}"`);
      }
    }
  }
});

test("상생 고리는 목→화→토→금→수 순서다", () => {
  // 원형 그래프가 이 순서로 자리를 잡는다. 어긋나면 상생이 이웃이 아니게 된다.
  assert.deepEqual(CYCLE, ["목", "화", "토", "금", "수"]);
  for (let i = 0; i < CYCLE.length; i += 1) {
    const next = CYCLE[(i + 1) % CYCLE.length];
    assert.equal(
      flipFlag(CYCLE[i], next).relation,
      "생해줌",
      `${CYCLE[i]} 다음이 ${next} 인데 상생이 아니다`
    );
  }
});
