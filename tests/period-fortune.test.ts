import assert from "node:assert/strict";
import test from "node:test";
import { DOMAINS, FLOWS } from "../src/lib/daily-action";
import {
  PERIOD_TABLE,
  buildAllDomains,
  buildPeriodFortune,
} from "../src/lib/period-fortune";

// 표가 비면 화면이 빈칸으로 나가고, 문장에 {기간} 이 남으면 사용자가 그것을
// 그대로 읽는다. 둘 다 조용한 실패라 여기서 막는다.

test("표가 흐름 다섯 × 영역 여덟을 빠짐없이 채운다", () => {
  for (const flow of FLOWS) {
    for (const domain of DOMAINS) {
      const c = PERIOD_TABLE[flow][domain];
      assert.ok(c, `${flow}/${domain} 이 비어 있다`);
      for (const key of ["headline", "flowNote", "focus", "hold"] as const) {
        assert.ok(c[key] && c[key].length > 5, `${flow}/${domain}.${key} 가 비었다`);
      }
    }
  }
});

test("자리표시자 {기간} 이 화면으로 새어 나가지 않는다", () => {
  const base = { year: 1995, month: 5, day: 20, hour: 10, nowMs: Date.UTC(2026, 8, 8) };
  for (const period of ["week", "month"] as const) {
    for (const f of buildAllDomains({ ...base, period })) {
      const all = [f.copy.headline, f.copy.flowNote, f.copy.focus, f.copy.hold].join(" ");
      assert.ok(!all.includes("{기간}"), `${period}/${f.domain} 에 자리표시자가 남았다`);
      assert.ok(
        all.includes(period === "week" ? "주" : "달"),
        `${period}/${f.domain} 에 기간 표현이 없다`
      );
    }
  }
});

test("여덟 영역이 전부 나오고 서로 다르다", () => {
  const list = buildAllDomains({
    year: 1995, month: 5, day: 20, hour: 10,
    period: "week", nowMs: Date.UTC(2026, 8, 8),
  });
  assert.equal(list.length, 8);
  assert.equal(new Set(list.map((f) => f.domain)).size, 8);
});

test("같은 사람 같은 주에는 늘 같은 답이다 — 무작위가 없다", () => {
  const input = {
    year: 1995, month: 5, day: 20, hour: 10,
    domain: "love" as const, period: "week" as const,
    nowMs: Date.UTC(2026, 8, 8),
  };
  const a = buildPeriodFortune(input);
  const b = buildPeriodFortune(input);
  assert.deepEqual(a, b);
});

test("주는 같은 주 안에서 안 바뀌고, 다음 주에는 기간 표시가 달라진다", () => {
  const base = {
    year: 1995, month: 5, day: 20, hour: 10,
    domain: "love" as const, period: "week" as const,
  };
  // 2026-09-08 은 화요일. 같은 주의 수요일과 답이 같아야 한다.
  const tue = buildPeriodFortune({ ...base, nowMs: Date.UTC(2026, 8, 8, 3) });
  const wed = buildPeriodFortune({ ...base, nowMs: Date.UTC(2026, 8, 9, 3) });
  assert.equal(tue.rangeLabel, wed.rangeLabel, "같은 주인데 기간이 다르다");
  assert.equal(tue.copy.headline, wed.copy.headline);

  const nextWeek = buildPeriodFortune({ ...base, nowMs: Date.UTC(2026, 8, 15, 3) });
  assert.notEqual(tue.rangeLabel, nextWeek.rangeLabel, "다음 주인데 기간이 같다");
});

test("단정하는 말을 쓰지 않는다", () => {
  // 운세는 재미와 자기성찰이다 — 확정으로 읽히면 그 선을 넘는다.
  const banned = ["반드시", "절대", "확실히", "틀림없", "운명"];
  for (const flow of FLOWS) {
    for (const domain of DOMAINS) {
      const c = PERIOD_TABLE[flow][domain];
      const all = [c.headline, c.flowNote, c.focus, c.hold].join(" ");
      for (const word of banned) {
        assert.ok(!all.includes(word), `${flow}/${domain} 에 "${word}" 가 있다`);
      }
    }
  }
});

test("근거를 밝힌다 — 무엇으로 잰 것인지 화면이 적을 수 있어야 한다", () => {
  const w = buildPeriodFortune({
    year: 1995, month: 5, day: 20, hour: 10,
    domain: "love", period: "week", nowMs: Date.UTC(2026, 8, 8),
  });
  assert.match(w.basis.pillarLabel, /일진/);
  assert.ok(w.basis.dayMaster.length >= 2);
  assert.ok(w.basis.pillar.length >= 2);

  const m = buildPeriodFortune({
    year: 1995, month: 5, day: 20, hour: 10,
    domain: "love", period: "month", nowMs: Date.UTC(2026, 8, 8),
  });
  assert.match(m.basis.pillarLabel, /월주/);
});
