import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { yearLabelOf, seoulYear } from "@/lib/year-label";

/*
  홈의 신년·하반기 섹션이 제목에 세우는 해 이름.

  손으로 적으면 해가 바뀔 때 홈이 지난해를 말한다. 여기서 보는 것은 그 값이
  계산에서 나오는지, 그리고 해마다 실제로 달라지는지다.
*/

describe("해 이름", () => {
  it("2027 은 정미년, 붉은 양의 해다", () => {
    // 참고 화면(2026-09-09 운영자)이 말하는 그 해다.
    const y = yearLabelOf(2027);
    assert.equal(y.ganji, "정미");
    assert.equal(y.color, "붉은");
    assert.equal(y.animal, "양");
    assert.equal(y.phrase, "붉은 양의 해");
  });

  it("빛깔은 천간에서, 짐승은 지지에서 온다", () => {
    // 2026 병오 = 화(붉은) + 오(말). 지지 오도 화라 여기서는 둘이 같지만,
    // 2027 정미는 정=화(붉은) + 미=토라 갈린다 — 지지에서 색을 뽑았다면
    // "누런 양" 이 됐을 것이다.
    assert.equal(yearLabelOf(2026).phrase, "붉은 말의 해");
    assert.equal(yearLabelOf(2027).phrase, "붉은 양의 해");
    assert.equal(yearLabelOf(2028).phrase, "누런 원숭이의 해");
  });

  it("육십갑자가 돈다 — 60년 뒤에 같은 이름", () => {
    assert.equal(yearLabelOf(2027).ganji, yearLabelOf(2087).ganji);
    assert.notEqual(yearLabelOf(2027).ganji, yearLabelOf(2028).ganji);
  });

  it("열두 해를 보면 짐승이 열둘 다 나온다", () => {
    const animals = new Set(
      Array.from({ length: 12 }, (_, i) => yearLabelOf(2027 + i).animal)
    );
    assert.equal(animals.size, 12, "열두 해에 짐승이 겹친다");
  });

  it("올해는 서울 기준으로 센다", () => {
    const y = seoulYear(new Date("2026-12-31T23:30:00+09:00"));
    assert.equal(y, 2026, "서울에서 아직 2026 인데 해가 넘어갔다");
    const next = seoulYear(new Date("2027-01-01T00:30:00+09:00"));
    assert.equal(next, 2027);
  });
});
